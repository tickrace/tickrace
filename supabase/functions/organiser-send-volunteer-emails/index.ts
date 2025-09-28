// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0";
import { Resend } from "https://esm.sh/resend@3.2.0?target=deno&deno-std=0.192.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL") || "Tickrace <noreply@tickrace.com>";

const resend = new Resend(RESEND_API_KEY);

const ALLOWED_ORIGINS = [
  "https://www.tickrace.com",
  "https://tickrace.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const cors = (o: string | null) => ({
  "Access-Control-Allow-Origin": o && ALLOWED_ORIGINS.includes(o) ? o : "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, prefer",
});
const json = (b: any, s = 200, o: string | null = null) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...cors(o) } });

serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  try {
    const jwt = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: jwt } } });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { data: auth } = await userClient.auth.getUser();
    const user = auth?.user;
    if (!user) return json({ error: "Non authentifié" }, 401, origin);

    const body = await req.json();
    const { course_id, subject, html, statuses } = body ?? {};
    if (!course_id || !subject || !html) return json({ error: "Paramètres manquants" }, 400, origin);

    // Vérifier que l’utilisateur organise bien la course
    const { data: c, error: cErr } = await admin
      .from("courses")
      .select("id, organisateur_id, nom, lieu")
      .eq("id", course_id)
      .single();
    if (cErr || !c) return json({ error: "Course introuvable" }, 404, origin);
    if (c.organisateur_id !== user.id) return json({ error: "Accès refusé" }, 403, origin);

    // Emails des bénévoles de la course (filtre statut optionnel)
    let q = admin
      .from("benevoles_inscriptions")
      .select("statut, benevole:benevole_id(email)")
      .eq("course_id", course_id);

    if (Array.isArray(statuses) && statuses.length) q = q.in("statut", statuses);

    const { data: br, error: bErr } = await q;
    if (bErr) return json({ error: "Chargement bénévoles impossible" }, 500, origin);

    const recipients = Array.from(
      new Set(
        (br || [])
          .map((r: any) => (r?.benevole?.email || "").trim())
          .filter((e: string) => e && /\S+@\S+\.\S+/.test(e))
      )
    );

    if (recipients.length === 0) return json({ error: "Aucun destinataire" }, 400, origin);

    const batchSize = 50;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const slice = recipients.slice(i, i + batchSize);
      await resend.emails.send({ from: SENDER_EMAIL, to: slice, subject, html });
    }

    return json({ ok: true, sent: recipients.length }, 200, origin);
  } catch (e) {
    return json({ error: "Bad Request", details: String(e) }, 400, origin);
  }
});

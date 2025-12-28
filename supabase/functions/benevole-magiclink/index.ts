// supabase/functions/benevole-magiclink/index.ts
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://www.tickrace.com";

const ALLOWED_ORIGINS = [
  "https://www.tickrace.com",
  "https://tickrace.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, prefer",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonRes(origin: string | null, status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function clean(s: any) {
  return (s ?? "").toString().trim();
}
function normalizeEmail(s: any) {
  return clean(s).toLowerCase();
}

serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders(origin) });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const courseId = clean(body.course_id);
    const email = normalizeEmail(body.email);
    const website = clean(body.website); // honeypot
    if (website) return jsonRes(origin, 200, { ok: true }); // piège à bots

    if (!courseId || !email) return jsonRes(origin, 400, { ok: false, error: "Missing course_id/email" });

    // client anon (pour lire auth.uid éventuellement) – pas indispensable ici
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });

    const sr = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Vérifie que le bénévole existe sur cette course
    const { data: b, error: bErr } = await sr
      .from("benevoles")
      .select("id, email, last_invite_at")
      .eq("course_id", courseId)
      .eq("email", email)
      .maybeSingle();

    if (bErr) throw bErr;
    if (!b) return jsonRes(origin, 404, { ok: false, error: "Bénévole introuvable pour cette course" });

    // anti spam : 2 minutes mini
    const last = b.last_invite_at ? new Date(b.last_invite_at).getTime() : 0;
    const now = Date.now();
    if (last && now - last < 2 * 60 * 1000) {
      return jsonRes(origin, 429, { ok: false, error: "Lien demandé trop récemment. Réessaie dans 2 minutes." });
    }

    const redirectTo = `${SITE_URL}/benevole/${courseId}`;

    // Génère magiclink (fallback signup)
    let action_link = "";
    const gen1 = await sr.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

    if (gen1.error) {
      const gen2 = await sr.auth.admin.generateLink({
        type: "signup",
        email,
        options: { redirectTo },
      });
      if (gen2.error) throw gen2.error;
      action_link = gen2.data.properties.action_link;
    } else {
      action_link = gen1.data.properties.action_link;
    }

    // Met à jour last_invite_at (pour rate-limit)
    await sr.from("benevoles").update({ last_invite_at: new Date().toISOString() }).eq("id", b.id);

    return jsonRes(origin, 200, { ok: true, action_link });
  } catch (e: any) {
    console.error("benevole-magiclink error:", e);
    return jsonRes(origin, 500, { ok: false, error: e?.message || String(e) });
  }
});

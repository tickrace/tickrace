// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { Resend } from "https://esm.sh/resend@3.2.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const resend = new Resend(RESEND_API_KEY);

/* ============ CORS simple (prod + localhost) ============ */
const ALLOWED_ORIGINS = [
  "https://www.tickrace.com",
  "https://tickrace.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, prefer",
  };
}
function json(obj: any, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

/* ============ Helpers ============ */
function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function renderTpl(tpl: string, ctx: Record<string, string>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => ctx[k] ?? "");
}
function toHtml(text: string) {
  const safe = escapeHtml(text);
  const parts = safe.split(/\n{2,}/g).map((p) => p.replace(/\n/g, "<br/>"));
  return parts.map((p) => `<p>${p}</p>`).join("");
}
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* ============ Handler ============ */
serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  try {
    // Auth JWT (Bearer) obligatoire
    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
    if (!token) return json({ error: "Missing Authorization Bearer token" }, 401, origin);

    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user) return json({ error: "Invalid token" }, 401, origin);
    const userId = userRes.user.id;

    const body = await req.json();
    const {
      inscription_ids,   // string[]
      subject,           // string
      message,           // string
      include_statut,    // string[] optionnel
      dry_run = false,   // bool
    } = body ?? {};

    if (!Array.isArray(inscription_ids) || inscription_ids.length === 0) {
      return json({ error: "inscription_ids requis (array non vide)" }, 400, origin);
    }
    if (!subject || !message) {
      return json({ error: "subject et message sont requis" }, 400, origin);
    }

    // Récup inscriptions + jointures (même style que bénévoles)
    const { data: rows, error: rowsErr } = await admin
      .from("inscriptions")
      .select(`
        id, statut, dossard, nom, prenom, email,
        format:format_id (
          id, nom,
          course:course_id ( id, nom, lieu, organisateur_id )
        )
      `)
      .in("id", inscription_ids);

    if (rowsErr) return json({ error: "DB error (inscriptions)" }, 500, origin);

    // Autorisation: seulement les inscriptions sur les courses de l'organisateur courant
    const permitted = (rows || []).filter((r) => r?.format?.course?.organisateur_id === userId);

    // Filtre par statut si fourni
    const permittedFiltered = Array.isArray(include_statut) && include_statut.length
      ? permitted.filter((r) => include_statut.includes(r.statut))
      : permitted;

    // Cibles
    type Target = {
      inscription_id: string;
      email: string;
      prenom: string;
      nom: string;
      course: string;
      format: string;
      lieu: string;
      dossard: string;
    };
    const targets: Target[] = [];
    for (const r of permittedFiltered) {
      const email = String(r?.email ?? "").trim();
      if (!email) continue;
      targets.push({
        inscription_id: r.id,
        email,
        prenom: String(r?.prenom ?? "").trim(),
        nom: String(r?.nom ?? "").trim(),
        course: String(r?.format?.course?.nom ?? "").trim(),
        format: String(r?.format?.nom ?? "").trim(),
        lieu: String(r?.format?.course?.lieu ?? "").trim(),
        dossard: r?.dossard ? String(r.dossard) : "",
      });
    }

    // Dédupe par (email + course + format)
    const uniqMap = new Map<string, Target>();
    for (const t of targets) {
      const key = `${t.email.toLowerCase()}::${t.course}::${t.format}`;
      if (!uniqMap.has(key)) uniqMap.set(key, t);
    }
    const finalTargets = Array.from(uniqMap.values());

    // Dry-run : pas d'envoi, résumé seulement
    if (dry_run) {
      return json(
        {
          ok: true,
          dry_run: true,
          requested: inscription_ids.length,
          permitted: permitted.length,
          permitted_after_filters: permittedFiltered.length,
          will_send_to: finalTargets.length,
          sample: finalTargets.slice(0, 5),
        },
        200,
        origin
      );
    }

    // Envoi des emails (strictement comme bénévoles : pas de tags)
    const MAX_CONCURRENCY = 10;
    const batches = chunk(finalTargets, MAX_CONCURRENCY);
    let sent = 0;
    let failed = 0;
    const details: Array<{ email: string; inscription_id: string; ok: boolean; error?: string }> =
      [];

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(async (t) => {
          const subj = renderTpl(subject, t as any);
          const text = renderTpl(message, t as any);
          const html = toHtml(text);

          try {
            await resend.emails.send({
              from: "Tickrace <noreply@tickrace.com>",
              to: t.email,
              subject: subj,
              html,
              text,
            });
            sent++;
            details.push({ email: t.email, inscription_id: t.inscription_id, ok: true });
          } catch (e) {
            failed++;
            details.push({
              email: t.email,
              inscription_id: t.inscription_id,
              ok: false,
              error: String(e),
            });
          }
        })
      );
      void results;
    }

    return json(
      {
        ok: true,
        requested: inscription_ids.length,
        permitted: permitted.length,
        permitted_after_filters: permittedFiltered.length,
        attempted: finalTargets.length,
        sent,
        failed,
        details,
      },
      200,
      origin
    );
  } catch (e) {
    return json({ error: "Bad Request", details: String(e) }, 400, origin);
  }
});

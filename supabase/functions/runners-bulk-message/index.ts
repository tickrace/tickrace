// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { Resend } from "https://esm.sh/resend@3.2.0";

/**
 * ENV requis :
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - RESEND_API_KEY
 */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const resend = new Resend(RESEND_API_KEY);

/* ========================= CORS ========================= */
// Autorise prod, localhost et previews *.vercel.app
function isAllowedOrigin(origin: string | null) {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    const host = u.host.toLowerCase();
    if (host === "tickrace.com" || host === "www.tickrace.com") return true;
    if (host.endsWith(".vercel.app")) return true;
    if (host.startsWith("localhost:") || host.startsWith("127.0.0.1:")) return true;
    return false;
  } catch {
    return false;
  }
}
function corsHeaders(origin: string | null) {
  const allow = isAllowedOrigin(origin) ? origin! : "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, prefer",
  };
}
function json(obj: any, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

/* ========================= Helpers ========================= */
function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function toHtml(text: string) {
  const safe = escapeHtml(text);
  const parts = safe.split(/\n{2,}/g).map((p) => p.replace(/\n/g, "<br/>"));
  return parts.map((p) => `<p>${p}</p>`).join("");
}
function renderTpl(tpl: string, ctx: Record<string, string>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => ctx[k] ?? "");
}
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* ========================= Handler ========================= */
serve(async (req) => {
  const origin = req.headers.get("Origin");

  // Répondre au préflight sans auth
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  try {
    // Auth Bearer (JWT) vérifiée côté code (et pas via config) pour laisser passer OPTIONS
    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
    if (!token) return json({ error: "Missing Authorization Bearer token" }, 401, origin);

    const { data: ures, error: uerr } = await admin.auth.getUser(token);
    if (uerr || !ures?.user) return json({ error: "Invalid token" }, 401, origin);
    const userId = ures.user.id;

    // Payload
    const body = await req.json();
    const {
      inscription_ids,   // string[]
      subject,           // string (requis)
      message,           // string (requis)
      include_statut,    // string[] optionnel (p.ex. ["validé","en attente"])
      dry_run = false,   // bool
    } = body ?? {};

    if (!Array.isArray(inscription_ids) || inscription_ids.length === 0) {
      return json({ error: "inscription_ids requis (array non vide)" }, 400, origin);
    }
    if (!subject || !message) {
      return json({ error: "subject et message sont requis" }, 400, origin);
    }

    // 1) Inscriptions — (nom, prenom, email, dossard sont dans la table)
    const { data: rows, error: rowsErr } = await admin
      .from("inscriptions")
      .select("id, statut, dossard, nom, prenom, email, format_id")
      .in("id", inscription_ids);

    if (rowsErr) return json({ error: "DB error (inscriptions)" }, 500, origin);

    // Filtre statut (optionnel)
    const base = Array.isArray(include_statut) && include_statut.length
      ? (rows || []).filter((r) => include_statut.includes(r.statut))
      : (rows || []);

    // 2) Formats -> course_id, nom format
    const formatIds = Array.from(new Set(base.map((r) => r.format_id).filter(Boolean)));
    const { data: formats, error: fmtErr } = await admin
      .from("formats")
      .select("id, nom, course_id")
      .in("id", formatIds);

    if (fmtErr) return json({ error: "DB error (formats)" }, 500, origin);
    const fmtMap = new Map((formats || []).map((f) => [f.id, f]));

    // 3) Courses -> autorisation + nom/lieu
    const courseIds = Array.from(new Set((formats || []).map((f) => f.course_id).filter(Boolean)));
    const { data: courses, error: cErr } = await admin
      .from("courses")
      .select("id, nom, lieu, organisateur_id")
      .in("id", courseIds);

    if (cErr) return json({ error: "DB error (courses)" }, 500, origin);
    const courseMap = new Map((courses || []).map((c) => [c.id, c]));

    // 4) Autorisation : uniquement les inscriptions dont la course appartient à l'organisateur
    const permitted = base.filter((r) => {
      const f = fmtMap.get(r.format_id);
      const c = f ? courseMap.get(f.course_id) : null;
      return c && c.organisateur_id === userId;
    });

    // 5) Construire cibles
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
    for (const r of permitted) {
      const f = fmtMap.get(r.format_id);
      const c = f ? courseMap.get(f.course_id) : null;
      const email = r?.email?.trim();
      if (!email || !f || !c) continue;
      targets.push({
        inscription_id: r.id,
        email,
        prenom: String(r.prenom ?? "").trim(),
        nom: String(r.nom ?? "").trim(),
        course: String(c.nom ?? "").trim(),
        format: String(f.nom ?? "").trim(),
        lieu: String(c.lieu ?? "").trim(),
        dossard: r?.dossard ? String(r.dossard) : "",
      });
    }

    // 6) Dédupe (email + course + format)
    const uniq = new Map<string, Target>();
    for (const t of targets) {
      const key = `${t.email.toLowerCase()}::${t.course}::${t.format}`;
      if (!uniq.has(key)) uniq.set(key, t);
    }
    const finalTargets = Array.from(uniq.values());

    // Dry-run
    if (dry_run) {
      return json(
        {
          ok: true,
          dry_run: true,
          requested: inscription_ids.length,
          permitted: permitted.length,               // après autorisation
          permitted_after_filters: permitted.length, // (filtre statut appliqué plus haut)
          will_send_to: finalTargets.length,
          sample: finalTargets.slice(0, 5),
        },
        200,
        origin
      );
    }

    // 7) Envoi — préheader + reply_to + tags
    const MAX_CONCURRENCY = 10;
    let sent = 0, failed = 0;

    for (const part of chunk(finalTargets, MAX_CONCURRENCY)) {
      await Promise.allSettled(
        part.map(async (t) => {
          const ctx = t as Record<string, string>;
          const subj = renderTpl(subject, ctx);
          const text = renderTpl(message, ctx);

          // Préheader invisible (améliore l'aperçu et la délivrabilité)
          const preheader = `<div style="display:none;opacity:0;height:0;max-height:0;overflow:hidden">
            Infos ${escapeHtml(t.course)} — ${escapeHtml(t.format)}${t.dossard ? ` • Dossard ${escapeHtml(t.dossard)}` : ""}
          </div>`;

          const html = preheader + toHtml(text);

          try {
            await resend.emails.send({
              from: "Tickrace – Organisation <contact@tickrace.com>", // ⚠️ mets un from de domaine vérifié
              to: t.email,
              subject: subj,
              html,
              text,
              reply_to: "contact@tickrace.com",
              tags: [
                { name: "context", value: "runners-bulk" },
                { name: "course", value: t.course },
                { name: "format", value: t.format },
              ],
            });
            sent++;
          } catch {
            failed++;
          }
        })
      );
    }

    return json(
      {
        ok: true,
        requested: inscription_ids.length,
        permitted: permitted.length,
        permitted_after_filters: permitted.length,
        attempted: finalTargets.length,
        sent,
        failed,
      },
      200,
      origin
    );
  } catch (e) {
    return json({ error: "Bad Request", details: String(e) }, 400, origin);
  }
});

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { Resend } from "https://esm.sh/resend@3.2.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const UNSUBSCRIBE_SECRET = Deno.env.get("UNSUBSCRIBE_SECRET")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const resend = new Resend(RESEND_API_KEY);

// ---- token utils (HMAC-SHA256, base64url) ----
const te = new TextEncoder();
const key = await crypto.subtle.importKey(
  "raw",
  te.encode(UNSUBSCRIBE_SECRET),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"],
);
function b64url(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}
async function signToken(payload: Record<string, unknown>) {
  const p = b64url(te.encode(JSON.stringify(payload)));
  const sigBuf = await crypto.subtle.sign("HMAC", key, te.encode(p));
  const s = b64url(new Uint8Array(sigBuf));
  return `${p}.${s}`;
}

// ---- CORS ----
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

// ---- simple templating ----
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

serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });

  try {
    // Auth JWT obligatoire
    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
    if (!token) return json({ error: "Missing Authorization Bearer token" }, 401, origin);
    const { data: ures, error: uerr } = await admin.auth.getUser(token);
    if (uerr || !ures?.user) return json({ error: "Invalid token" }, 401, origin);
    const userId = ures.user.id;

    const body = await req.json();
    const { inscription_ids, subject, message, include_statut, dry_run = false } = body ?? {};
    if (!Array.isArray(inscription_ids) || inscription_ids.length === 0) {
      return json({ error: "inscription_ids requis (array non vide)" }, 400, origin);
    }
    if (!subject || !message) {
      return json({ error: "subject et message sont requis" }, 400, origin);
    }

    // Inscrits + jointures
    const { data: rows, error: rowsErr } = await admin
      .from("benevoles_inscriptions")
      .select(`
        id, statut,
        benevole:benevole_id ( id, prenom, nom, email ),
        course:course_id ( id, nom, lieu, organisateur_id )
      `)
      .in("id", inscription_ids);

    if (rowsErr) return json({ error: "DB error (inscriptions)" }, 500, origin);

    // Autorisation: que les cours de l'orga courant
    const permitted = (rows || []).filter((r) => r?.course?.organisateur_id === userId);

    const permittedFiltered = Array.isArray(include_statut) && include_statut.length
      ? permitted.filter((r) => include_statut.includes(r.statut))
      : permitted;

    // Construire la liste cible
    type Target = {
      inscription_id: string;
      course_id: string;
      email: string;
      prenom: string;
      nom: string;
      course: string;
      lieu: string;
    };
    const targets: Target[] = [];
    for (const r of permittedFiltered) {
      const email = r?.benevole?.email?.trim();
      if (!email) continue;
      targets.push({
        inscription_id: r.id,
        course_id: r.course.id,
        email,
        prenom: String(r?.benevole?.prenom ?? "").trim(),
        nom: String(r?.benevole?.nom ?? "").trim(),
        course: String(r?.course?.nom ?? "").trim(),
        lieu: String(r?.course?.lieu ?? "").trim(),
      });
    }

    // Dédupe (email + course_id)
    const uniqMap = new Map<string, Target>();
    for (const t of targets) {
      const key = `${t.email.toLowerCase()}::${t.course_id}`;
      if (!uniqMap.has(key)) uniqMap.set(key, t);
    }
    let finalTargets = Array.from(uniqMap.values());

    // ---- Filtre désinscrits ----
    if (finalTargets.length) {
      const emails = Array.from(new Set(finalTargets.map((t) => t.email.toLowerCase())));
      const courseIds = Array.from(new Set(finalTargets.map((t) => t.course_id)));
      const { data: suppress } = await admin
        .from("email_unsubscribes")
        .select("email, course_id")
        .in("course_id", courseIds)
        .in("email", emails);
      const suppressed = new Set(
        (suppress || []).map((row) => `${String(row.email).toLowerCase()}::${String(row.course_id)}`),
      );
      finalTargets = finalTargets.filter(
        (t) => !suppressed.has(`${t.email.toLowerCase()}::${t.course_id}`),
      );
    }

    // Dry run
    if (dry_run) {
      return json(
        {
          ok: true,
          dry_run: true,
          requested: inscription_ids.length,
          permitted: permitted.length,
          permitted_after_filters: permittedFiltered.length,
          will_send_to: finalTargets.length,
          sample: finalTargets.slice(0, 5).map((t) => ({
            email: t.email, prenom: t.prenom, nom: t.nom, course: t.course, lieu: t.lieu,
          })),
        },
        200,
        origin,
      );
    }

    // Envoi avec lien de désinscription personnalisé
    const MAX_CONCURRENCY = 10;
    const chunks = chunk(finalTargets, MAX_CONCURRENCY);
    let sent = 0, failed = 0;

    for (const part of chunks) {
      await Promise.allSettled(part.map(async (t) => {
        const subj = renderTpl(subject, t);
        const text = renderTpl(message, t);

        // token exp = 180 jours
        const token = await signToken({ email: t.email, course_id: t.course_id, exp: Math.floor(Date.now()/1000) + 180*24*3600 });
        const unsub = `${SUPABASE_URL}/functions/v1/volunteer-unsubscribe?t=${encodeURIComponent(token)}`;

        const html = toHtml(text) +
          `<p style="margin-top:16px;color:#666;font-size:12px">—<br/>` +
          `Si vous ne souhaitez plus recevoir d'emails bénévoles pour cette épreuve, ` +
          `<a href="${unsub}">cliquez ici pour vous désinscrire</a>.</p>`;

        const textWithUnsub = `${text}\n\n—\nSe désinscrire : ${unsub}`;

        try {
          await resend.emails.send({
            from: "Tickrace <noreply@tickrace.com>",
            to: t.email,
            subject: subj,
            html,
            text: textWithUnsub,
          });
          sent++;
        } catch {
          failed++;
        }
      }));
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
      },
      200,
      origin,
    );
  } catch (e) {
    return json({ error: "Bad Request", details: String(e) }, 400, origin);
  }
});

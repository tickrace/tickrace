// supabase/functions/send-lottery-email/index.ts
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

/* ------------------------------ ENV ------------------------------ */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "TickRace <support@tickrace.com>";
const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") || "https://www.tickrace.com";

/* ------------------------------ CORS ------------------------------ */
const ALLOWLIST = ["https://www.tickrace.com", "http://localhost:5173", "http://127.0.0.1:5173"];
function corsHeaders(req: Request) {
  const o = req.headers.get("origin");
  const allow = o && ALLOWLIST.includes(o) ? o : ALLOWLIST[0];
  const reqMethod = req.headers.get("access-control-request-method") || "POST";
  const reqHeaders =
    req.headers.get("access-control-request-headers") ||
    "authorization, x-client-info, apikey, content-type, prefer";
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": `${reqMethod}, OPTIONS`,
    "Access-Control-Allow-Headers": reqHeaders,
  };
}

/* --------------------------- Clients ----------------------------- */
const supabaseSR = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/* ---------------------------- Helpers ---------------------------- */
function json(data: any, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function mustEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    throw new Error("Missing env (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / RESEND_API_KEY).");
  }
}

function fmtDT(d: string | null | undefined) {
  if (!d) return "—";
  try {
    // Format simple FR
    const dt = new Date(d);
    return dt.toLocaleString("fr-FR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(d);
  }
}

function safeEmail(s: string) {
  return String(s || "").trim().toLowerCase();
}

function isEmailLike(s: string) {
  const e = safeEmail(s);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

async function resendSendEmail(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.message || body?.error || `Resend error ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

// Petit “pool” de concurrence pour envoyer des lots sans exploser le runtime
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) break;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

/* -------------------------- Auth / Orga -------------------------- */
async function getRequesterUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;

  // Vérifie le token via Supabase /auth/v1/user
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${m[1]}`,
      "apikey": SUPABASE_SERVICE_ROLE_KEY, // SR OK pour vérifier user
    },
  });

  if (!userRes.ok) return null;
  const u = await userRes.json().catch(() => null);
  return u?.id || null;
}

async function assertOrganizerOfCourse(userId: string, courseId: string) {
  const { data, error } = await supabaseSR
    .from("courses")
    .select("id, organisateur_id")
    .eq("id", courseId)
    .single();

  if (error || !data) throw new Error("Course not found.");
  if (data.organisateur_id !== userId) throw new Error("Forbidden.");
}

/* -------------------------- Templates --------------------------- */
function layout(title: string, bodyHtml: string) {
  return `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; background:#f5f5f5; padding:24px;">
    <div style="max-width:640px; margin:0 auto; background:white; border:1px solid #eee; border-radius:16px; overflow:hidden;">
      <div style="padding:18px 20px; border-bottom:1px solid #eee;">
        <div style="font-size:18px; font-weight:800; color:#111;">
          <span style="color:#f97316;">Tick</span>Race
        </div>
      </div>
      <div style="padding:20px;">
        <h1 style="margin:0 0 12px; font-size:18px; color:#111;">${title}</h1>
        ${bodyHtml}
        <div style="margin-top:18px; font-size:12px; color:#666;">
          Besoin d’aide ? Réponds à ce mail ou écris-nous : <b>support@tickrace.com</b>
        </div>
      </div>
      <div style="padding:14px 20px; border-top:1px solid #eee; font-size:12px; color:#777;">
        TickRace • ${SITE_URL}
      </div>
    </div>
  </div>`;
}

function btn(label: string, url: string) {
  return `
  <div style="margin:16px 0;">
    <a href="${url}"
       style="display:inline-block; background:#f97316; color:white; text-decoration:none; padding:10px 14px; border-radius:12px; font-weight:700;">
      ${label}
    </a>
  </div>`;
}

function inviteEmailTemplate(args: {
  courseName: string;
  formatName: string;
  inviteUrl: string;
  expiresAt: string;
  rank?: number | null;
}) {
  const rankLine = args.rank ? `<div style="margin:6px 0; color:#111;">Ton rang au tirage : <b>${args.rank}</b></div>` : "";
  const html = layout(
    "🎟️ Tu es invité(e) à t’inscrire",
    `
      <div style="color:#333; font-size:14px; line-height:1.5;">
        <div>Bonne nouvelle ! Tu as été sélectionné(e) pour t’inscrire à :</div>
        <div style="margin:10px 0; padding:12px; background:#fafafa; border:1px solid #eee; border-radius:12px;">
          <div style="font-weight:800; color:#111;">${args.courseName}</div>
          <div style="color:#555;">Format : <b>${args.formatName}</b></div>
          ${rankLine}
        </div>

        <div>⚠️ L’invitation expire le : <b>${fmtDT(args.expiresAt)}</b></div>
        ${btn("Finaliser mon inscription", args.inviteUrl)}

        <div style="margin-top:10px; font-size:13px; color:#555;">
          Si le bouton ne fonctionne pas, copie-colle ce lien dans ton navigateur :
          <div style="margin-top:6px; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size:12px; word-break:break-all;">
            ${args.inviteUrl}
          </div>
        </div>
      </div>
    `
  );

  const text =
    `Tu es invité(e) à t’inscrire.\n\n` +
    `${args.courseName}\nFormat: ${args.formatName}\n` +
    (args.rank ? `Rang: ${args.rank}\n` : "") +
    `Expiration: ${fmtDT(args.expiresAt)}\n\n` +
    `Lien: ${args.inviteUrl}\n\n` +
    `Support: support@tickrace.com`;

  return { html, text };
}

function preinscriptionConfirmTemplate(args: {
  courseName: string;
  formatName: string;
  drawAt?: string | null;
  resultsUrl: string;
  preCloseAt?: string | null;
}) {
  const html = layout(
    "✅ Préinscription confirmée",
    `
      <div style="color:#333; font-size:14px; line-height:1.5;">
        <div>Ta préinscription a bien été enregistrée pour :</div>
        <div style="margin:10px 0; padding:12px; background:#fafafa; border:1px solid #eee; border-radius:12px;">
          <div style="font-weight:800; color:#111;">${args.courseName}</div>
          <div style="color:#555;">Format : <b>${args.formatName}</b></div>
        </div>

        <div>📌 Fin de la période de préinscription : <b>${fmtDT(args.preCloseAt || undefined)}</b></div>
        <div style="margin-top:6px;">🎲 Date du tirage (indicative) : <b>${fmtDT(args.drawAt || undefined)}</b></div>

        ${btn("Voir le résultat / statut", args.resultsUrl)}

        <div style="margin-top:10px; font-size:13px; color:#555;">
          Tu pourras consulter ton statut (invité, rang, expiration, etc.) via ce lien :
          <div style="margin-top:6px; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size:12px; word-break:break-all;">
            ${args.resultsUrl}
          </div>
        </div>
      </div>
    `
  );

  const text =
    `Préinscription confirmée.\n\n` +
    `${args.courseName}\nFormat: ${args.formatName}\n` +
    `Fin préinscription: ${fmtDT(args.preCloseAt || undefined)}\n` +
    `Tirage (indicatif): ${fmtDT(args.drawAt || undefined)}\n\n` +
    `Résultat: ${args.resultsUrl}\n\n` +
    `Support: support@tickrace.com`;

  return { html, text };
}

/* ------------------------------ Main ------------------------------ */
serve(async (req: Request) => {
  const cors = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    mustEnv();

    const body = await req.json().catch(() => ({}));
    const type = String(body?.type || "");

    if (!type) return json({ error: "Missing type" }, 400, cors);

    // On fetch les noms course/format pour un rendu propre (SR)
    async function fetchCourseFormat(course_id: string, format_id: string) {
      const { data: course, error: ce } = await supabaseSR
        .from("courses")
        .select("id, nom, lieu, organisateur_id")
        .eq("id", course_id)
        .single();
      if (ce || !course) throw new Error("Course not found.");

      const { data: format, error: fe } = await supabaseSR
        .from("formats")
        .select("id, nom, date, heure_depart, is_team_event, team_size")
        .eq("id", format_id)
        .single();
      if (fe || !format) throw new Error("Format not found.");

      const { data: settings } = await supabaseSR
        .from("format_lottery_settings")
        .select("pre_open_at, pre_close_at, draw_at, invite_ttl_hours, enabled")
        .eq("format_id", format_id)
        .maybeSingle();

      return { course, format, settings };
    }

    /* ---------------- Invite batch (orga) ---------------- */
    if (type === "invite") {
      const course_id = String(body?.course_id || "");
      const format_id = String(body?.format_id || "");
      const invites = Array.isArray(body?.invites) ? body.invites : [];

      if (!course_id || !format_id) return json({ error: "Missing course_id/format_id" }, 400, cors);
      if (!invites.length) return json({ error: "Missing invites[]" }, 400, cors);

      // Auth + contrôle orga
      const requesterId = await getRequesterUserId(req);
      if (!requesterId) return json({ error: "Unauthorized" }, 401, cors);
      await assertOrganizerOfCourse(requesterId, course_id);

      const { course, format } = await fetchCourseFormat(course_id, format_id);

      const cleaned = invites
        .map((x: any) => ({
          email: safeEmail(x?.email),
          token: String(x?.token || ""),
          expires_at: String(x?.expires_at || ""),
          rank: x?.rank ?? null,
        }))
        .filter((x) => isEmailLike(x.email) && x.token && x.expires_at);

      if (!cleaned.length) return json({ error: "No valid invites" }, 400, cors);

      const results = await mapLimit(cleaned, 5, async (inv) => {
        const inviteUrl =
          `${SITE_URL}/inscription/${course_id}` +
          `?formatId=${encodeURIComponent(format_id)}` +
          `&invite=${encodeURIComponent(inv.token)}`;

        const subject = `TickRace — Invitation d’inscription (${course.nom} • ${format.nom || "Format"})`;
        const tpl = inviteEmailTemplate({
          courseName: course.nom,
          formatName: format.nom || "Format",
          inviteUrl,
          expiresAt: inv.expires_at,
          rank: inv.rank,
        });

        try {
          await resendSendEmail({ to: inv.email, subject, html: tpl.html, text: tpl.text });
          return { email: inv.email, ok: true };
        } catch (e) {
          return { email: inv.email, ok: false, error: String(e?.message || e) };
        }
      });

      const sent = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);

      return json({ ok: true, type, sent, failed }, 200, cors);
    }

    /* ----------- Préinscription confirm (coureur) ----------- */
    if (type === "preinscription_confirm") {
      // On supporte deux modes :
      // A) tu passes directement {to, course_id, format_id, draw_at?, pre_close_at?}
      // B) tu passes {preinscription_id} => la fonction récupère email + course/format
      const preinscription_id = body?.preinscription_id ? String(body.preinscription_id) : null;

      let to = safeEmail(body?.to || "");
      let course_id = String(body?.course_id || "");
      let format_id = String(body?.format_id || "");
      let draw_at = body?.draw_at ? String(body.draw_at) : null;
      let pre_close_at = body?.pre_close_at ? String(body.pre_close_at) : null;

      if (preinscription_id) {
        const { data: pre, error: pe } = await supabaseSR
          .from("format_preinscriptions")
          .select("id, email, course_id, format_id, status")
          .eq("id", preinscription_id)
          .single();
        if (pe || !pre) return json({ error: "Preinscription not found" }, 404, cors);

        to = safeEmail(pre.email);
        course_id = pre.course_id;
        format_id = pre.format_id;
      }

      if (!to || !isEmailLike(to)) return json({ error: "Invalid to" }, 400, cors);
      if (!course_id || !format_id) return json({ error: "Missing course_id/format_id" }, 400, cors);

      const { course, format, settings } = await fetchCourseFormat(course_id, format_id);

      const resultsUrl = `${SITE_URL}/tirage/${format_id}`;
      const subject = `TickRace — Préinscription confirmée (${course.nom} • ${format.nom || "Format"})`;

      const tpl = preinscriptionConfirmTemplate({
        courseName: course.nom,
        formatName: format.nom || "Format",
        drawAt: draw_at || settings?.draw_at || null,
        preCloseAt: pre_close_at || settings?.pre_close_at || null,
        resultsUrl,
      });

      await resendSendEmail({ to, subject, html: tpl.html, text: tpl.text });

      return json({ ok: true, type, sent: 1 }, 200, cors);
    }

    return json({ error: "Unknown type" }, 400, cors);
  } catch (e) {
    console.error("send-lottery-email error:", e);
    return json({ error: String(e?.message || e) }, 500, cors);
  }
});

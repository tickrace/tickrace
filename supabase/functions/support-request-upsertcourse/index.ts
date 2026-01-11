// supabase/functions/support-request-upsertcourse/index.ts
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPPORT_ADMIN_EMAILS = (Deno.env.get("SUPPORT_ADMIN_EMAILS") || "").split(",").map(s => s.trim()).filter(Boolean);
const SITE_URL = (Deno.env.get("SITE_URL") || "https://www.tickrace.com").replace(/\/+$/, "");
const TTL_MINUTES = Number(Deno.env.get("SUPPORT_TOKEN_TTL_MINUTES") || "30");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase env");
if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");
if (!SUPPORT_ADMIN_EMAILS.length) throw new Error("Missing SUPPORT_ADMIN_EMAILS");

const supabaseSR = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
    },
  });
}

function base64url(bytes: Uint8Array) {
  const bin = String.fromCharCode(...bytes);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sendResendEmail(to: string[], subject: string, html: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: "Tickrace <support@tickrace.com>",
      to,
      subject,
      html,
    }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Resend error: ${r.status} ${txt}`);
  }
  return await r.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true }, 200);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = req.headers.get("authorization") || "";
    const jwt = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
    if (!jwt) return json({ error: "Missing Authorization bearer token" }, 401);

    const { data: userRes, error: userErr } = await supabaseSR.auth.getUser(jwt);
    if (userErr || !userRes?.user) return json({ error: "Invalid user token" }, 401);

    const user = userRes.user;

    const body = await req.json().catch(() => ({}));
    const reason = (body?.reason || "").toString().slice(0, 400);
    const courseId = body?.course_id ? String(body.course_id) : null;

    // Génère token + hash
    const rnd = new Uint8Array(32);
    crypto.getRandomValues(rnd);
    const token = base64url(rnd);
    const token_hash = await sha256Hex(token);

    const expires_at = new Date(Date.now() + TTL_MINUTES * 60_000).toISOString();

    const { data: sessionRow, error: insErr } = await supabaseSR
      .from("support_sessions")
      .insert({
        scope: "upsertcourse",
        organisateur_id: user.id,
        course_id: courseId,
        status: "requested",
        token_hash,
        reason: reason || null,
        expires_at,
      })
      .select("id, scope, status, expires_at, created_at")
      .single();

    if (insErr) return json({ error: insErr.message }, 400);

    // Lien admin : ouvre UpsertCourse en mode support (admin devra être connecté)
    const supportUrl = `${SITE_URL}/upsert-course?support=${encodeURIComponent(token)}`;

    const subject = `Tickrace — Demande d'assistance création de course`;
    const html = `
      <div style="font-family:Arial,sans-serif; line-height:1.5">
        <h2>Demande d'assistance (UpsertCourse)</h2>
        <p><b>Organisateur</b> : ${user.email ?? user.id}</p>
        ${reason ? `<p><b>Message</b> : ${escapeHtml(reason)}</p>` : ""}
        <p><b>Expire</b> : ${new Date(expires_at).toLocaleString("fr-FR")}</p>
        <p>
          <a href="${supportUrl}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#111;color:#fff;text-decoration:none">
            Ouvrir UpsertCourse en mode support
          </a>
        </p>
        <p style="color:#666;font-size:12px">
          Token valable ${TTL_MINUTES} min. Ne pas transférer ce lien.
        </p>
      </div>
    `;

    await sendResendEmail(SUPPORT_ADMIN_EMAILS, subject, html);

    // Réponse côté organisateur : OK (ne jamais renvoyer le token)
    return json({
      ok: true,
      session: sessionRow,
    });
  } catch (e: any) {
    return json({ error: e?.message || "Unknown error" }, 500);
  }
});

function escapeHtml(s: string) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

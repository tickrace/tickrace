// supabase/functions/organiser-send-emails/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";

// (optionnel) envoi via Resend
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "Tickrace <no-reply@tickrace.com>";

/* ------------------------------ CORS ------------------------------ */
function corsHeaders() {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  // ⚠️ autoriser les headers que supabase-js envoie automatiquement
  h.set("Access-Control-Allow-Headers", "authorization, content-type, apikey, x-client-info");
  h.set("Access-Control-Max-Age", "86400");
  h.set("content-type", "application/json; charset=utf-8");
  return h;
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders() });

/* ------------------------------ Zod ------------------------------- */
const BodySchema = z.object({
  subject: z.string().min(1),
  html: z.string().min(1),
  to: z.array(z.string().email()).min(1),
});

/* ---------------------------- Email send -------------------------- */
async function sendEmailResend(to: string[], subject: string, html: string) {
  if (!RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY manquant" };
  const payload = { from: RESEND_FROM, to, subject, html };
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) return { ok: false, error: data?.message || `HTTP ${resp.status}` };
  return { ok: true, data };
}

/* ------------------------------ Handler --------------------------- */
serve(async (req) => {
  // ✅ répondre au préflight OPTIONS avec les bons headers
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: "payload invalide", details: parsed.error.issues }, 400);
    }

    const subject = parsed.data.subject.trim();
    const html = parsed.data.html;
    // déduplication simple, lower-case
    const recipients = Array.from(new Set(parsed.data.to.map((e) => e.trim().toLowerCase())));

    const send = await sendEmailResend(recipients, subject, html);
    if (!send.ok) {
      return json({ error: "send_failed", details: send.error }, 500);
    }

    return json({ ok: true, sent: recipients.length });
  } catch (e) {
    console.error("ORGA_SEND_EMAILS_FATAL:", e);
    return json({ error: "internal_error", details: String(e?.message ?? e) }, 500);
  }
});

// supabase/functions/organiser-send-emails/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";

/* --------------------------- Config (secrets) --------------------------- */
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "Tickrace <noreply@tickrace.com>";
const REPLY_TO = Deno.env.get("RESEND_REPLY_TO") || "contact@tickrace.com";

/* --------------------------------- CORS -------------------------------- */
function corsHeaders() {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "authorization, content-type, apikey, x-client-info");
  h.set("Access-Control-Max-Age", "86400");
  h.set("content-type", "application/json; charset=utf-8");
  return h;
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders() });

/* ------------------------------- Validation ---------------------------- */
const BodySchema = z.object({
  subject: z.string().min(1),
  html: z.string().min(1),
  to: z.array(z.string().email()).min(1),
});

/* ----------------------------- Resend helper --------------------------- */
async function resendSend(to: string[], subject: string, html: string) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to,
      subject,
      html,
      reply_to: REPLY_TO,
    }),
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

/* -------------------------------- Handler ------------------------------ */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!RESEND_API_KEY) return json({ error: "config_error", details: "RESEND_API_KEY manquant" }, 500);

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "payload invalide", details: parsed.error.issues }, 400);

    const subject = parsed.data.subject.trim();
    const html = parsed.data.html;
    const recipients = Array.from(new Set(parsed.data.to.map((e) => e.trim().toLowerCase())));

    if (recipients.length === 0) return json({ error: "no_recipients" }, 400);

    // Envoi par paquets (Resend tolère ~50 destinataires / appel)
    let sent = 0;
    for (let i = 0; i < recipients.length; i += 50) {
      const chunk = recipients.slice(i, i + 50);
      const r = await resendSend(chunk, subject, html);
      if (!r.ok) {
        return json(
          { error: "send_failed", details: r.data?.message || `HTTP ${r.status}`, provider: r.data },
          500
        );
      }
      sent += chunk.length;
    }

    return json({ ok: true, sent, from: RESEND_FROM });
  } catch (e) {
    console.error("ORGANISER_SEND_EMAILS_FATAL:", e);
    return json({ error: "internal_error", details: String(e?.message ?? e) }, 500);
  }
});

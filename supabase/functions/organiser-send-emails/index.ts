import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM_ENV = Deno.env.get("RESEND_FROM") || ""; // ex: "Tickrace <noreply@tickrace.com>"
const DEFAULT_FROM = 'Tickrace <noreply@tickrace.com>';
const FALLBACK_FROM = 'Tickrace <onboarding@resend.dev>'; // fonctionne sans domaine vérifié
const REPLY_TO = Deno.env.get("RESEND_REPLY_TO") || "contact@tickrace.com";

/* ------------------------------ CORS ------------------------------ */
function corsHeaders() {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "authorization, content-type, apikey, x-client-info");
  h.set("Access-Control-Max-Age", "86400");
  h.set("content-type", "application/json; charset=utf-8");
  return h;
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: corsHeaders() });

/* ------------------------------ Zod ------------------------------- */
const BodySchema = z.object({
  subject: z.string().min(1),
  html: z.string().min(1),
  to: z.array(z.string().email()).min(1),
});

/* --------------------------- Resend helper ------------------------ */
async function resendSend({ from, to, subject, html }: { from: string; to: string[]; subject: string; html: string }) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, reply_to: REPLY_TO }),
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

function isDomainNotVerifiedErr(msg: string | undefined) {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return m.includes("domain is not verified") || m.includes("not verified");
}

/* ------------------------------ Handler --------------------------- */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  if (!RESEND_API_KEY) {
    return json({ error: "config_error", details: "RESEND_API_KEY manquant" }, 500);
  }

  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return json({ error: "payload invalide", details: parsed.error.issues }, 400);

    const subject = parsed.data.subject.trim();
    const html = parsed.data.html;
    const recipients = Array.from(new Set(parsed.data.to.map((e) => e.trim().toLowerCase())));

    // chunking simple (Resend accepte ~50 destinataires par appel)
    const chunks: string[][] = [];
    for (let i = 0; i < recipients.length; i += 50) chunks.push(recipients.slice(i, i + 50));

    const wantedFrom = RESEND_FROM_ENV || DEFAULT_FROM;
    let sentTotal = 0;

    for (const to of chunks) {
      // 1) tentative avec le sender Tickrace
      let r = await resendSend({ from: wantedFrom, to, subject, html });

      // 2) fallback automatique si domaine non vérifié
      if (!r.ok && isDomainNotVerifiedErr(r.data?.message)) {
        r = await resendSend({
          from: `${wantedFrom.startsWith("Tickrace") ? "Tickrace" : "Tickrace"} <${FALLBACK_FROM.split("<")[1]!.replace(">", "")}>`,
          to,
          subject,
          html: `${html}<div style="display:none;color:#999">X-Original-From: ${wantedFrom}</div>`,
        });
        if (!r.ok) {
          return json({
            error: "send_failed",
            details: "Domaine d’envoi non vérifié et fallback Resend refusé.",
            provider: r.data,
          }, 500);
        }
      } else if (!r.ok) {
        return json({ error: "send_failed", details: r.data?.message || `HTTP ${r.status}` }, 500);
      }

      sentTotal += to.length;
    }

    return json({ ok: true, sent: sentTotal, from: wantedFrom });
  } catch (e) {
    console.error("ORGA_SEND_EMAILS_FATAL:", e);
    return json({ error: "internal_error", details: String(e?.message ?? e) }, 500);
  }
});

// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

/* ------------------------------ ENV ------------------------------ */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "Tickrace <support@tickrace.com>";

const SITE_URL = (Deno.env.get("SITE_URL") || "https://www.tickrace.com").replace(/\/$/, "");
const WAITLIST_INVITE_PATH = Deno.env.get("WAITLIST_INVITE_PATH") || "/waitlist/accept";

/* ----------------------------- Client ---------------------------- */
const supabaseSR = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/* ------------------------------ CORS ----------------------------- */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendResendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");
  const r = await fetch("https://api.resend.com/emails", {
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
    }),
  });

  const txt = await r.text();
  if (!r.ok) {
    throw new Error(`Resend error (${r.status}): ${txt}`);
  }
  return txt;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { ok: false, message: "Missing Supabase env (URL / SERVICE_ROLE_KEY)" });
    }

    const { courseId, formatId, maxInvites, expireHours } = await req.json();

    if (!courseId || !formatId) return json(400, { ok: false, message: "courseId et formatId requis." });
    const max = Number(maxInvites || 0);
    const hours = Number(expireHours || 0);
    if (!max || max <= 0) return json(400, { ok: false, message: "maxInvites invalide." });
    if (!hours || hours <= 0) return json(400, { ok: false, message: "expireHours invalide." });
    if (!RESEND_API_KEY) return json(500, { ok: false, message: "RESEND_API_KEY manquant." });

    // 1) prend les personnes non invitées, non consommées
    const { data: wl, error: wlErr } = await supabaseSR
      .from("waitlist")
      .select("id, email, prenom, nom")
      .eq("course_id", courseId)
      .eq("format_id", formatId)
      .is("invited_at", null)
      .is("consumed_at", null)
      .order("created_at", { ascending: true })
      .limit(max);

    if (wlErr) throw wlErr;

    const now = new Date();
    const expires = new Date(now.getTime() + hours * 3600 * 1000);

    let invited = 0;
    let sent = 0;
    let failed = 0;

    for (const row of wl || []) {
      const token = crypto.randomUUID();
      const acceptUrl = `${SITE_URL}${WAITLIST_INVITE_PATH}?token=${encodeURIComponent(token)}`;

      // 2) écrit le token + invited_at en base (idempotent simple)
      const { error: upErr } = await supabaseSR
        .from("waitlist")
        .update({
          invited_at: now.toISOString(),
          invite_token: token,
          invite_expires_at: expires.toISOString(),
        })
        .eq("id", row.id);

      if (upErr) {
        console.error("WAITLIST_UPDATE_ERROR", row.id, upErr);
        failed++;
        continue;
      }

      invited++;

      // 3) envoie email via Resend
      try {
        const subject = "Tickrace — Une place s’est libérée (liste d’attente)";
        const html = `
          <div style="font-family:Arial,sans-serif;line-height:1.5">
            <p>Bonjour ${row.prenom || ""} ${row.nom || ""},</p>
            <p>Une place s’est libérée sur un format où vous étiez en liste d’attente.</p>
            <p><b>⚠️ Votre lien expire dans ${hours}h.</b></p>
            <p>
              <a href="${acceptUrl}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#111;color:#fff;text-decoration:none;font-weight:bold">
                Valider mon invitation
              </a>
            </p>
            <p style="color:#666;font-size:12px">Si le bouton ne fonctionne pas, copiez ce lien :<br/>${acceptUrl}</p>
          </div>
        `;
        await sendResendEmail(row.email, subject, html);
        sent++;
      } catch (e) {
        console.error("RESEND_FAIL", row.email, e);
        failed++;

        // rollback simple si mail KO
        await supabaseSR
          .from("waitlist")
          .update({ invited_at: null, invite_token: null, invite_expires_at: null })
          .eq("id", row.id);
      }
    }

    return json(200, { ok: true, invited, sent, failed });
  } catch (e) {
    console.error("INVITE_WAITLIST_FATAL", e);
    return json(500, { ok: false, message: String(e?.message || e) });
  }
});

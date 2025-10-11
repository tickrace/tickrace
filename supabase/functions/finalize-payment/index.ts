// supabase/functions/finalize-payment/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@16.6.0?target=deno";

/* ------------ ENV ------------ */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "Tickrace <no-reply@tickrace.com>";
const TICKRACE_BASE_URL = Deno.env.get("TICKRACE_BASE_URL") || "https://www.tickrace.com";

/* ------------ Clients ------------ */
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });

/* ------------ CORS ------------ */
function corsHeaders() {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  h.set("Access-Control-Allow-Headers", "authorization, content-type, x-client-info, apikey, stripe-signature");
  h.set("Access-Control-Max-Age", "86400");
  h.set("content-type", "application/json; charset=utf-8");
  return h;
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: corsHeaders() });

/* ------------ Email ------------ */
async function sendResendEmail(to: string | null, subject: string, html: string) {
  if (!to || !RESEND_API_KEY) return { ok: false, reason: "no_recipient_or_api_key" };
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
  });
  const j = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error("RESEND_ERROR", resp.status, j);
    return { ok: false, reason: j?.message || "resend_failed" };
  }
  return { ok: true };
}

/* ------------ Core finalize ------------ */
async function finalizeFromSessionId(sessionId: string, sendEmail = true) {
  // Récupérer la session Stripe (avec details)
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent.charges", "customer", "customer_details"],
  });

  const paymentIntent = session.payment_intent as Stripe.PaymentIntent | null;

  // Paiement "paid" ?
  const isPaid =
    session.payment_status === "paid" ||
    (paymentIntent?.status === "succeeded");

  if (!isPaid) {
    return { paid: false, summary: null };
  }

  // Retrouver paiement en base
  let pay = await supabase
    .from("paiements")
    .select("id, stripe_session_id, status, total_amount_cents, inscription_ids")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  if (pay.error) console.error("PAYMENT_LOOKUP_ERROR", pay.error);

  // Constituer les inscriptions liées
  let inscriptionIds: string[] = pay.data?.inscription_ids || [];

  if (!inscriptionIds?.length) {
    const meta = (session.metadata || {}) as Record<string, string>;
    if (meta.inscription_id) {
      inscriptionIds = [meta.inscription_id];
    } else if (meta.groups) {
      const groupIds = meta.groups.split(",").map((x) => x.trim()).filter(Boolean);
      if (groupIds.length) {
        const inscs = await supabase.from("inscriptions").select("id").in("member_of_group_id", groupIds);
        if (!inscs.error) inscriptionIds = (inscs.data || []).map((r: any) => r.id);
      }
    }
  }

  // Upsert statut paiement = paye
  if (pay.data) {
    const upd = await supabase
      .from("paiements")
      .update({
        status: "paye",
        inscription_ids: inscriptionIds?.length ? inscriptionIds : pay.data.inscription_ids || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pay.data.id)
      .select("id")
      .maybeSingle();
    if (upd.error) console.error("PAYMENT_UPDATE_ERROR", upd.error);
  } else {
    const ins = await supabase
      .from("paiements")
      .insert({
        stripe_session_id: sessionId,
        status: "paye",
        inscription_ids: inscriptionIds?.length ? inscriptionIds : null,
      })
      .select("id")
      .maybeSingle();
    if (ins.error) console.error("PAYMENT_INSERT_ERROR", ins.error);
  }

  // Mettre à jour inscriptions / options / groupes
  if (inscriptionIds?.length) {
    const u1 = await supabase.from("inscriptions").update({ statut: "paye" }).in("id", inscriptionIds);
    if (u1.error) console.error("INSCRIPTIONS_UPDATE_ERROR", u1.error);

    const u2 = await supabase.from("inscriptions_options").update({ status: "confirmed" }).in("inscription_id", inscriptionIds);
    if (u2.error) console.error("OPTIONS_CONFIRM_ERROR", u2.error);

    const grpIdsRes = await supabase.from("inscriptions").select("member_of_group_id").in("id", inscriptionIds);
    const grpIds = [...new Set((grpIdsRes.data || []).map((r: any) => r.member_of_group_id).filter(Boolean))];
    if (grpIds.length) {
      const u3 = await supabase.from("inscriptions_groupes").update({ statut: "paye" }).in("id", grpIds);
      if (u3.error) console.error("GROUPS_UPDATE_ERROR", u3.error);
    }
  }

  // Email de confirmation
  let emailSent = false;
  if (sendEmail) {
    const payerEmail = session.customer_details?.email || session.customer_email || null;

    let inscriptions: Array<{ id: string; nom: string | null; prenom: string | null; team_name: string | null }> = [];
    if (inscriptionIds?.length) {
      const inscs = await supabase.from("inscriptions").select("id, nom, prenom, team_name").in("id", inscriptionIds);
      if (!inscs.error) inscriptions = inscs.data || [];
    }
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
        <h2>Confirmation d’inscription</h2>
        <p>Votre paiement a été confirmé. Voici le récapitulatif :</p>
        <ul>
          ${inscriptions.map(i => `<li>${(i.prenom||"").trim()} ${(i.nom||"").trim()} ${i.team_name ? `— ${i.team_name}` : ""}</li>`).join("")}
        </ul>
        <p>Consultez vos inscriptions : <a href="${TICKRACE_BASE_URL}/mes-inscriptions">Mes inscriptions</a></p>
        <p style="color:#667085;font-size:12px">Session Stripe : ${sessionId}</p>
      </div>
    `;
    let r = await sendResendEmail(payerEmail, "Tickrace – Confirmation d’inscription", html);
    if (!r.ok && !payerEmail && inscriptionIds?.length) {
      const firstEmail = await supabase.from("inscriptions").select("email").in("id", inscriptionIds).limit(1).maybeSingle();
      const to = firstEmail.data?.email || null;
      r = await sendResendEmail(to, "Tickrace – Confirmation d’inscription", html);
    }
    emailSent = !!r.ok;
  }

  // Récap pour la page Merci
  let paymentRow = await supabase
    .from("paiements")
    .select("stripe_session_id, total_amount_cents, status, created_at, inscription_ids")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  const payment = paymentRow.data || { stripe_session_id: sessionId, total_amount_cents: null, status: "paye", created_at: new Date().toISOString() };

  let inscriptionsR: any[] = [];
  if (inscriptionIds?.length) {
    const insRes = await supabase
      .from("inscriptions")
      .select("id, nom, prenom, email, team_name, statut, member_of_group_id")
      .in("id", inscriptionIds);
    if (!insRes.error) inscriptionsR = insRes.data || [];
  }
  const groupIds = [...new Set(inscriptionsR.map((i) => i.member_of_group_id).filter(Boolean))] as string[];
  let groupes: any[] = [];
  if (groupIds.length) {
    const gr = await supabase
      .from("inscriptions_groupes")
      .select("id, nom_groupe, team_name, team_name_public, statut, team_category, members_count")
      .in("id", groupIds);
    if (!gr.error) groupes = gr.data || [];
  }

  return {
    paid: true,
    emailSent,
    summary: {
      payment: {
        session_id: payment.stripe_session_id,
        total_amount_cents: payment.total_amount_cents,
        status: payment.status,
        created_at: payment.created_at,
      },
      inscriptions: inscriptionsR,
      groupes,
    },
  };
}

/* ------------ Handler (webhook + client) ------------ */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });

  try {
    const sig = req.headers.get("stripe-signature");

    // Cas 1: Webhook Stripe (signature fournie)
    if (sig && STRIPE_WEBHOOK_SECRET) {
      const raw = await req.arrayBuffer();
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        console.error("WEBHOOK_SIGNATURE_ERROR", err);
        return json({ error: "invalid_signature" }, 400);
      }

      // On gère les deux events courants
      let sessionId = "";
      if (event.type === "checkout.session.completed") {
        sessionId = (event.data.object as Stripe.Checkout.Session).id;
      } else if (event.type === "payment_intent.succeeded") {
        const pi = event.data.object as Stripe.PaymentIntent;
        const sessList = await stripe.checkout.sessions.list({ payment_intent: pi.id, limit: 1 });
        sessionId = sessList.data?.[0]?.id || "";
      }

      if (!sessionId) return json({ ok: true, ignored: true });

      const res = await finalizeFromSessionId(sessionId, true);
      return json({ ok: true, source: "webhook", ...res });
    }

    // Cas 2: Appel client (GET/POST avec session_id)
    let sessionId = "";
    let sendEmail = true;

    if (req.method === "GET") {
      const url = new URL(req.url);
      sessionId = url.searchParams.get("session_id") || "";
      sendEmail = (url.searchParams.get("send_email") ?? "1") !== "0";
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      sessionId = body?.session_id || "";
      if (typeof body?.send_email === "boolean") sendEmail = body.send_email;
    } else {
      return json({ error: "method_not_allowed" }, 405);
    }

    if (!sessionId) return json({ error: "missing_session_id" }, 400);

    const res = await finalizeFromSessionId(sessionId, sendEmail);
    return json({ ok: true, source: "client", ...res });
  } catch (e) {
    console.error("FINALIZE_PAYMENT_FATAL", e);
    return json({ error: "finalize_failed", details: String(e?.message ?? e) }, 500);
  }
});

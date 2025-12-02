// supabase/functions/stripe-webhook/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@16.6.0?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "Tickrace <no-reply@tickrace.com>";
const TICKRACE_BASE_URL = Deno.env.get("TICKRACE_BASE_URL") || "https://www.tickrace.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });

function cors(h = new Headers()) {
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "content-type, stripe-signature");
  h.set("content-type", "application/json; charset=utf-8");
  return h;
}

async function sendResendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !to) return { ok: false, reason: "no_api_key_or_recipient" };
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
  });
  const j = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error("RESEND_ERROR", resp.status, j);
    return { ok: false, reason: j?.message || "resend_failed" };
  }
  return { ok: true };
}

serve(async (req) => {
  const headers = cors();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  const rawBody = await req.arrayBuffer();
  const sig = req.headers.get("stripe-signature") || "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("WEBHOOK_SIGNATURE_ERROR", err);
    return new Response(JSON.stringify({ error: "invalid_signature" }), { status: 400, headers });
  }

  try {
    /* ---------------------------------------------------------------------- */
    /* 1) Paiements (checkout.session.completed / payment_intent.succeeded)   */
    /* ---------------------------------------------------------------------- */
    if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
      // Normaliser: récupérer la session si on ne l'a pas directement
      let session: Stripe.Checkout.Session | null = null;

      if (event.type === "checkout.session.completed") {
        const s = event.data.object as Stripe.Checkout.Session;
        session = await stripe.checkout.sessions.retrieve(s.id, {
          expand: ["payment_intent.charges", "customer", "customer_details"],
        });
      } else {
        // payment_intent.succeeded → retrouver la session associée
        const pi = event.data.object as Stripe.PaymentIntent;
        const sessList = await stripe.checkout.sessions.list({ payment_intent: pi.id, limit: 1 });
        if (sessList.data?.[0]) {
          session = await stripe.checkout.sessions.retrieve(sessList.data[0].id, {
            expand: ["payment_intent.charges", "customer", "customer_details"],
          });
        }
      }

      if (!session) {
        console.error("NO_SESSION_RESOLVED");
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      }

      const sessionId = session.id;
      const paymentIntent = session.payment_intent as Stripe.PaymentIntent | null;
      const charge =
        (paymentIntent?.charges?.data?.[0] as Stripe.Charge | undefined) || undefined;

      // 1) Retrouver / compléter le paiement côté DB
      let payRes = await supabase
        .from("paiements")
        .select("id, inscription_ids, inscription_id")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();

      if (payRes.error) {
        console.error("PAYMENT_LOOKUP_ERROR", payRes.error);
      }

      const meta = (session.metadata || {}) as Record<string, string>;
      let inscriptionIds: string[] =
        (payRes.data?.inscription_ids as string[] | null) || [];

      let groupIds: string[] = [];

      // Fallback si inscription_ids pas encore connus
      if (!inscriptionIds?.length) {
        if (meta.inscription_id) {
          inscriptionIds = [meta.inscription_id];
        } else if (meta.groups) {
          groupIds = meta.groups
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
          if (groupIds.length) {
            const inscs = await supabase
              .from("inscriptions")
              .select("id")
              .in("member_of_group_id", groupIds);
            if (!inscs.error) inscriptionIds = (inscs.data || []).map((r: any) => r.id);
          }
        }
      }

      // 2) Extraire les montants / fees / devise
      const amountSubtotal =
        (typeof session.amount_subtotal === "number" ? session.amount_subtotal : null) ??
        (typeof paymentIntent?.amount === "number" ? paymentIntent.amount : null);

      const amountTotal =
        (typeof session.amount_total === "number" ? session.amount_total : null) ??
        (typeof paymentIntent?.amount_received === "number"
          ? paymentIntent.amount_received
          : null) ??
        amountSubtotal;

      const currency =
        session.currency ||
        paymentIntent?.currency ||
        charge?.currency ||
        null;

      let feeTotal: number | null = null;
      let platformFeeAmount: number | null = null;
      let balanceTransactionId: string | null = null;
      const receiptUrl = charge?.receipt_url || null;

      if (charge && typeof charge.balance_transaction === "string") {
        balanceTransactionId = charge.balance_transaction;
        try {
          const bt = await stripe.balanceTransactions.retrieve(
            charge.balance_transaction as string,
          );
          if (bt && typeof bt.fee === "number") {
            feeTotal = bt.fee;
          }
          if (bt && Array.isArray(bt.fee_details)) {
            const appFee = bt.fee_details.find(
              (fd) => (fd.type as string) === "application_fee",
            );
            if (appFee && typeof appFee.amount === "number") {
              platformFeeAmount = appFee.amount;
            }
          }
        } catch (e) {
          console.error("BALANCE_TRANSACTION_RETRIEVE_ERROR", e);
        }
      }

      const montantTotal =
        typeof amountTotal === "number"
          ? Number((amountTotal / 100).toFixed(2))
          : null;

      // 3) Upsert payment info
      let paiementId: string | null = payRes.data?.id ?? null;

      if (!paiementId) {
        // Aucun paiement existant pour cette session → on insère
        const { data: newPay, error: insErr } = await supabase
          .from("paiements")
          .insert({
            stripe_session_id: sessionId,
            status: "paye",
            total_amount_cents: amountTotal ?? null,
            montant_total: montantTotal,
            devise: currency,
            stripe_payment_intent: paymentIntent?.id || null,
            stripe_payment_intent_id: paymentIntent?.id || null,
            stripe_charge_id: charge?.id || null,
            charge_id: charge?.id || null,
            amount_subtotal: amountSubtotal ?? null,
            amount_total: amountTotal ?? null,
            fee_total: feeTotal ?? null,
            platform_fee_amount: platformFeeAmount ?? null,
            balance_transaction_id: balanceTransactionId,
            receipt_url: receiptUrl,
            inscription_ids: inscriptionIds?.length ? inscriptionIds : null,
            inscription_id:
              inscriptionIds?.length === 1 ? inscriptionIds[0] : null,
            updated_at: new Date().toISOString(),
          })
          .select("id, inscription_ids")
          .single();

        if (insErr) {
          console.error("PAYMENT_INSERT_ERROR", insErr);
        } else {
          paiementId = newPay?.id ?? null;
          payRes = { data: newPay, error: null } as any;
        }
      } else {
        // Mise à jour du paiement existant
        const { data: updData, error: updErr } = await supabase
          .from("paiements")
          .update({
            status: "paye",
            montant_total: montantTotal,
            devise: currency,
            stripe_payment_intent: paymentIntent?.id || null,
            stripe_payment_intent_id: paymentIntent?.id || null,
            stripe_charge_id: charge?.id || null,
            charge_id: charge?.id || null,
            amount_subtotal: amountSubtotal ?? null,
            amount_total: amountTotal ?? null,
            fee_total: feeTotal ?? null,
            platform_fee_amount: platformFeeAmount ?? null,
            balance_transaction_id: balanceTransactionId,
            receipt_url: receiptUrl,
            total_amount_cents:
              amountTotal ?? payRes.data?.total_amount_cents ?? null,
            inscription_ids:
              inscriptionIds?.length && inscriptionIds.join("") !==
                (payRes.data?.inscription_ids || []).join("")
                ? inscriptionIds
                : payRes.data?.inscription_ids ?? null,
            inscription_id:
              inscriptionIds?.length === 1
                ? inscriptionIds[0]
                : payRes.data?.inscription_id ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_session_id", sessionId)
          .select("id, inscription_ids")
          .maybeSingle();

        if (updErr) {
          console.error("PAYMENT_UPDATE_ERROR", updErr);
        } else if (updData) {
          payRes = { data: updData, error: null } as any;
        }
      }

      // 4) Mettre à jour les statuts FR des inscriptions + options + groupes
      if (inscriptionIds?.length) {
        const u1 = await supabase
          .from("inscriptions")
          .update({ statut: "paye" })
          .in("id", inscriptionIds);
        if (u1.error) console.error("INSCRIPTIONS_UPDATE_ERROR", u1.error);

        const u2 = await supabase
          .from("inscriptions_options")
          .update({ status: "confirmed" })
          .in("inscription_id", inscriptionIds);
        if (u2.error) console.error("OPTIONS_CONFIRM_ERROR", u2.error);

        const grpIdsRes = await supabase
          .from("inscriptions")
          .select("member_of_group_id")
          .in("id", inscriptionIds);

        const grpIds = [
          ...new Set(
            (grpIdsRes.data || [])
              .map((r: any) => r.member_of_group_id)
              .filter(Boolean),
          ),
        ];

        if (grpIds.length) {
          const u3 = await supabase
            .from("inscriptions_groupes")
            .update({ statut: "paye" })
            .in("id", grpIds);
          if (u3.error) console.error("GROUPS_UPDATE_ERROR", u3.error);
        }
      }

      // 5) Email de confirmation (payeur)
      const payerEmail =
        session.customer_details?.email ||
        session.customer_email ||
        null;

      let inscriptions = [] as Array<{
        id: string;
        nom: string | null;
        prenom: string | null;
        team_name: string | null;
      }>;

      if (inscriptionIds?.length) {
        const inscs = await supabase
          .from("inscriptions")
          .select("id, nom, prenom, team_name")
          .in("id", inscriptionIds);
        if (!inscs.error) inscriptions = inscs.data || [];
      }

      const html = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
          <h2>Confirmation d’inscription</h2>
          <p>Votre paiement a été reçu. Voici le récapitulatif&nbsp;:</p>
          <ul>
            ${inscriptions
              .map(
                (i) =>
                  `<li>${(i.prenom || "").trim()} ${(i.nom || "").trim()}${
                    i.team_name ? ` — ${i.team_name}` : ""
                  }</li>`,
              )
              .join("")}
          </ul>
          <p>Vous pouvez consulter vos inscriptions ici : <a href="${TICKRACE_BASE_URL}/mes-inscriptions">Mes inscriptions</a></p>
          <p style="color:#667085;font-size:12px">Session Stripe : ${sessionId}</p>
        </div>
      `;

      if (payerEmail) {
        const r = await sendResendEmail(
          payerEmail,
          "Tickrace – Confirmation d’inscription",
          html,
        );
        if (!r.ok) console.error("CONFIRM_EMAIL_FAIL", r);
      } else if (inscriptionIds?.length) {
        const firstEmailRes = await supabase
          .from("inscriptions")
          .select("email")
          .in("id", inscriptionIds)
          .limit(1);
        const to = firstEmailRes.data?.[0]?.email;
        if (to) {
          const r = await sendResendEmail(
            to,
            "Tickrace – Confirmation d’inscription",
            html,
          );
          if (!r.ok) console.error("CONFIRM_EMAIL_FALLBACK_FAIL", r);
        }
      }
    }

    /* ---------------------------------------------------------------------- */
    /* 2) Refunds (charge.refunded / refund.created / refund.updated)         */
    /* ---------------------------------------------------------------------- */
    if (
      event.type === "charge.refunded" ||
      event.type === "refund.created" ||
      event.type === "refund.updated"
    ) {
      const refundObj = event.data.object as Stripe.Refund;
      const refundId = refundObj.id;
      const piId = refundObj.payment_intent as string | null;
      const amount = refundObj.amount || 0;

      // Chercher le paiement via payment_intent
      let paiement: any = null;
      if (piId) {
        const { data: pay, error: payErr } = await supabase
          .from("paiements")
          .select("*")
          .or(
            `stripe_payment_intent.eq.${piId},stripe_payment_intent_id.eq.${piId}`,
          )
          .order("created_at", { ascending: false })
          .maybeSingle();
        if (payErr) console.error("REFUND_PAYMENT_LOOKUP_ERROR", payErr);
        paiement = pay || null;
      }

      if (paiement) {
        const newRefundTotal =
          Number(paiement.refunded_total_cents || 0) + Number(amount || 0);
        let newStatus = "rembourse";
        const total = Number(paiement.total_amount_cents || 0);
        if (total > 0 && newRefundTotal < total) {
          newStatus = "partiellement_rembourse";
        }

        const { error: upPayErr } = await supabase
          .from("paiements")
          .update({
            refunded_total_cents: newRefundTotal,
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", paiement.id);

        if (upPayErr) console.error("REFUND_PAYMENT_UPDATE_ERROR", upPayErr);
      }

      const { data: remb, error: rembErr } = await supabase
        .from("remboursements")
        .select("*")
        .eq("stripe_refund_id", refundId)
        .maybeSingle();

      if (!rembErr && remb) {
        const { error: upRembErr } = await supabase
          .from("remboursements")
          .update({
            processed_at: new Date().toISOString(),
            status: "processed",
          })
          .eq("id", remb.id);
        if (upRembErr) console.error("REFUND_REMBOURSEMENT_UPDATE_ERROR", upRembErr);
      }

      if (!remb && paiement && paiement.inscription_ids?.length) {
        const inscription_id = paiement.inscription_ids[0];
        const { data: ins, error: insErr } = await supabase
          .from("inscriptions")
          .select("coureur_id")
          .eq("id", inscription_id)
          .maybeSingle();
        if (insErr) console.error("REFUND_INS_LOOKUP_ERROR", insErr);

        const user_id = ins?.coureur_id || paiement.user_id;
        if (user_id) {
          const { error: insRembErr } = await supabase
            .from("remboursements")
            .insert({
              paiement_id: paiement.id,
              inscription_id,
              user_id,
              policy_tier: "manual_stripe",
              percent: 100,
              amount_total_cents: paiement.total_amount_cents || amount || 0,
              base_cents: amount || 0,
              refund_cents: amount || 0,
              non_refundable_cents: 0,
              stripe_refund_id: refundId,
              status: "processed",
              reason: "Remboursement manuel Stripe",
            });
          if (insRembErr) console.error("REFUND_INSERT_MANUAL_ERROR", insRembErr);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e: any) {
    console.error("WEBHOOK_FATAL", e);
    return new Response(
      JSON.stringify({
        error: "webhook_failed",
        details: String(e?.message ?? e),
      }),
      {
        status: 500,
        headers,
      },
    );
  }
});

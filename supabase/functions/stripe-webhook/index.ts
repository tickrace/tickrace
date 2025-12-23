// supabase/functions/stripe-webhook/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@16.6.0?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

const SEND_INSCRIPTION_EMAIL_URL = Deno.env.get("SEND_INSCRIPTION_EMAIL_URL") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });

function cors(h = new Headers()) {
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "content-type, stripe-signature");
  h.set("content-type", "application/json; charset=utf-8");
  return h;
}

async function callSendInscriptionEmail(inscriptionId: string) {
  if (!SEND_INSCRIPTION_EMAIL_URL) {
    console.warn("SEND_INSCRIPTION_EMAIL_URL non défini, email non envoyé pour", inscriptionId);
    return;
  }

  const resp = await fetch(SEND_INSCRIPTION_EMAIL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ inscription_id: inscriptionId }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    console.error("SEND_INSCRIPTION_EMAIL_FAILED", inscriptionId, resp.status, txt);
  } else {
    console.log("SEND_INSCRIPTION_EMAIL_OK", inscriptionId);
  }
}

/** Util: charge les frais Stripe (bt.fee) en cents depuis un charge.balance_transaction */
async function getStripeFeeFromCharge(charge: Stripe.Charge) {
  if (!charge) return { balanceTxId: null as string | null, feeTotal: null as number | null };

  const btId = typeof charge.balance_transaction === "string" ? charge.balance_transaction : null;
  if (!btId) return { balanceTxId: null, feeTotal: null };

  try {
    const bt = await stripe.balanceTransactions.retrieve(btId);
    const fee = typeof bt.fee === "number" ? bt.fee : null; // cents
    return { balanceTxId: btId, feeTotal: fee };
  } catch (e) {
    console.error("BALANCE_TX_RETRIEVE_ERROR", e);
    return { balanceTxId: btId, feeTotal: null };
  }
}

/** Util: traite 1 refund Stripe (id re_...) : met à jour paiements + upsert remboursements */
async function processRefund(refund: Stripe.Refund) {
  const refundId = refund.id; // re_...
  const piId = (refund.payment_intent as string | null) ?? null;
  const amount = refund.amount || 0; // cents
  const status = refund.status || "unknown"; // 'succeeded' | 'pending' | 'failed' ...

  console.log("PROCESS_REFUND", refundId, "pi", piId, "amount", amount, "status", status);

  // 1) retrouver paiement
  let paiement: any = null;
  if (piId) {
    const { data: pay, error: payErr } = await supabase
      .from("paiements")
      .select("*")
      .or(`stripe_payment_intent.eq.${piId},stripe_payment_intent_id.eq.${piId}`)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (payErr) console.error("REFUND_PAYMENT_LOOKUP_ERROR", payErr);
    paiement = pay || null;
  }

  // 2) MAJ paiements (refunded_total + statut)
  if (paiement) {
    const prevRefunded = Number(paiement.refunded_total_cents || 0);
    const newRefundTotal = prevRefunded + Number(amount || 0);

    const total = Number(paiement.total_amount_cents || 0);
    let newStatus = "rembourse";
    if (total > 0 && newRefundTotal < total) newStatus = "partiellement_rembourse";

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

  // 3) Upsert remboursements : 1 ligne par refund re_...
  const { data: existing, error: exErr } = await supabase
    .from("remboursements")
    .select("id")
    .eq("stripe_refund_id", refundId)
    .maybeSingle();

  if (exErr) console.error("REFUND_EXISTING_LOOKUP_ERROR", exErr);

  const processedAt =
    status === "succeeded" ? new Date().toISOString() : null;

  // si on n'a pas paiement, on ne peut pas lier : on log seulement
  if (!paiement) {
    console.warn("NO_PAIEMENT_FOR_REFUND", refundId);
    return;
  }

  const inscription_id = paiement.inscription_ids?.[0] ?? null;

  // user_id : priorite au coureur_id de l'inscription si possible
  let user_id = paiement.user_id ?? null;
  if (inscription_id) {
    const { data: ins, error: insErr } = await supabase
      .from("inscriptions")
      .select("coureur_id")
      .eq("id", inscription_id)
      .maybeSingle();
    if (insErr) console.error("REFUND_INS_LOOKUP_ERROR", insErr);
    if (ins?.coureur_id) user_id = ins.coureur_id;
  }

  const payload = {
    paiement_id: paiement.id,
    inscription_id,
    user_id,
    policy_tier: "stripe_refund",
    percent: 100,
    amount_total_cents: paiement.total_amount_cents || amount || 0,
    base_cents: amount || 0,
    refund_cents: amount || 0,
    non_refundable_cents: 0,
    stripe_refund_id: refundId,
    status: status, // 'succeeded' etc
    processed_at: processedAt,
    reason: "Remboursement Stripe",
    // 🔥 V2 ledger: seul un refund réellement Stripe doit impacter la compta
    effective_refund: status === "succeeded",
    requested_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error: upErr } = await supabase
      .from("remboursements")
      .update(payload)
      .eq("id", existing.id);
    if (upErr) console.error("REFUND_REMBOURSEMENT_UPDATE_ERROR", upErr);
    else console.log("REFUND_REMBOURSEMENT_UPDATE_OK", existing.id);
  } else {
    const { error: insErr } = await supabase.from("remboursements").insert(payload);
    if (insErr) console.error("REFUND_REMBOURSEMENT_INSERT_ERROR", insErr);
    else console.log("REFUND_REMBOURSEMENT_INSERT_OK", refundId);
  }
}

serve(async (req) => {
  const headers = cors();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  console.log("STRIPE-WEBHOOK v6");

  let event: Stripe.Event;
  try {
    const body = await req.json();
    event = body as Stripe.Event;
  } catch (err) {
    console.error("WEBHOOK_PARSE_ERROR", err);
    return new Response(JSON.stringify({ error: "invalid_payload" }), {
      status: 400,
      headers,
    });
  }

  try {
    console.log("WEBHOOK_EVENT_TYPE", event.type);

    /* ====================================================================== */
    /* 1) checkout.session.completed → base paiement + inscriptions + emails  */
    /* ====================================================================== */
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const sessionId = session.id;

      console.log("CHECKOUT_COMPLETED_SESSION_ID", sessionId);

      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent as any)?.id || null;

      const meta = (session.metadata || {}) as Record<string, string>;
      let inscriptionIds: string[] = [];
      let groupIds: string[] = [];

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

          if (!inscs.error && inscs.data) {
            inscriptionIds = inscs.data.map((r: any) => r.id);
          } else if (inscs.error) {
            console.error("INSCRIPTIONS_FROM_GROUPS_ERROR", inscs.error);
          }
        }
      }

      const montant_total_cents = session.amount_total ?? null;
      const devise = session.currency || null;

      // Récup ligne paiements existante pour cette session
      const payRes = await supabase
        .from("paiements")
        .select("id, inscription_ids")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();

      if (payRes.error) console.error("PAYMENT_LOOKUP_ERROR", payRes.error);

      const existingInsIds = (payRes.data?.inscription_ids as string[] | null) || [];
      const finalInscriptionIds = inscriptionIds.length > 0 ? inscriptionIds : existingInsIds;

      // MAJ paiement (status paye)
      const upd = await supabase
        .from("paiements")
        .update({
          status: "paye",
          stripe_payment_intent_id: paymentIntentId,
          stripe_payment_intent: paymentIntentId,
          montant_total: montant_total_cents ? montant_total_cents / 100 : null,
          devise,
          amount_total: montant_total_cents,
          amount_subtotal: session.amount_subtotal ?? null,
          total_amount_cents: montant_total_cents,
          inscription_ids: finalInscriptionIds.length ? finalInscriptionIds : null,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_session_id", sessionId)
        .select("id")
        .maybeSingle();

      if (upd.error) console.error("PAYMENT_UPDATE_ERROR_CHECKOUT", upd.error);
      else console.log("PAYMENT_UPDATE_OK_CHECKOUT", upd.data?.id);

      // MAJ inscriptions + options + groupes
      if (finalInscriptionIds.length) {
        const u1 = await supabase.from("inscriptions").update({ statut: "paye" }).in("id", finalInscriptionIds);
        if (u1.error) console.error("INSCRIPTIONS_UPDATE_ERROR", u1.error);
        else console.log("INSCRIPTIONS_UPDATE_OK", finalInscriptionIds.length);

        const u2 = await supabase.from("inscriptions_options").update({ status: "confirmed" }).in("inscription_id", finalInscriptionIds);
        if (u2.error) console.error("OPTIONS_CONFIRM_ERROR", u2.error);

        const grpIdsRes = await supabase
          .from("inscriptions")
          .select("member_of_group_id")
          .in("id", finalInscriptionIds);

        const grpIdsUnique = [
          ...new Set((grpIdsRes.data || []).map((r: any) => r.member_of_group_id).filter(Boolean)),
        ];

        if (grpIdsUnique.length) {
          const u3 = await supabase.from("inscriptions_groupes").update({ statut: "paye" }).in("id", grpIdsUnique);
          if (u3.error) console.error("GROUPS_UPDATE_ERROR", u3.error);
        }

        // emails (un par inscription)
        for (const insId of finalInscriptionIds) {
          try {
            await callSendInscriptionEmail(insId);
          } catch (err) {
            console.error("CALL_SEND_INSCRIPTION_EMAIL_ERROR", insId, err);
          }
        }
      }
    }

    /* ====================================================================== */
    /* 2) payment_intent.succeeded → enrichir paiements (fee_total etc.)      */
    /* ====================================================================== */
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const paymentIntentId = pi.id;

      console.log("PI_SUCCEEDED_ID", paymentIntentId);

      const charge = pi.charges?.data?.[0] as Stripe.Charge | undefined;

      let receiptUrl: string | null = null;
      let chargeId: string | null = null;
      let balanceTxId: string | null = null;
      let feeTotal: number | null = null; // cents
      let platformFeeAmount: number | null = null;

      if (charge) {
        chargeId = charge.id;
        receiptUrl = (charge.receipt_url as string | null) ?? null;

        const feeInfo = await getStripeFeeFromCharge(charge);
        balanceTxId = feeInfo.balanceTxId;
        feeTotal = feeInfo.feeTotal;

        if (typeof charge.application_fee_amount === "number") {
          platformFeeAmount = charge.application_fee_amount;
        } else if (typeof (pi as any).application_fee_amount === "number") {
          platformFeeAmount = (pi as any).application_fee_amount;
        }
      }

      // retrouver la session checkout liée au PI
      const sessList = await stripe.checkout.sessions.list({
        payment_intent: paymentIntentId,
        limit: 1,
      });
      const sessionFromList = sessList.data?.[0] || null;
      const sessionId = sessionFromList?.id || null;

      if (!sessionId) {
        console.error("NO_SESSION_FOR_PI", paymentIntentId);
      } else {
        // IMPORTANT: on force fee_total en int cents si présent
        const feeTotalInt = typeof feeTotal === "number" ? Math.round(feeTotal) : null;

        const upd = await supabase
          .from("paiements")
          .update({
            stripe_payment_intent_id: paymentIntentId,
            stripe_payment_intent: paymentIntentId,
            stripe_charge_id: chargeId,
            charge_id: chargeId,
            receipt_url: receiptUrl,
            balance_transaction_id: balanceTxId,
            fee_total: feeTotalInt,
            platform_fee_amount: platformFeeAmount,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_session_id", sessionId)
          .select("id, fee_total, status")
          .maybeSingle();

        if (upd.error) {
          console.error("PAYMENT_UPDATE_ERROR_PI", upd.error);
        } else {
          console.log("PAYMENT_UPDATE_OK_PI", sessionId, "fee_total", upd.data?.fee_total);

          // OPTIONNEL: si tu veux déclencher l'ajustement ledger immédiatement (au lieu d'un trigger DB)
          // (à activer seulement si tu as la fonction SQL post_ledger_stripe_fee_adjustment)
          // if (upd.data?.id && upd.data?.status === "paye" && upd.data?.fee_total) {
          //   const r = await supabase.rpc("post_ledger_stripe_fee_adjustment", { p_paiement_id: upd.data.id });
          //   if (r.error) console.error("LEDGER_FEE_ADJUST_RPC_ERROR", r.error);
          // }
        }
      }
    }

    /* ====================================================================== */
    /* 3) Refunds (PROPRE)                                                    */
    /* ====================================================================== */
    // On évite charge.refunded car son object = Charge (source des ch_...).
    // On traite uniquement refund.created / refund.updated (object = Refund).
    if (event.type === "refund.created" || event.type === "refund.updated") {
      const refundObj = event.data.object as Stripe.Refund;
      await processRefund(refundObj);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e) {
    console.error("WEBHOOK_FATAL", e);
    return new Response(
      JSON.stringify({
        error: "webhook_failed",
        details: String((e as any)?.message ?? e),
      }),
      { status: 500, headers },
    );
  }
});

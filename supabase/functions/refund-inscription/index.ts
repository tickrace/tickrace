// supabase/functions/refund-inscription/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@16.6.0?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM =
  Deno.env.get("RESEND_FROM") || "Tickrace <no-reply@tickrace.com>";
const TICKRACE_BASE_URL =
  Deno.env.get("TICKRACE_BASE_URL") || "https://www.tickrace.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  httpClient: Stripe.createFetchHttpClient(),
});

function cors(h = new Headers()) {
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set(
    "Access-Control-Allow-Headers",
    "authorization, apikey, content-type, x-client-info, x-client-authorization, x-supabase-authorization",
  );
  h.set("content-type", "application/json; charset=utf-8");
  h.set("Vary", "Origin");
  return h;
}

// Même mapping que pour les équipes
const REASON_LABELS: Record<string, string> = {
  blessure_coureur: "Blessure ou problème de santé",
  indisponibilite_professionnelle: "Indisponibilité professionnelle",
  indisponibilite_familiale: "Indisponibilité familiale ou personnelle",
  probleme_logistique:
    "Problème logistique (transport, hébergement, covoiturage, etc.)",
  erreur_inscription: "Erreur d’inscription (format, doublon, etc.)",
  changement_objectif_sportif: "Changement d’objectif sportif",
  meteo_defavorable: "Prévision météo défavorable",
  autre_raison_personnelle: "Autre raison personnelle",
};

async function sendResendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !to) {
    return { ok: false, reason: "no_api_key_or_recipient" as const };
  }
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
    }),
  });

  const j = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error("RESEND_REFUND_ERROR", resp.status, j);
    return { ok: false, reason: j?.message || "resend_failed" };
  }
  return { ok: true };
}

serve(async (req) => {
  const headers = cors();

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers,
    });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.inscription_id) {
      return new Response(
        JSON.stringify({ error: "missing_inscription_id" }),
        {
          status: 400,
          headers,
        },
      );
    }

    const inscriptionId = String(body.inscription_id);

    // Nouveau : reason_code + texte libre
    const reasonCode: string | null = body.reason_code || null;
    const userReasonText: string | null = body.reason_text || body.reason || null;

    const reasonLabelFromCode =
      reasonCode && REASON_LABELS[reasonCode]
        ? `${reasonCode} – ${REASON_LABELS[reasonCode]}`
        : null;

    const finalReasonLabel =
      reasonLabelFromCode ||
      userReasonText ||
      "Annulation par le coureur depuis MonInscription";

    // 1) Calcul de la politique + montants via la fonction SQL
    const { data: credit, error: rpcError } = await supabase.rpc(
      "calculer_credit_annulation",
      { inscription_id: inscriptionId },
    );

    if (rpcError) {
      console.error("REMBOURSEMENT_RPC_ERROR", rpcError);
      return new Response(
        JSON.stringify({
          error: "credit_calculation_failed",
          details: rpcError.message,
        }),
        { status: 400, headers },
      );
    }

    if (!credit) {
      return new Response(
        JSON.stringify({ error: "no_credit_result" }),
        { status: 400, headers },
      );
    }

    const refundCents = Number(credit.refund_cents ?? 0);
    const totalCents = Number(
      credit.base_cents ?? credit.amount_total_cents ?? 0,
    );
    const percent = Number(credit.percent ?? 0);
    const policyTier = String(credit.policy_tier ?? "");
    const paiementId = String(credit.paiement_id ?? "");

    if (!paiementId) {
      return new Response(
        JSON.stringify({ error: "no_payment_for_inscription" }),
        { status: 400, headers },
      );
    }

    if (refundCents <= 0 || totalCents <= 0 || percent <= 0) {
      return new Response(
        JSON.stringify({
          error: "no_refund_allowed",
          percent,
          policyTier,
        }),
        { status: 400, headers },
      );
    }

    // 2) Récupérer le paiement et l’inscription
    const { data: paiement, error: payErr } = await supabase
      .from("paiements")
      .select("*")
      .eq("id", paiementId)
      .maybeSingle();

    if (payErr || !paiement) {
      console.error("REMBOURSEMENT_PAYMENT_LOOKUP_ERROR", payErr);
      return new Response(
        JSON.stringify({ error: "payment_not_found" }),
        { status: 400, headers },
      );
    }

    const { data: inscription, error: inscErr } = await supabase
      .from("inscriptions")
      .select("*")
      .eq("id", inscriptionId)
      .maybeSingle();

    if (inscErr || !inscription) {
      console.error("REMBOURSEMENT_INSCRIPTION_LOOKUP_ERROR", inscErr);
      return new Response(
        JSON.stringify({ error: "inscription_not_found" }),
        { status: 400, headers },
      );
    }

    // 3) Récupérer / reconstruire le PaymentIntent ID
    let paymentIntentId: string | null =
      (paiement.stripe_payment_intent as string | null) ||
      (paiement.stripe_payment_intent_id as string | null) ||
      null;

    if (!paymentIntentId && paiement.stripe_session_id) {
      try {
        const session = await stripe.checkout.sessions.retrieve(
          paiement.stripe_session_id as string,
          { expand: ["payment_intent"] },
        );
        const pi = session.payment_intent as Stripe.PaymentIntent | null;
        if (pi?.id) {
          paymentIntentId = pi.id;
          await supabase
            .from("paiements")
            .update({ stripe_payment_intent: pi.id })
            .eq("id", paiementId);
        }
      } catch (e) {
        console.error("REMBOURSEMENT_SESSION_FALLBACK_ERROR", e);
      }
    }

    if (!paymentIntentId) {
      console.error("NO_PAYMENT_INTENT_FOR_REFUND", {
        paiementId,
        inscriptionId,
      });
      return new Response(
        JSON.stringify({
          error: "no_payment_intent",
          message:
            "Paiement Stripe non lié à cette inscription (payment_intent introuvable).",
        }),
        { status: 400, headers },
      );
    }

    // 4) Déterminer le user_id pour la table remboursements
    const requesterUserId: string | null =
      (paiement.user_id as string | null) ||
      ((inscription.coureur_id as string | null) ?? null) ||
      (body.user_id ? String(body.user_id) : null);

    if (!requesterUserId) {
      return new Response(
        JSON.stringify({
          error: "missing_user_id",
          message: "Impossible de déterminer le compte utilisateur demandeur.",
        }),
        { status: 400, headers },
      );
    }

    // 5) Créer la ligne dans remboursements (status = requested)
    const nowIso = new Date().toISOString();
    const insertRes = await supabase
      .from("remboursements")
      .insert({
        paiement_id: paiementId,
        inscription_id: inscriptionId,
        user_id: requesterUserId,
        requested_at: nowIso,
        processed_at: null,
        policy_tier: policyTier,
        percent,
        amount_total_cents: totalCents,
        non_refundable_cents: totalCents - refundCents,
        base_cents: totalCents,
        refund_cents: refundCents,
        status: "requested",
        reason: finalReasonLabel,
        notes_admin: userReasonText || null,
      })
      .select("id")
      .maybeSingle();

    if (insertRes.error || !insertRes.data) {
      console.error("REMBOURSEMENT_INSERT_ERROR", insertRes.error);
      return new Response(
        JSON.stringify({ error: "refund_record_insert_failed" }),
        { status: 500, headers },
      );
    }

    const remboursementId = insertRes.data.id as string;

    // 6) Créer le refund Stripe
    const stripeRefund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: refundCents,
      reason: "requested_by_customer",
      metadata: {
        inscription_id: inscriptionId,
        remboursement_id: remboursementId,
        paiement_id: paiementId,
      },
    });

    // 7) Mettre à jour la ligne remboursement + paiement + inscription
    const updRefund = await supabase
      .from("remboursements")
      .update({
        stripe_refund_id: stripeRefund.id,
        status: "succeeded",
        processed_at: new Date().toISOString(),
      })
      .eq("id", remboursementId);

    if (updRefund.error) {
      console.error("REMBOURSEMENT_UPDATE_ERROR", updRefund.error);
    }

    const newRefundedTotal =
      Number(paiement.refunded_total_cents ?? 0) + refundCents;

    const updPay = await supabase
      .from("paiements")
      .update({
        refunded_total_cents: newRefundedTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paiementId);

    if (updPay.error) {
      console.error("PAYMENT_UPDATE_REFUNDED_ERROR", updPay.error);
    }

    const updInsc = await supabase
      .from("inscriptions")
      .update({
        statut: "annulé",
      })
      .eq("id", inscriptionId);

    if (updInsc.error) {
      console.error("INSCRIPTION_CANCEL_UPDATE_ERROR", updInsc.error);
    }

    // 8) Email de confirmation d’annulation
    const toEmail =
      (inscription.email as string | null) ||
      (paiement.email as string | null) ||
      null;

    if (toEmail) {
      const html = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
          <h2>Confirmation d’annulation</h2>
          <p>Votre inscription a été annulée. Un remboursement de <b>${(
            refundCents / 100
          ).toFixed(2)}&nbsp;€</b> a été demandé sur votre moyen de paiement initial.</p>
          <p>Politique appliquée : <b>${policyTier} (${percent}%)</b>.</p>
          ${
            reasonLabelFromCode
              ? `<p>Motif sélectionné : <b>${reasonLabelFromCode}</b></p>`
              : ""
          }
          ${
            userReasonText
              ? `<p>Détails fournis : <i>${userReasonText}</i></p>`
              : ""
          }
          <p>Vous pouvez consulter vos inscriptions ici : <a href="${TICKRACE_BASE_URL}/mesinscriptions">Mes inscriptions</a></p>
          <p style="color:#667085;font-size:12px">Référence remboursement Stripe : ${
            stripeRefund.id
          }</p>
        </div>
      `;
      const mailRes = await sendResendEmail(
        toEmail,
        "Tickrace – Confirmation d’annulation et remboursement",
        html,
      );
      if (!mailRes.ok) {
        console.error("REMBOURSEMENT_EMAIL_FAIL", mailRes);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        remboursement_id: remboursementId,
        stripe_refund_id: stripeRefund.id,
        refund_cents: refundCents,
        percent,
        policy_tier: policyTier,
      }),
      { status: 200, headers },
    );
  } catch (e) {
    console.error("REFUND_FATAL", e);
    return new Response(
      JSON.stringify({
        error: "refund_failed",
        details: e instanceof Error ? e.message : String(e),
      }),
      { status: 500, headers },
    );
  }
});

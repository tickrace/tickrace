// supabase/functions/request-team-refund/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@16.6.0?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "Tickrace <no-reply@tickrace.com>";
const TICKRACE_BASE_URL = Deno.env.get("TICKRACE_BASE_URL") || "https://www.tickrace.com";

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

// Codes de raison -> libellé
const REASON_LABELS: Record<string, string> = {
  blessure_coureur: "Blessure ou problème de santé d’un membre de l’équipe",
  indisponibilite_professionnelle: "Indisponibilité professionnelle",
  indisponibilite_familiale: "Indisponibilité familiale ou personnelle",
  probleme_logistique: "Problème logistique (transport, hébergement, etc.)",
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
    console.error("RESEND_TEAM_REFUND_ERROR", resp.status, j);
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
    if (!body || !body.groupe_id) {
      return new Response(JSON.stringify({ error: "missing_groupe_id" }), {
        status: 400,
        headers,
      });
    }

    const groupeId = String(body.groupe_id);

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
      "Annulation par le capitaine depuis MonInscriptionEquipe";

    // 1) Récupérer le groupe + format + course
    const { data: group, error: grpErr } = await supabase
      .from("inscriptions_groupes")
      .select(
        `
        *,
        format:format_id (
          id,
          nom,
          date,
          course:course_id (
            id,
            nom
          )
        )
      `,
      )
      .eq("id", groupeId)
      .maybeSingle();

    if (grpErr || !group) {
      console.error("TEAM_REFUND_GROUP_ERROR", grpErr);
      return new Response(
        JSON.stringify({ error: "group_not_found" }),
        { status: 400, headers },
      );
    }

    if (!group.paiement_id) {
      return new Response(
        JSON.stringify({ error: "no_payment_for_group" }),
        { status: 400, headers },
      );
    }

    const format = group.format;
    const course = format?.course;

    // 2) Récupérer le paiement
    const { data: paiement, error: payErr } = await supabase
      .from("paiements")
      .select("*")
      .eq("id", group.paiement_id)
      .maybeSingle();

    if (payErr || !paiement) {
      console.error("TEAM_REFUND_PAYMENT_LOOKUP_ERROR", payErr);
      return new Response(
        JSON.stringify({ error: "payment_not_found" }),
        { status: 400, headers },
      );
    }

    // 3) Calculer la politique d’annulation (même logique que simulate-team-refund)
    let baseCents = 0;

    if (paiement.total_amount_cents != null) {
      baseCents = Number(paiement.total_amount_cents) || 0;
    } else if (paiement.amount_total != null) {
      baseCents = Math.round(Number(paiement.amount_total) * 100) || 0;
    } else if (paiement.montant_total != null) {
      baseCents = Math.round(Number(paiement.montant_total) * 100) || 0;
    }

    if (baseCents <= 0) {
      return new Response(
        JSON.stringify({ error: "invalid_base_amount" }),
        { status: 400, headers },
      );
    }

    // Date de course pour l’écart en jours
    const raceDateStr: string | null = format?.date || null;
    if (!raceDateStr) {
      return new Response(
        JSON.stringify({ error: "missing_race_date" }),
        { status: 400, headers },
      );
    }

    const raceDate = new Date(raceDateStr);
    const now = new Date();

    const diffMs = raceDate.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let policyTier = "J-0-2";
    let percent = 0;

    if (diffDays >= 30) {
      policyTier = "J-30+";
      percent = 90;
    } else if (diffDays >= 15) {
      policyTier = "J-15-29";
      percent = 70;
    } else if (diffDays >= 7) {
      policyTier = "J-7-14";
      percent = 50;
    } else if (diffDays >= 3) {
      policyTier = "J-3-6";
      percent = 30;
    } else {
      policyTier = "J-0-2";
      percent = 0;
    }

    if (percent <= 0) {
      return new Response(
        JSON.stringify({
          error: "no_refund_allowed",
          policy_tier: policyTier,
          percent,
        }),
        { status: 400, headers },
      );
    }

    const refundCents = Math.round((baseCents * percent) / 100);
    const nonRefundableCents = baseCents - refundCents;

    // 4) Récupérer / reconstruire le PaymentIntent ID
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
            .eq("id", paiement.id);
        }
      } catch (e) {
        console.error("TEAM_REFUND_SESSION_FALLBACK_ERROR", e);
      }
    }

    if (!paymentIntentId) {
      return new Response(
        JSON.stringify({
          error: "no_payment_intent",
          message:
            "Paiement Stripe non lié à ce groupe (payment_intent introuvable).",
        }),
        { status: 400, headers },
      );
    }

    // 5) Déterminer le user_id demandeur
    const requesterUserId: string | null =
      (group.capitaine_user_id as string | null) ||
      (paiement.user_id as string | null) ||
      null;

    if (!requesterUserId) {
      return new Response(
        JSON.stringify({
          error: "missing_user_id",
          message: "Impossible de déterminer le compte utilisateur demandeur.",
        }),
        { status: 400, headers },
      );
    }

    // 6) Créer la ligne dans remboursements (status = requested)
    const nowIso = new Date().toISOString();

    const insertRes = await supabase
      .from("remboursements")
      .insert({
        paiement_id: paiement.id,
        inscription_id: null, // 👈 pour les groupes on laisse à null
        groupe_id: groupeId,
        user_id: requesterUserId,
        requested_at: nowIso,
        processed_at: null,
        policy_tier: policyTier,
        percent,
        amount_total_cents: baseCents,
        non_refundable_cents: nonRefundableCents,
        base_cents: baseCents,
        refund_cents: refundCents,
        status: "requested",
        reason: finalReasonLabel,
        notes_admin: userReasonText || null,
      })
      .select("id")
      .maybeSingle();

    if (insertRes.error || !insertRes.data) {
      console.error("TEAM_REFUND_INSERT_ERROR", insertRes.error);
      return new Response(
        JSON.stringify({ error: "refund_record_insert_failed" }),
        { status: 500, headers },
      );
    }

    const remboursementId = insertRes.data.id as string;

    // 7) Créer le refund Stripe
    const stripeRefund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: refundCents,
      reason: "requested_by_customer",
      metadata: {
        groupe_id: groupeId,
        remboursement_id: remboursementId,
        paiement_id: paiement.id,
        type: "team_refund",
      },
    });

    // 8) Mettre à jour remboursement + paiement + groupe + inscriptions
    const updRefund = await supabase
      .from("remboursements")
      .update({
        stripe_refund_id: stripeRefund.id,
        status: "succeeded",
        processed_at: new Date().toISOString(),
      })
      .eq("id", remboursementId);

    if (updRefund.error) {
      console.error("TEAM_REFUND_UPDATE_ERROR", updRefund.error);
    }

    const newRefundedTotal =
      Number(paiement.refunded_total_cents ?? 0) + refundCents;

    const updPay = await supabase
      .from("paiements")
      .update({
        refunded_total_cents: newRefundedTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paiement.id);

    if (updPay.error) {
      console.error("TEAM_PAYMENT_UPDATE_REFUNDED_ERROR", updPay.error);
    }

    // statut du groupe
    const updGroup = await supabase
      .from("inscriptions_groupes")
      .update({
        statut: "annule",
        updated_at: new Date().toISOString(),
      })
      .eq("id", groupeId);

    if (updGroup.error) {
      console.error("TEAM_GROUP_UPDATE_ERROR", updGroup.error);
    }

    // statut des membres
    const updMembers = await supabase
      .from("inscriptions")
      .update({ statut: "annulé" })
      .eq("groupe_id", groupeId)
      .or(`member_of_group_id.eq.${groupeId}`);

    if (updMembers.error) {
      console.error("TEAM_MEMBERS_UPDATE_ERROR", updMembers.error);
    }

    // 9) Email de confirmation (payer ou premier membre)
    let toEmail: string | null = (paiement.email as string | null) || null;

    if (!toEmail) {
      const { data: members, error: memErr } = await supabase
        .from("inscriptions")
        .select("email")
        .or(`groupe_id.eq.${groupeId},member_of_group_id.eq.${groupeId}`)
        .order("created_at", { ascending: true });
      if (!memErr && members?.length) {
        toEmail =
          (members.find((m) => m.email)?.email as string | null) || null;
      }
    }

    if (toEmail) {
      const courseName = course?.nom || "course";
      const teamName = group.team_name || group.nom_groupe || "équipe";

      const html = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
          <h2>Confirmation d’annulation – inscription équipe</h2>
          <p>Votre inscription d’équipe <b>${teamName}</b> sur <b>${courseName}</b> a été annulée.</p>
          <p>Un remboursement de <b>${(refundCents / 100).toFixed(
            2,
          )}&nbsp;€</b> a été demandé sur votre moyen de paiement initial.</p>
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
        "Tickrace – Confirmation d’annulation de votre équipe",
        html,
      );
      if (!mailRes.ok) {
        console.error("TEAM_REFUND_EMAIL_FAIL", mailRes);
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
    console.error("TEAM_REFUND_FATAL", e);
    return new Response(
      JSON.stringify({
        error: "team_refund_failed",
        details: e instanceof Error ? e.message : String(e),
      }),
      { status: 500, headers },
    );
  }
});

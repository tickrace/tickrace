// supabase/functions/request-team-refund/index.ts
// deno-lint-ignore-file no-explicit-any
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
const stripe = new Stripe(STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });

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
  if (!RESEND_API_KEY || !to) return { ok: false, reason: "no_api_key_or_recipient" as const };

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
  });

  const j = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error("RESEND_TEAM_REFUND_ERROR", resp.status, j);
    return { ok: false, reason: j?.message || "resend_failed" };
  }
  return { ok: true };
}

function clampInt(n: number, min: number, max: number) {
  const x = Math.floor(Number(n) || 0);
  return Math.max(min, Math.min(max, x));
}

function toCentsFromPaiement(p: any) {
  let baseCents = 0;

  if (p?.total_amount_cents != null) baseCents = Number(p.total_amount_cents) || 0;
  else if (p?.amount_total != null) baseCents = Math.round(Number(p.amount_total) * 100) || 0;
  else if (p?.montant_total != null) baseCents = Math.round(Number(p.montant_total) * 100) || 0;

  return Math.max(0, Math.round(baseCents));
}

function computePolicyPercent(diffDays: number) {
  // même logique que ton simulate-team-refund
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

  return { policyTier, percent };
}

serve(async (req) => {
  const headers = cors();

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.groupe_id) {
      return new Response(JSON.stringify({ error: "missing_groupe_id" }), { status: 400, headers });
    }

    const groupeId = String(body.groupe_id);

    // reason_code + texte libre
    const reasonCode: string | null = body.reason_code || null;
    const userReasonText: string | null = body.reason_text || body.reason || null;

    const reasonLabelFromCode =
      reasonCode && REASON_LABELS[reasonCode] ? `${reasonCode} – ${REASON_LABELS[reasonCode]}` : null;

    const finalReasonLabel =
      reasonLabelFromCode || userReasonText || "Annulation par le capitaine depuis MonInscriptionEquipe";

    // 0) Idempotence : si déjà un remboursement requested/succeeded pour ce groupe => OK (évite double-refund)
    {
      const { data: existing, error: exErr } = await supabase
        .from("remboursements")
        .select("id, stripe_refund_id, refund_cents, status")
        .eq("groupe_id", groupeId)
        .in("status", ["requested", "succeeded"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!exErr && existing?.id && (existing.status === "succeeded" || existing.status === "requested")) {
        return new Response(
          JSON.stringify({
            ok: true,
            already: true,
            remboursement_id: existing.id,
            stripe_refund_id: existing.stripe_refund_id || null,
            refund_cents: existing.refund_cents || null,
            status: existing.status,
          }),
          { status: 200, headers },
        );
      }
    }

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
      return new Response(JSON.stringify({ error: "group_not_found" }), { status: 400, headers });
    }

    if (!group.paiement_id) {
      return new Response(JSON.stringify({ error: "no_payment_for_group" }), { status: 400, headers });
    }

    const format = group.format;
    const course = format?.course;

    // 2) Paiement
    const { data: paiement, error: payErr } = await supabase
      .from("paiements")
      .select("*")
      .eq("id", group.paiement_id)
      .maybeSingle();

    if (payErr || !paiement) {
      console.error("TEAM_REFUND_PAYMENT_LOOKUP_ERROR", payErr);
      return new Response(JSON.stringify({ error: "payment_not_found" }), { status: 400, headers });
    }

    // 3) Base cents + clamp en fonction du déjà remboursé
    const baseCents = toCentsFromPaiement(paiement);
    if (baseCents <= 0) {
      return new Response(JSON.stringify({ error: "invalid_base_amount" }), { status: 400, headers });
    }

    const alreadyRefunded = clampInt(Number(paiement.refunded_total_cents ?? 0), 0, 10_000_000_000);
    const availableToRefund = Math.max(0, baseCents - alreadyRefunded);
    if (availableToRefund <= 0) {
      return new Response(JSON.stringify({ error: "nothing_left_to_refund" }), { status: 400, headers });
    }

    // 4) Politique d’annulation
    const raceDateStr: string | null = format?.date || null;
    if (!raceDateStr) return new Response(JSON.stringify({ error: "missing_race_date" }), { status: 400, headers });

    const raceDate = new Date(raceDateStr);
    const now = new Date();
    const diffDays = Math.floor((raceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const { policyTier, percent } = computePolicyPercent(diffDays);

    if (percent <= 0) {
      return new Response(
        JSON.stringify({ error: "no_refund_allowed", policy_tier: policyTier, percent }),
        { status: 400, headers },
      );
    }

    // refund calculé mais jamais au-delà de ce qu'il reste à rembourser
    const desiredRefund = Math.round((baseCents * percent) / 100);
    const refundCents = clampInt(desiredRefund, 0, availableToRefund);
    const nonRefundableCents = baseCents - refundCents;

    if (refundCents <= 0) {
      return new Response(JSON.stringify({ error: "refund_zero_after_clamp" }), { status: 400, headers });
    }

    // 5) PaymentIntent
    let paymentIntentId: string | null =
      (paiement.stripe_payment_intent as string | null) ||
      (paiement.stripe_payment_intent_id as string | null) ||
      null;

    if (!paymentIntentId && paiement.stripe_session_id) {
      try {
        const session = await stripe.checkout.sessions.retrieve(paiement.stripe_session_id as string, {
          expand: ["payment_intent"],
        });
        const pi = session.payment_intent as Stripe.PaymentIntent | null;
        if (pi?.id) {
          paymentIntentId = pi.id;
          await supabase.from("paiements").update({ stripe_payment_intent: pi.id }).eq("id", paiement.id);
        }
      } catch (e) {
        console.error("TEAM_REFUND_SESSION_FALLBACK_ERROR", e);
      }
    }

    if (!paymentIntentId) {
      return new Response(
        JSON.stringify({
          error: "no_payment_intent",
          message: "Paiement Stripe non lié à ce groupe (payment_intent introuvable).",
        }),
        { status: 400, headers },
      );
    }

    // 6) Anchor inscription (critique pour ledger / rattachement course/orga)
    let anchorInscriptionId: string | null =
      (paiement.anchor_inscription_id as string | null) ||
      (paiement.inscription_id as string | null) ||
      (Array.isArray(paiement.inscription_ids) && paiement.inscription_ids.length
        ? (paiement.inscription_ids[0] as string)
        : null) ||
      null;

    if (!anchorInscriptionId) {
      const { data: firstIns, error: firstErr } = await supabase
        .from("inscriptions")
        .select("id")
        .or(`groupe_id.eq.${groupeId},member_of_group_id.eq.${groupeId}`)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (firstErr) console.error("TEAM_REFUND_ANCHOR_INS_LOOKUP_ERROR", firstErr);
      anchorInscriptionId = firstIns?.id ?? null;
    }

    if (anchorInscriptionId && !paiement.anchor_inscription_id) {
      await supabase.from("paiements").update({ anchor_inscription_id: anchorInscriptionId }).eq("id", paiement.id);
    }

    // 7) Demandeur
    const requesterUserId: string | null =
      (group.capitaine_user_id as string | null) || (paiement.user_id as string | null) || null;

    if (!requesterUserId) {
      return new Response(
        JSON.stringify({ error: "missing_user_id", message: "Impossible de déterminer le compte utilisateur demandeur." }),
        { status: 400, headers },
      );
    }

    // 8) Insert remboursements (status requested), AVEC inscription_id = anchor
    const nowIso = new Date().toISOString();

    const insertRes = await supabase
      .from("remboursements")
      .insert({
        paiement_id: paiement.id,
        inscription_id: anchorInscriptionId, // ✅ CRITIQUE (au lieu de null)
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
        effective_refund: false,
      })
      .select("id")
      .maybeSingle();

    if (insertRes.error || !insertRes.data) {
      console.error("TEAM_REFUND_INSERT_ERROR", insertRes.error);
      return new Response(JSON.stringify({ error: "refund_record_insert_failed" }), { status: 500, headers });
    }

    const remboursementId = insertRes.data.id as string;

    // 9) Refund Stripe (idempotence key)
    const idempotencyKey = `team_refund:${paiement.id}:${groupeId}:${remboursementId}`;

    const stripeRefund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        amount: refundCents,
        reason: "requested_by_customer",
        metadata: {
          groupe_id: groupeId,
          remboursement_id: remboursementId,
          paiement_id: paiement.id,
          anchor_inscription_id: anchorInscriptionId || "",
          type: "team_refund",
        },
      },
      // @ts-ignore Stripe Deno supports request options
      { idempotencyKey },
    );

    // 10) Update remboursement => succeeded
    const updRefund = await supabase
      .from("remboursements")
      .update({
        stripe_refund_id: stripeRefund.id,
        status: "succeeded",
        processed_at: new Date().toISOString(),
        effective_refund: true, // ✅ IMPORTANT (déclenche ledger si trigger filtré)
      })
      .eq("id", remboursementId);

    if (updRefund.error) console.error("TEAM_REFUND_UPDATE_ERROR", updRefund.error);

    // 11) Update paiement refunded_total_cents
    const newRefundedTotal = alreadyRefunded + refundCents;

    const updPay = await supabase
      .from("paiements")
      .update({
        refunded_total_cents: newRefundedTotal,
        status: newRefundedTotal >= baseCents ? "rembourse" : "partiellement_rembourse",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paiement.id);

    if (updPay.error) console.error("TEAM_PAYMENT_UPDATE_REFUNDED_ERROR", updPay.error);

    // 12) Update groupe statut
    const updGroup = await supabase
      .from("inscriptions_groupes")
      .update({ statut: "annule", updated_at: new Date().toISOString() })
      .eq("id", groupeId);

    if (updGroup.error) console.error("TEAM_GROUP_UPDATE_ERROR", updGroup.error);

    // 13) Update membres statut (✅ correct : OR unique)
    const updMembers = await supabase
      .from("inscriptions")
      .update({ statut: "annulé" })
      .or(`groupe_id.eq.${groupeId},member_of_group_id.eq.${groupeId}`);

    if (updMembers.error) console.error("TEAM_MEMBERS_UPDATE_ERROR", updMembers.error);

    // 14) Email de confirmation (payer ou premier membre)
    let toEmail: string | null = (paiement.email as string | null) || null;

    if (!toEmail) {
      const { data: members, error: memErr } = await supabase
        .from("inscriptions")
        .select("email")
        .or(`groupe_id.eq.${groupeId},member_of_group_id.eq.${groupeId}`)
        .order("created_at", { ascending: true });

      if (!memErr && members?.length) {
        toEmail = (members.find((m) => m.email)?.email as string | null) || null;
      }
    }

    if (toEmail) {
      const courseName = course?.nom || "course";
      const teamName = group.team_name || group.nom_groupe || "équipe";

      const html = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
          <h2>Confirmation d’annulation – inscription équipe</h2>
          <p>Votre inscription d’équipe <b>${teamName}</b> sur <b>${courseName}</b> a été annulée.</p>
          <p>Un remboursement de <b>${(refundCents / 100).toFixed(2)}&nbsp;€</b> a été demandé sur votre moyen de paiement initial.</p>
          <p>Politique appliquée : <b>${policyTier} (${percent}%)</b>.</p>
          ${reasonLabelFromCode ? `<p>Motif sélectionné : <b>${reasonLabelFromCode}</b></p>` : ""}
          ${userReasonText ? `<p>Détails fournis : <i>${userReasonText}</i></p>` : ""}
          <p>Vous pouvez consulter vos inscriptions ici : <a href="${TICKRACE_BASE_URL}/mesinscriptions">Mes inscriptions</a></p>
          <p style="color:#667085;font-size:12px">Référence remboursement Stripe : ${stripeRefund.id}</p>
        </div>
      `;

      const mailRes = await sendResendEmail(toEmail, "Tickrace – Confirmation d’annulation de votre équipe", html);
      if (!mailRes.ok) console.error("TEAM_REFUND_EMAIL_FAIL", mailRes);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        remboursement_id: remboursementId,
        stripe_refund_id: stripeRefund.id,
        refund_cents: refundCents,
        percent,
        policy_tier: policyTier,
        anchor_inscription_id: anchorInscriptionId,
        available_to_refund_cents: availableToRefund,
      }),
      { status: 200, headers },
    );
  } catch (e) {
    console.error("TEAM_REFUND_FATAL", e);
    return new Response(
      JSON.stringify({ error: "team_refund_failed", details: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers },
    );
  }
});

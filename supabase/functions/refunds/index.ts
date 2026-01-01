// supabase/functions/refunds/index.ts
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@16.6.0?target=deno";

console.log("BUILD refunds v3 (aligned with team-refund + ledger v3)");

/* ------------------------------ ENV ------------------------------ */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "Tickrace <no-reply@tickrace.com>";
const TICKRACE_BASE_URL = Deno.env.get("TICKRACE_BASE_URL") || "https://www.tickrace.com";

/* --------------------------- Clients ----------------------------- */
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });

/* ------------------------------ CORS ------------------------------ */
const ALLOWLIST = ["https://www.tickrace.com", "http://localhost:5173", "http://127.0.0.1:5173"];
function cors(req: Request, h = new Headers()) {
  const o = req.headers.get("origin");
  const allow = o && ALLOWLIST.includes(o) ? o : ALLOWLIST[0];
  h.set("Access-Control-Allow-Origin", allow);
  h.set("Vary", "Origin");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type, prefer");
  h.set("Access-Control-Max-Age", "86400");
  h.set("content-type", "application/json; charset=utf-8");
  return h;
}

/* ------------------------------ Utils ----------------------------- */
const isUUID = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v as string);

const REASON_LABELS: Record<string, string> = {
  blessure_coureur: "Blessure ou problème de santé",
  indisponibilite_professionnelle: "Indisponibilité professionnelle",
  indisponibilite_familiale: "Indisponibilité familiale/personnelle",
  probleme_logistique: "Problème logistique",
  erreur_inscription: "Erreur d’inscription",
  changement_objectif_sportif: "Changement d’objectif sportif",
  meteo_defavorable: "Prévision météo défavorable",
  autre_raison_personnelle: "Autre raison personnelle",
};

function clampInt(n: number, min: number, max: number) {
  const x = Math.floor(Number(n) || 0);
  return Math.max(min, Math.min(max, x));
}

function toCentsFromPaiement(p: any) {
  let baseCents = 0;
  if (p?.total_amount_cents != null) baseCents = Number(p.total_amount_cents) || 0;
  else if (p?.amount_total != null) baseCents = Number(p.amount_total) || 0; // chez toi amount_total est souvent déjà en cents
  else if (p?.montant_total != null) baseCents = Math.round(Number(p.montant_total) * 100) || 0;
  return Math.max(0, Math.round(baseCents));
}

// Politique ALIGNEE request-team-refund
function computePolicyPercent(diffDays: number) {
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

async function sendResendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !to) return { ok: false as const, reason: "no_api_key_or_to" as const };

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
  });

  const j = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error("RESEND_REFUNDS_ERROR", resp.status, j);
    return { ok: false as const, reason: j?.message || "resend_failed" };
  }
  return { ok: true as const };
}

/** Cherche la ligne paiement correspondant à une inscription */
async function findPaiementForInscription(inscriptionId: string) {
  // A) lien direct (individuel)
  {
    const { data, error } = await supabase
      .from("paiements")
      .select("*")
      .eq("inscription_id", inscriptionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) console.error("PAY_FIND_DIRECT_ERROR", error);
    if (data) return data;
  }

  // B) via tableau inscription_ids[] (souvent équipe)
  try {
    const { data, error } = await supabase
      .from("paiements")
      .select("*")
      .contains("inscription_ids", [inscriptionId])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) console.error("PAY_FIND_CONTAINS_ERROR", error);
    if (data) return data;
  } catch {
    // ignore
  }

  // C) via groupe -> paiement_id
  const { data: insc, error: iErr } = await supabase
    .from("inscriptions")
    .select("groupe_id")
    .eq("id", inscriptionId)
    .maybeSingle();

  if (iErr) console.error("PAY_FIND_INS_GROUP_ERROR", iErr);

  if (insc?.groupe_id) {
    const { data: grp, error: gErr } = await supabase
      .from("inscriptions_groupes")
      .select("paiement_id")
      .eq("id", insc.groupe_id)
      .maybeSingle();
    if (gErr) console.error("PAY_FIND_GRP_ERROR", gErr);

    if (grp?.paiement_id) {
      const { data: pByGrp, error: pErr } = await supabase.from("paiements").select("*").eq("id", grp.paiement_id).maybeSingle();
      if (pErr) console.error("PAY_FIND_GRP_PAY_ERROR", pErr);
      if (pByGrp) return pByGrp;
    }
  }

  return null;
}

async function resolveUserIdForRefund(args: { inscription: any; paiement: any; groupe_id?: string | null }) {
  // 1) inscription.coureur_id
  if (args.inscription?.coureur_id) return String(args.inscription.coureur_id);

  // 2) paiement.user_id
  if (args.paiement?.user_id) return String(args.paiement.user_id);

  // 3) groupe.capitaine_user_id
  if (args.groupe_id) {
    const { data: grp, error } = await supabase
      .from("inscriptions_groupes")
      .select("capitaine_user_id")
      .eq("id", args.groupe_id)
      .maybeSingle();
    if (error) console.error("REFUND_USER_FROM_GROUP_ERROR", error);
    if (grp?.capitaine_user_id) return String(grp.capitaine_user_id);
  }

  // 4) fallback: premier membre du groupe
  if (args.groupe_id) {
    const { data: mem, error } = await supabase
      .from("inscriptions")
      .select("coureur_id")
      .or(`groupe_id.eq.${args.groupe_id},member_of_group_id.eq.${args.groupe_id}`)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) console.error("REFUND_USER_FROM_FIRST_MEMBER_ERROR", error);
    if (mem?.coureur_id) return String(mem.coureur_id);
  }

  return null;
}

async function resolvePaymentIntentId(paiement: any): Promise<string | null> {
  let pi =
    (paiement?.stripe_payment_intent as string | null) ||
    (paiement?.stripe_payment_intent_id as string | null) ||
    null;

  if (pi) return pi;

  if (paiement?.stripe_session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(String(paiement.stripe_session_id), {
        expand: ["payment_intent"],
      });
      const sPI = session.payment_intent as Stripe.PaymentIntent | null;
      if (sPI?.id) {
        pi = sPI.id;
        await supabase
          .from("paiements")
          .update({ stripe_payment_intent: pi, stripe_payment_intent_id: pi })
          .eq("id", paiement.id);
        return pi;
      }
    } catch (e) {
      console.error("PI_SESSION_FALLBACK_ERROR", e);
    }
  }

  return null;
}

/* ------------------------------ Handler -------------------------- */
serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers });

  try {
    const { inscription_id, action, reason, reason_code, reason_text } = await req.json().catch(() => ({}));

    if (!isUUID(inscription_id)) {
      return new Response(JSON.stringify({ error: "inscription_id invalide" }), { status: 400, headers });
    }
    if (!action || !["quote", "confirm"].includes(action)) {
      return new Response(JSON.stringify({ error: "action invalide (quote|confirm)" }), { status: 400, headers });
    }

    const reasonCode: string | null = reason_code || null;
    const userReasonText: string | null = reason_text || reason || null;
    const reasonLabelFromCode =
      reasonCode && REASON_LABELS[reasonCode] ? `${reasonCode} – ${REASON_LABELS[reasonCode]}` : null;
    const finalReasonLabel = reasonLabelFromCode || userReasonText || "Annulation depuis MonInscription";

    // 1) Charger inscription + format(date) + course(nom)
    const { data: insc, error: errInsc } = await supabase
      .from("inscriptions")
      .select(
        `
        id, format_id, groupe_id, member_of_group_id, statut, email, prenom, nom, coureur_id,
        format:format_id (
          id, nom, date,
          course:course_id ( id, nom )
        )
      `,
      )
      .eq("id", inscription_id)
      .maybeSingle();

    if (errInsc || !insc) {
      console.error("INSCRIPTION_LOOKUP_ERROR", errInsc);
      return new Response(JSON.stringify({ error: "Inscription introuvable" }), { status: 404, headers });
    }

    const groupeId = (insc.groupe_id as string | null) || (insc.member_of_group_id as string | null) || null;
    const fmt = insc.format;
    const course = fmt?.course;

    // 2) Retrouver paiement
    const paiement = await findPaiementForInscription(inscription_id);
    if (!paiement) {
      return new Response(JSON.stringify({ error: "Paiement introuvable pour cette inscription" }), { status: 404, headers });
    }

    // ⚠️ Important : si paiement “équipe”, on bloque l’individuel (sinon tu risques de rembourser le total équipe)
    const isTeamPayment =
      (paiement?.type && String(paiement.type).toLowerCase() === "groupe") ||
      (Array.isArray(paiement?.inscription_ids) && paiement.inscription_ids.length > 1) ||
      !!groupeId;

    if (isTeamPayment) {
      return new Response(
        JSON.stringify({
          error: "team_payment_detected",
          message:
            "Cette inscription fait partie d’un paiement équipe. Utilise la fonction de remboursement équipe (request-team-refund) pour éviter un remboursement erroné.",
          groupe_id: groupeId,
          paiement_id: paiement.id,
        }),
        { status: 409, headers },
      );
    }

    // 3) Idempotence DB (évite double refund)
    {
      const { data: existing, error } = await supabase
        .from("remboursements")
        .select("id, stripe_refund_id, refund_cents, status, effective_refund")
        .eq("inscription_id", inscription_id)
        .in("status", ["requested", "succeeded"])
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && existing?.id) {
        return new Response(
          JSON.stringify({
            ok: true,
            already: true,
            remboursement_id: existing.id,
            stripe_refund_id: existing.stripe_refund_id || null,
            refund_cents: existing.refund_cents || 0,
            status: existing.status,
            effective_refund: !!existing.effective_refund,
          }),
          { status: 200, headers },
        );
      }
    }

    // 4) Montants + clamp déjà remboursé
    const amount_total_cents = toCentsFromPaiement(paiement);
    const alreadyRefunded = clampInt(Number(paiement.refunded_total_cents ?? 0), 0, 10_000_000_000);
    const availableToRefund = Math.max(0, amount_total_cents - alreadyRefunded);

    if (amount_total_cents <= 0) {
      return new Response(JSON.stringify({ error: "invalid_base_amount" }), { status: 400, headers });
    }
    if (availableToRefund <= 0) {
      return new Response(JSON.stringify({ error: "nothing_left_to_refund" }), { status: 400, headers });
    }

    // 5) Politique
    const raceDateStr: string | null = fmt?.date || null;
    if (!raceDateStr) return new Response(JSON.stringify({ error: "missing_race_date" }), { status: 400, headers });

    const raceDate = new Date(raceDateStr);
    const now = new Date();
    const diffDays = Math.floor((raceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const { policyTier, percent } = computePolicyPercent(diffDays);

    // refund calculé (comme team) : percent * total, puis clamp à ce qu’il reste
    const desiredRefund = Math.round((amount_total_cents * percent) / 100);
    const refund_cents = clampInt(desiredRefund, 0, availableToRefund);
    const non_refundable_cents = amount_total_cents - refund_cents;

    if (action === "quote") {
      return new Response(
        JSON.stringify({
          ok: true,
          quote: {
            amount_total_cents,
            already_refunded_cents: alreadyRefunded,
            available_to_refund_cents: availableToRefund,
            non_refundable_cents,
            base_cents: amount_total_cents,
            refund_cents,
            percent,
            policy_tier: policyTier,
            days_before: diffDays,
            paiement_id: paiement.id,
          },
        }),
        { status: 200, headers },
      );
    }

    // action === confirm

    // 6) user_id (NOT NULL)
    const user_id = await resolveUserIdForRefund({ inscription: insc, paiement, groupe_id: groupeId });
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "missing_user_id", message: "Impossible de déterminer user_id pour ce remboursement." }),
        { status: 409, headers },
      );
    }

    // 7) PaymentIntent
    const piId = await resolvePaymentIntentId(paiement);
    if (!piId) {
      return new Response(JSON.stringify({ error: "no_payment_intent" }), { status: 409, headers });
    }

    // (utile pour ledger/refunds)
    if (!paiement.anchor_inscription_id) {
      await supabase.from("paiements").update({ anchor_inscription_id: inscription_id }).eq("id", paiement.id);
    }

    // 8) Si barème => 0%, on annule sans remboursement financier
    if (refund_cents <= 0) {
      await supabase.from("inscriptions").update({ statut: "annulé", cancelled_at: new Date().toISOString() }).eq("id", inscription_id);
      await supabase.from("inscriptions_options").update({ status: "canceled" }).eq("inscription_id", inscription_id).eq("status", "confirmed");

      // on trace quand même en DB (mais effective_refund=false => pas de ledger)
      const { data: rembIns, error: rErr } = await supabase
        .from("remboursements")
        .insert({
          paiement_id: paiement.id,
          inscription_id,
          groupe_id: null,
          user_id,
          policy_tier: policyTier,
          percent,
          amount_total_cents,
          non_refundable_cents: amount_total_cents, // tout non remboursable
          base_cents: amount_total_cents,
          refund_cents: 0,
          stripe_refund_id: null,
          status: "succeeded",
          reason: finalReasonLabel,
          notes_admin: userReasonText || null,
          processed_at: new Date().toISOString(),
          effective_refund: false,
          requested_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();

      if (rErr) console.error("REFUND_ZERO_INSERT_ERROR", rErr);

      return new Response(
        JSON.stringify({ ok: true, refund_cents: 0, stripe_refund_id: null, remboursement_id: rembIns?.id ?? null }),
        { status: 200, headers },
      );
    }

    // 9) Insert remboursement (requested)
    const insReq = await supabase
      .from("remboursements")
      .insert({
        paiement_id: paiement.id,
        inscription_id,
        groupe_id: null,
        user_id,
        requested_at: new Date().toISOString(),
        processed_at: null,
        policy_tier: policyTier,
        percent,
        amount_total_cents,
        non_refundable_cents,
        base_cents: amount_total_cents,
        refund_cents,
        status: "requested",
        reason: finalReasonLabel,
        notes_admin: userReasonText || null,
        effective_refund: false,
      })
      .select("id")
      .maybeSingle();

    if (insReq.error || !insReq.data?.id) {
      console.error("REFUND_REMBOURSEMENT_INSERT_ERROR", insReq.error);
      return new Response(JSON.stringify({ error: "refund_record_insert_failed" }), { status: 500, headers });
    }

    const remboursementId = String(insReq.data.id);

    // 10) Stripe refund (idempotency)
    const idempotencyKey = `refund:${paiement.id}:${inscription_id}:${remboursementId}`;

    const sRefund = await stripe.refunds.create(
      {
        payment_intent: piId,
        amount: refund_cents,
        reason: "requested_by_customer",
        metadata: {
          remboursement_id: remboursementId,
          paiement_id: String(paiement.id),
          inscription_id: String(inscription_id),
          type: "individual_refund",
        },
      },
      // @ts-ignore
      { idempotencyKey },
    );

    // 11) Update remboursement => succeeded + effective_refund=true (déclenche ledger v3)
    const upR = await supabase
      .from("remboursements")
      .update({
        stripe_refund_id: sRefund.id,
        status: "succeeded",
        processed_at: new Date().toISOString(),
        effective_refund: true,
      })
      .eq("id", remboursementId);

    if (upR.error) console.error("REFUND_REMBOURSEMENT_UPDATE_ERROR", upR.error);

    // 12) Update paiement refunded_total_cents (+ status)
    const newRefundedTotal = alreadyRefunded + refund_cents;

    const total = clampInt(Number(paiement.total_amount_cents || amount_total_cents), 0, 10_000_000_000);
    let payStatus = "rembourse";
    if (total > 0 && newRefundedTotal < total) payStatus = "partiellement_rembourse";

    const upP = await supabase
      .from("paiements")
      .update({
        refunded_total_cents: newRefundedTotal,
        status: payStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paiement.id);

    if (upP.error) console.error("REFUND_PAIEMENTS_UPDATE_ERROR", upP.error);

    // 13) Statuts inscription + options
    await supabase.from("inscriptions").update({ statut: "annulé", cancelled_at: new Date().toISOString() }).eq("id", inscription_id);
    await supabase.from("inscriptions_options").update({ status: "canceled" }).eq("inscription_id", inscription_id).eq("status", "confirmed");

    // 14) Email (optionnel)
    const toEmail = insc?.email ? String(insc.email) : null;
    if (toEmail) {
      const displayName = [insc.prenom, insc.nom].filter(Boolean).join(" ") || "coureur/coureuse";
      const courseName = course?.nom || "course";
      const formatName = fmt?.nom || "format";

      const html = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
          <h2>Confirmation d’annulation</h2>
          <p>Bonjour <b>${displayName}</b>,</p>
          <p>Ton inscription à <b>${courseName}</b> – <b>${formatName}</b> a été annulée.</p>
          <p>Un remboursement de <b>${(refund_cents / 100).toFixed(2)} €</b> a été demandé sur ton moyen de paiement initial.</p>
          <p>Politique appliquée : <b>${policyTier} (${percent}%)</b>.</p>
          ${reasonLabelFromCode ? `<p>Motif : <b>${reasonLabelFromCode}</b></p>` : ""}
          ${userReasonText ? `<p>Détails : <i>${userReasonText}</i></p>` : ""}
          <p>Retrouve tes inscriptions : <a href="${TICKRACE_BASE_URL}/mesinscriptions">Mes inscriptions</a></p>
          <p style="color:#667085;font-size:12px">Référence Stripe : ${sRefund.id}</p>
        </div>
      `;

      const mailRes = await sendResendEmail(toEmail, "Tickrace – Confirmation d’annulation", html);
      if (!mailRes.ok) console.error("REFUND_EMAIL_FAIL", mailRes);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        remboursement_id: remboursementId,
        stripe_refund_id: sRefund.id,
        refund_cents,
        percent,
        policy_tier: policyTier,
      }),
      { status: 200, headers },
    );
  } catch (e: any) {
    console.error("refunds error:", e?.message ?? e, e?.stack);
    const debug = Deno.env.get("DEBUG") === "1";
    return new Response(JSON.stringify({ error: debug ? (e?.message ?? "Erreur serveur") : "Erreur serveur" }), {
      status: 500,
      headers,
    });
  }
});

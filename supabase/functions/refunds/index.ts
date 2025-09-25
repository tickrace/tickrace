// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0&pin=v135";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0&pin=v135";

console.log("BUILD refunds 2025-09-22T22:30Z");

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const ALLOWLIST = ["https://www.tickrace.com","http://localhost:5173","http://127.0.0.1:5173"];
function cors(req: Request) {
  const o = req.headers.get("origin");
  const allow = o && ALLOWLIST.includes(o) ? o : ALLOWLIST[0];
  const reqMethod = req.headers.get("access-control-request-method") || "POST";
  const reqHeaders = req.headers.get("access-control-request-headers") || "authorization, x-client-info, apikey, content-type, prefer";
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": `${reqMethod}, OPTIONS`,
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}
const isUUID = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v as string);

// --------- Barème ----------
function computeTier(daysBefore: number) {
  if (daysBefore > 30) return { tier: ">30j", percent: 90 };
  if (daysBefore >= 15) return { tier: "15–29j", percent: 50 };
  if (daysBefore >= 7) return { tier: "7–14j", percent: 25 };
  return { tier: "<7j", percent: 0 };
}

serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers });

  try {
    const { inscription_id, action, reason } = await req.json();
    if (!isUUID(inscription_id)) {
      return new Response(JSON.stringify({ error: "inscription_id invalide" }), { status: 400, headers });
    }

    // 1) Charger l'inscription + format (pour la date)
    const { data: insc, error: iErr } = await supabase
      .from("inscriptions")
      .select("id, format_id, groupe_id, statut, prix_total_coureur, course_id")
      .eq("id", inscription_id)
      .single();
    if (iErr || !insc) return new Response(JSON.stringify({ error: "Inscription introuvable" }), { status: 404, headers });

    const { data: fmt } = await supabase
      .from("formats")
      .select("id, date, prix, prix_equipe, team_size")
      .eq("id", insc.format_id as string)
      .maybeSingle();

    // 2) Retrouver le paiement lié à cette inscription
    //    - cas individuel: inscription_id = ...
    //    - cas équipe: inscription_ids CONTAINS inscription_id
    const { data: pays1 } = await supabase
      .from("paiements")
      .select("*")
      .eq("inscription_id", inscription_id)
      .order("created_at", { ascending: false })
      .limit(1);

    let payment = pays1?.[0] || null;
    if (!payment) {
      const { data: pays2 } = await supabase
        .from("paiements")
        .select("*")
        .contains("inscription_ids", [inscription_id])  // array contains
        .order("created_at", { ascending: false })
        .limit(1);
      payment = pays2?.[0] || null;
    }
    if (!payment || !payment.stripe_payment_intent_id) {
      return new Response(JSON.stringify({ error: "Paiement introuvable pour cette inscription" }), { status: 404, headers });
    }

    // 3) Monter les valeurs de référence
    const totalCents = Number(payment.amount_total || 0);
    const feeStripeCents = Number(payment.fee_total || 0);
    const feePlatformCents = Number(payment.platform_fee_amount || 0);
    const alreadyRefundedCents = Number(payment.refunded_total_cents || 0);

    const ids: string[] = Array.isArray(payment.inscription_ids) ? payment.inscription_ids : (
      payment.inscription_id ? [payment.inscription_id] : []
    );
    const N = Math.max(1, ids.length); // nombre d'inscriptions payées dans ce paiement

    // Part de cette inscription (équitable par inscription)
    const part_total_cents = Math.floor(totalCents / N);
    const part_nonref_cents = Math.floor((feeStripeCents + feePlatformCents) / N);
    const base_cents = Math.max(0, part_total_cents - part_nonref_cents);

    // Date course -> jours restants
    let daysBefore = 0;
    if (fmt?.date) {
      const today = new Date();
      const raceDate = new Date(fmt.date as string);
      daysBefore = Math.ceil((raceDate.getTime() - today.getTime()) / (24 * 3600 * 1000));
    }
    const { tier, percent } = computeTier(daysBefore);

    // Montant remboursé
    const refund_cents_raw = Math.floor(base_cents * (percent / 100));
    // bornes de sécurité par rapport à ce qui reste remboursable sur ce paiement
    const remainingPaymentCents = Math.max(0, totalCents - alreadyRefundedCents);
    const refund_cents = Math.min(refund_cents_raw, remainingPaymentCents, part_total_cents);

    const quote = {
      amount_total_cents: part_total_cents,
      non_refundable_cents: part_nonref_cents,
      base_cents,
      percent,
      tier,
      refund_cents,
      days_before: Number.isFinite(daysBefore) ? daysBefore : null,
      paiement_id: payment.id,
      stripe_payment_intent_id: payment.stripe_payment_intent_id as string,
      destination_account_id: payment.destination_account_id || null,
      type: payment.type || "individuel",
      group_id: insc.groupe_id || null,
    };

    if (action === "quote" || !action) {
      return new Response(JSON.stringify({ ok: true, quote }), { status: 200, headers });
    }

    if (action !== "confirm") {
      return new Response(JSON.stringify({ error: "action invalide (quote|confirm)" }), { status: 400, headers });
    }

    // Blocage barème = 0
    if (refund_cents <= 0) {
      return new Response(JSON.stringify({ error: "Aucun remboursement selon le barème" }), { status: 400, headers });
    }

    // 4) Créer un enregistrement "remboursements" (requested)
    const userIdForRefund = payment.user_id; // payeur
    const { data: refundRow, error: rInsErr } = await supabase
      .from("remboursements")
      .insert({
        paiement_id: payment.id,
        inscription_id,
        user_id: userIdForRefund,
        policy_tier: tier,
        percent,
        amount_total_cents: part_total_cents,
        non_refundable_cents: part_nonref_cents,
        base_cents,
        refund_cents,
        status: "requested",
        reason: reason || null,
        notes_admin: JSON.stringify({
          source: "refunds.confirm",
          computed_at: new Date().toISOString(),
          payment_split_size: N,
          original_payment_amount_total: totalCents,
          original_payment_fee_total: feeStripeCents,
          original_payment_platform_fee: feePlatformCents,
        }),
      })
      .select("*")
      .single();
    if (rInsErr || !refundRow) {
      return new Response(JSON.stringify({ error: "Erreur création remboursement (DB)" }), { status: 500, headers });
    }

    // 5) Stripe Refund (sur le PaymentIntent)
    let stripe_refund_id: string | null = null;
    try {
      const refund = await stripe.refunds.create({
        payment_intent: String(payment.stripe_payment_intent_id),
        amount: refund_cents,
        reason: "requested_by_customer",
        metadata: {
          remboursement_id: String(refundRow.id),
          inscription_id: String(inscription_id),
          paiement_id: String(payment.id),
          policy_tier: tier,
          percent: String(percent),
        },
      });
      stripe_refund_id = refund.id;
    } catch (e) {
      // Annuler la ligne si Stripe échoue
      await supabase.from("remboursements").update({ status: "failed", notes_admin: JSON.stringify({ error: String(e) }) }).eq("id", refundRow.id);
      return new Response(JSON.stringify({ error: "Stripe refund a échoué", details: String((e as any)?.message || e) }), { status: 500, headers });
    }

    // 6) Marquages / idempotence
    await supabase.from("remboursements").update({
      status: "processed",
      processed_at: new Date().toISOString(),
      stripe_refund_id,
    }).eq("id", refundRow.id);

    await supabase.from("paiements").update({
      refunded_total_cents: (alreadyRefundedCents + refund_cents),
    }).eq("id", payment.id);

    // Statut inscription
    await supabase.from("inscriptions").update({
      statut: "annulé",
      cancelled_at: new Date().toISOString(),
    }).eq("id", inscription_id);

    // (Optionnel) ajouter un crédit historique
    await supabase.from("credits_annulation").insert({
      inscription_id,
      paiement_id: payment.id,
      montant_total: part_total_cents / 100,
      remboursement_repas: 0,
      remboursement_inscription: refund_cents / 100,
      frais_annulation: part_nonref_cents / 100,
      pourcentage_conserve: (100 - percent),
      date_annulation: new Date().toISOString(),
      date_course: fmt?.date || null,
      details: {
        tier,
        percent,
        days_before: quote.days_before,
      },
      pourcentage: percent,
      jours_avant_course: quote.days_before,
      
      montant_rembourse: refund_cents / 100,
    });

    return new Response(JSON.stringify({
      ok: true,
      refund: {
        remboursement_id: refundRow.id,
        stripe_refund_id,
        refund_cents,
        policy_tier: tier,
        percent,
      },
    }), { status: 200, headers });
  } catch (e: any) {
    console.error("refunds error:", e?.message ?? e, e?.stack);
    const debug = Deno.env.get("DEBUG") === "1";
    return new Response(JSON.stringify({ error: debug ? (e?.message ?? "Erreur serveur") : "Erreur serveur" }), { status: 500, headers });
  }
});

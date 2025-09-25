// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0&pin=v135";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0&pin=v135";

console.log("BUILD refunds 2025-09-23T07:10Z (team-aware)");

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const ALLOWLIST = ["https://www.tickrace.com","http://localhost:5173","http://127.0.0.1:5173"];
function cors(req: Request) {
  const origin = req.headers.get("origin");
  const allowOrigin = origin && ALLOWLIST.includes(origin) ? origin : ALLOWLIST[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}
const isUUID = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v as string);

/** Cherche la ligne paiement qui correspond à une inscription (individuel ou équipe) */
async function findPaiementForInscription(supabaseClient: any, inscriptionId: string) {
  // A) lien direct (individuel)
  {
    const { data } = await supabaseClient
      .from("paiements")
      .select("*")
      .eq("inscription_id", inscriptionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  // B) via tableau inscription_ids[] (équipe/relais)
  try {
    const { data } = await supabaseClient
      .from("paiements")
      .select("*")
      .contains("inscription_ids", [inscriptionId])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  } catch { /* ignore: contains typing */ }

  // C) via groupe → paiement_id
  const { data: insc } = await supabaseClient
    .from("inscriptions")
    .select("groupe_id, paiement_trace_id")
    .eq("id", inscriptionId)
    .maybeSingle();

  if (insc?.groupe_id) {
    const { data: grp } = await supabaseClient
      .from("inscriptions_groupes")
      .select("paiement_id")
      .eq("id", insc.groupe_id)
      .maybeSingle();
    if (grp?.paiement_id) {
      const { data: pByGrp } = await supabaseClient
        .from("paiements")
        .select("*")
        .eq("id", grp.paiement_id)
        .maybeSingle();
      if (pByGrp) return pByGrp;
    }
  }

  // D) fallback : via trace_id
  const traceId = insc?.paiement_trace_id ?? null;
  if (traceId) {
    const { data: pTrace } = await supabaseClient
      .from("paiements")
      .select("*")
      .eq("trace_id", traceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pTrace) return pTrace;
  }

  return null;
}

/** Calcule le palier de remboursement selon la date de course */
function computePolicy(dateCourseISO: string | null | undefined) {
  if (!dateCourseISO) {
    // Si pas de date : par prudence, aucun remboursement automatique
    return { days_before: null as number | null, percent: 0, tier: "<unknown>" };
  }
  const today = new Date();
  const dCourse = new Date(dateCourseISO);
  // normaliser à minuit local
  const midnightCourse = new Date(dCourse.getFullYear(), dCourse.getMonth(), dCourse.getDate());
  const midnightNow = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = midnightCourse.getTime() - midnightNow.getTime();
  const days = Math.floor(diffMs / (24 * 3600 * 1000));
  // Barème : >30j : 90% • 15–29j : 50% • 7–14j : 25% • <7j : 0%
  if (days > 30) return { days_before: days, percent: 90, tier: ">30j" };
  if (days >= 15) return { days_before: days, percent: 50, tier: "15–29j" };
  if (days >= 7)  return { days_before: days, percent: 25, tier: "7–14j" };
  return { days_before: days, percent: 0, tier: "<7j" };
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
    if (!action || !["quote", "confirm"].includes(action)) {
      return new Response(JSON.stringify({ error: "action invalide (quote|confirm)" }), { status: 400, headers });
    }

    // 1) Charger l'inscription + format (pour date de course)
    const { data: insc, error: errInsc } = await supabase
      .from("inscriptions")
      .select("id, format_id, groupe_id, statut, course_id")
      .eq("id", inscription_id)
      .single();
    if (errInsc || !insc) {
      return new Response(JSON.stringify({ error: "Inscription introuvable" }), { status: 404, headers });
    }

    const { data: fmt } = await supabase
      .from("formats")
      .select("id, date")
      .eq("id", insc.format_id)
      .maybeSingle();

    // 2) Retrouver la ligne paiement (individuel, équipe ou fallback)
    const paiement = await findPaiementForInscription(supabase, inscription_id);
    if (!paiement) {
      return new Response(JSON.stringify({ error: "Paiement introuvable pour cette inscription" }), { status: 404, headers });
    }

    // 3) Montants
    const amount_total_cents = Number(paiement.amount_total || 0) || Math.round(Number(paiement.montant_total || 0) * 100);
    const stripe_fee_cents = Number(paiement.fee_total || 0) || 0;
    const platform_fee_cents = Number(paiement.platform_fee_amount || 0) || 0;
    const non_refundable_cents = Math.max(0, stripe_fee_cents + platform_fee_cents);
    const base_cents = Math.max(0, amount_total_cents - non_refundable_cents);

    // 4) Barème
    const policy = computePolicy(fmt?.date ?? null);
    const refund_cents = Math.floor(base_cents * (policy.percent / 100));

    if (action === "quote") {
      return new Response(JSON.stringify({
        ok: true,
        quote: {
          amount_total_cents,
          non_refundable_cents,
          base_cents,
          refund_cents,
          percent: policy.percent,
          tier: policy.tier,
          days_before: policy.days_before,
          paiement_id: paiement.id,
        }
      }), { status: 200, headers });
    }

    // action === "confirm"
    // 5) Stripe refund
    const piId = paiement.stripe_payment_intent_id as string | null;
    if (!piId) {
      return new Response(JSON.stringify({ error: "PaymentIntent manquant sur le paiement" }), { status: 409, headers });
    }
    // Si rien à rembourser selon barème
    if (refund_cents <= 0) {
      // On annule sans remboursement financier
      await supabase.from("inscriptions").update({ statut: "annulé", cancelled_at: new Date().toISOString() }).eq("id", inscription_id);
      if (insc.groupe_id) {
        // si toutes les inscriptions du groupe sont annulées, on peut marquer le groupe annule
        const { data: others } = await supabase
          .from("inscriptions")
          .select("id, statut")
          .eq("groupe_id", insc.groupe_id);
        if ((others || []).every((r: any) => (r.id === inscription_id) || (r.statut && r.statut.toLowerCase().startsWith("annul")))) {
          await supabase.from("inscriptions_groupes").update({ statut: "annule" }).eq("id", insc.groupe_id);
        }
      }
      const { data: rembIns } = await supabase
        .from("remboursements")
        .insert({
          paiement_id: paiement.id,
          inscription_id,
          user_id: paiement.user_id,
          policy_tier: policy.tier,
          percent: policy.percent,
          amount_total_cents,
          non_refundable_cents,
          base_cents,
          refund_cents: 0,
          status: "processed",
          reason: reason ?? null,
        })
        .select()
        .single();

      return new Response(JSON.stringify({ ok: true, refund: rembIns, stripe_refund_id: null }), { status: 200, headers });
    }

    // Créer le refund Stripe (remboursement partiel)
    const sRefund = await stripe.refunds.create({
      payment_intent: piId,
      amount: refund_cents,
      // NOTE: transfers sont exécutés J+1 via payout_queue → pas besoin de reversals ici
    });

    // 6) Mettre à jour la base
    // - tracer remboursement
    const { data: remb } = await supabase
      .from("remboursements")
      .insert({
        paiement_id: paiement.id,
        inscription_id,
        user_id: paiement.user_id,
        policy_tier: policy.tier,
        percent: policy.percent,
        amount_total_cents,
        non_refundable_cents,
        base_cents,
        refund_cents,
        stripe_refund_id: sRefund.id,
        status: "processed",
        reason: reason ?? null,
      })
      .select()
      .single();

    // - MAJ cumuls paiement
    await supabase
      .from("paiements")
      .update({ refunded_total_cents: Number(paiement.refunded_total_cents || 0) + refund_cents })
      .eq("id", paiement.id);

    // - Statuts inscription + options
    await supabase.from("inscriptions").update({ statut: "annulé", cancelled_at: new Date().toISOString() }).eq("id", inscription_id);
    await supabase.from("inscriptions_options").update({ status: "canceled" }).eq("inscription_id", inscription_id).eq("status", "confirmed");

    // - Si groupe : éventuellement marquer groupe "annule" si toutes annulées
    if (insc.groupe_id) {
      const { data: others } = await supabase
        .from("inscriptions")
        .select("id, statut")
        .eq("groupe_id", insc.groupe_id);
      if ((others || []).every((r: any) => (r.id === inscription_id) || (r.statut && r.statut.toLowerCase().startsWith("annul")))) {
        await supabase.from("inscriptions_groupes").update({ statut: "annule" }).eq("id", insc.groupe_id);
      }
    }

    return new Response(JSON.stringify({ ok: true, refund: remb, stripe_refund_id: sRefund.id }), { status: 200, headers });
  } catch (e: any) {
    console.error("refunds error:", e?.message ?? e, e?.stack);
    const debug = Deno.env.get("DEBUG") === "1";
    return new Response(JSON.stringify({ error: debug ? (e?.message ?? "Erreur serveur") : "Erreur serveur" }), { status: 500, headers });
  }
});

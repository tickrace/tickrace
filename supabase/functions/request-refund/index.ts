// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0";

console.log("BUILD request-refund 2025-09-22T22:10Z");

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const ALLOWLIST = ["https://www.tickrace.com", "http://localhost:5173", "http://127.0.0.1:5173"];
function cors(req: Request) {
  const origin = req.headers.get("origin");
  const allow = origin && ALLOWLIST.includes(origin) ? origin : ALLOWLIST[0];
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

const isUUID = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v as string);

type RefundMode = "individuel" | "groupe" | "relais";

function computeRate(days: number) {
  if (days > 30) return 0.90;
  if (days >= 15) return 0.50; // 15–29
  if (days >= 7)  return 0.25; // 7–14
  return 0.0;                  // <7
}

serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers });

  try {
    const body = await req.json();
    const {
      // pour individuel
      inscription_id,
      // pour groupe / relais
      inscription_ids,       // string[] (optionnel si individuel)
      mode,                  // "individuel" | "groupe" | "relais"
      reason = "requested_by_customer",
    } = body ?? {};

    const m: RefundMode = (mode === "groupe" || mode === "relais") ? mode : "individuel";

    // 1) Retrouver le paiement concerné
    let paiement: any | null = null;
    if (m === "individuel") {
      if (!isUUID(inscription_id)) {
        return new Response(JSON.stringify({ error: "inscription_id requis (individuel)" }), { status: 400, headers });
      }
      const { data } = await supabase
        .from("paiements")
        .select("*")
        .eq("type", "individuel")
        .eq("inscription_id", inscription_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      paiement = data || null;
    } else {
      const ids = Array.isArray(inscription_ids) ? inscription_ids.filter(isUUID) : [];
      if (ids.length === 0) {
        return new Response(JSON.stringify({ error: "inscription_ids requis (groupe/relais)" }), { status: 400, headers });
      }
      const { data } = await supabase
        .from("paiements")
        .select("*")
        .in("type", ["groupe", "relais"])
        .contains("inscription_ids", ids) // l’ensemble doit être inclus
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      paiement = data || null;
    }

    if (!paiement?.stripe_payment_intent_id) {
      return new Response(JSON.stringify({ error: "Paiement introuvable" }), { status: 404, headers });
    }

    // 2) Récup date de la course (depuis les inscriptions -> formats.date)
    let formatDate: string | null = null;
    if (m === "individuel") {
      const { data: insc } = await supabase
        .from("inscriptions")
        .select("format_id")
        .eq("id", inscription_id)
        .maybeSingle();
      if (insc?.format_id) {
        const { data: fmt } = await supabase
          .from("formats")
          .select("date")
          .eq("id", insc.format_id)
          .maybeSingle();
        formatDate = fmt?.date ?? null;
      }
    } else {
      const ids = Array.isArray(inscription_ids) ? inscription_ids.filter(isUUID) : [];
      if (ids.length > 0) {
        const { data: first } = await supabase
          .from("inscriptions")
          .select("format_id")
          .eq("id", ids[0])
          .maybeSingle();
        if (first?.format_id) {
          const { data: fmt } = await supabase
            .from("formats")
            .select("date")
            .eq("id", first.format_id)
            .maybeSingle();
          formatDate = fmt?.date ?? null;
        }
      }
    }
    if (!formatDate) {
      return new Response(JSON.stringify({ error: "Date de l’épreuve introuvable pour le calcul du barème" }), { status: 409, headers });
    }

    // 3) Calcul du barème
    const eventDate = new Date(formatDate);
    const today = new Date();
    const days = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
    const rate = computeRate(days);

    // 4) Montants
    const amountTotalCents = Number(paiement.amount_total || 0);       // total payé (cents)
    const stripeFeeCents   = Number(paiement.fee_total || 0);          // frais Stripe (cents)
    const platformFeeCents = Number(paiement.platform_fee_amount || 0);// frais Tickrace (cents)

    // Base remboursable = total payé - frais non remboursables
    const refundableBaseCents = Math.max(0, amountTotalCents - stripeFeeCents - platformFeeCents);
    const refundCents = Math.floor(refundableBaseCents * rate);

    if (refundCents <= 0) {
      return new Response(JSON.stringify({
        ok: true,
        refundable: 0,
        reason: "Barème < 7 jours ou aucun montant remboursable après déduction des frais.",
        days_before: days,
        rate,
      }), { status: 200, headers });
    }

    // 5) Eviter de rembourser plus que le restant
    const piId = String(paiement.stripe_payment_intent_id);
    const pi = await stripe.paymentIntents.retrieve(piId);
    const alreadyRefunded = (pi.amount_received ?? pi.amount ?? 0) - (pi.amount_capturable ?? 0) - (pi.amount ?? 0) + 0; // fallback
    // Stripe fournit plutôt payments.refunds.list, on va lister pour être sûr
    const refundsList = await stripe.refunds.list({ payment_intent: piId, limit: 100 });
    const refundedSum = refundsList.data.reduce((s, r) => s + (r.amount || 0), 0);
    const maxRefundRemaining = Math.max(0, (pi.amount_received ?? pi.amount ?? 0) - refundedSum);
    const finalRefundCents = Math.min(refundCents, maxRefundRemaining);

    if (finalRefundCents <= 0) {
      return new Response(JSON.stringify({
        ok: true,
        refundable: 0,
        reason: "Aucun reste à rembourser sur cette transaction Stripe.",
        days_before: days,
        rate,
      }), { status: 200, headers });
    }

    // 6) Créer le refund Stripe
    const refund = await stripe.refunds.create({
      payment_intent: piId,
      amount: finalRefundCents,
      reason,
    });

    // 7) MàJ base
    // - on tente d’updater la table paiements (si colonnes présentes) ; sinon on ignore
    try {
      await supabase.from("paiements").update({
        refund_status: refund.status ?? "succeeded",
        refunded_amount_cents: (paiement.refunded_amount_cents || 0) + finalRefundCents,
        refund_id: refund.id,
        status: refund.status === "succeeded" ? "refunded" : paiement.status,
      }).eq("id", paiement.id);
    } catch { /* best effort */ }

    // - on annule les inscriptions concernées
    if (m === "individuel") {
      await supabase.from("inscriptions").update({ statut: "annulé" }).eq("id", inscription_id);
    } else {
      const ids = (inscription_ids || []).filter((x: string) => isUUID(x));
      if (ids.length > 0) {
        await supabase.from("inscriptions").update({ statut: "annulé" }).in("id", ids);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      refund_id: refund.id,
      refund_status: refund.status,
      refunded_cents: finalRefundCents,
      refunded_eur: (finalRefundCents / 100).toFixed(2),
      days_before: days,
      rate,
    }), { status: 200, headers });
  } catch (e: any) {
    console.error("request-refund error:", e?.message ?? e, e?.stack);
    const debug = Deno.env.get("DEBUG") === "1";
    return new Response(JSON.stringify({ error: debug ? (e?.message ?? "Erreur serveur") : "Erreur serveur" }), { status: 500, headers });
  }
});

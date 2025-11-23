// supabase/functions/refund-inscription/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@16.6.0?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  httpClient: Stripe.createFetchHttpClient(),
});

function cors(h = new Headers()) {
  h.set("Access-Control-Allow-Origin", "https://www.tickrace.com");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "content-type, authorization, apikey");
  h.set("Content-Type", "application/json; charset=utf-8");
  return h;
}

serve(async (req) => {
  const headers = cors();

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const inscription_id = body.inscription_id as string | undefined;

    if (!inscription_id) {
      return new Response(
        JSON.stringify({ error: "inscription_id manquant" }),
        { status: 400, headers },
      );
    }

    // 1) Récupérer l'inscription
    const { data: inscription, error: insErr } = await supabase
      .from("inscriptions")
      .select("*")
      .eq("id", inscription_id)
      .maybeSingle();

    if (insErr || !inscription) {
      console.error("INSCRIPTION_NOT_FOUND", insErr);
      return new Response(
        JSON.stringify({ error: "Inscription introuvable" }),
        { status: 404, headers },
      );
    }

    // 2) Trouver le paiement lié (par inscription_id puis inscription_ids)
    let paiement: any = null;

    const { data: payById, error: errById } = await supabase
      .from("paiements")
      .select("*")
      .eq("inscription_id", inscription_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (errById) {
      console.error("PAYMENT_LOOKUP_BY_ID_ERROR", errById);
    }

    if (payById) {
      paiement = payById;
    } else {
      const { data: payByArray, error: errByArray } = await supabase
        .from("paiements")
        .select("*")
        .contains("inscription_ids", [inscription_id])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (errByArray) {
        console.error("PAYMENT_LOOKUP_BY_ARRAY_ERROR", errByArray);
      }

      paiement = payByArray || null;
    }

    if (!paiement) {
      return new Response(
        JSON.stringify({
          error:
            "Paiement introuvable pour cette inscription. Vérifie que le webhook Stripe a bien créé une entrée dans la table paiements.",
        }),
        { status: 404, headers },
      );
    }

    // 3) Récupérer l'id du PaymentIntent Stripe
    const paymentIntentId: string | null =
      paiement.stripe_payment_intent ||
      paiement.stripe_payment_intent_id ||
      null;

    if (!paymentIntentId) {
      console.error("MISSING_PAYMENT_INTENT", paiement);
      return new Response(
        JSON.stringify({
          error:
            "Paiement Stripe non lié à cette inscription (payment_intent manquant).",
        }),
        { status: 400, headers },
      );
    }

    // 4) Créer le remboursement complet sur Stripe
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      // amount: ... // si tu veux un remboursement partiel plus tard
    });

    // 5) Mettre à jour la table paiements (statut + montants remboursés)
    const refundedAmountCents =
      (refund.amount ?? 0); // Stripe renvoie amount en cents

    const newRefundedTotal =
      Number(paiement.refunded_total_cents || 0) + refundedAmountCents;

    const { error: upPayErr } = await supabase
      .from("paiements")
      .update({
        status: "rembourse",
        refunded_total_cents: newRefundedTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paiement.id);

    if (upPayErr) {
      console.error("PAYMENT_UPDATE_REFUND_ERROR", upPayErr);
    }

    // 6) Mettre à jour l’inscription en "annule"
    const { error: upInsErr } = await supabase
      .from("inscriptions")
      .update({
        statut: "annule",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", inscription_id);

    if (upInsErr) {
      console.error("INSCRIPTION_UPDATE_REFUND_ERROR", upInsErr);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        refund_id: refund.id,
        amount_cents: refundedAmountCents,
      }),
      { status: 200, headers },
    );
  } catch (e) {
    console.error("REFUND_FATAL", e);
    return new Response(
      JSON.stringify({
        error: "refund_failed",
        details: String((e as any)?.message ?? e),
      }),
      { status: 500, headers },
    );
  }
});

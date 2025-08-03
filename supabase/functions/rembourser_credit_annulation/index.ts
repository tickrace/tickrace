// Edge Function: rembourser_credit_annulation

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe";

// ⚠️ Remplace avec ta clé Stripe secrète
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

// Supabase client côté serveur
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  // ➤ Réponse OPTIONS (prévol CORS)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const { credit_id } = await req.json();

    if (!credit_id) {
      return new Response("credit_id manquant", {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    // Récupération du crédit et de l'inscription associée
    const { data: credit, error: creditError } = await supabase
      .from("credits_annulation")
      .select("id, montant_rembourse, inscription_id, details")
      .eq("id", credit_id)
      .single();

    if (creditError || !credit) {
      return new Response("Crédit non trouvé", {
        status: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    // Récupération du paiement associé à l'inscription
    const { data: paiement, error: paiementError } = await supabase
      .from("paiements")
      .select("id, stripe_payment_intent_id")
      .eq("inscription_id", credit.inscription_id)
      .eq("status", "succeeded")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (paiementError || !paiement?.stripe_payment_intent_id) {
      return new Response("Paiement introuvable", {
        status: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    // Remboursement Stripe
    const refund = await stripe.refunds.create({
      payment_intent: paiement.stripe_payment_intent_id,
      amount: Math.round(Number(credit.montant_rembourse) * 100), // en centimes
    });

    // Mise à jour dans Supabase si nécessaire
    await supabase
      .from("credits_annulation")
      .update({ details: { ...credit.details, stripe_refund_id: refund.id } })
      .eq("id", credit.id);

    return new Response(JSON.stringify({ success: true, refund_id: refund.id }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Erreur refund :", error);
    return new Response("Erreur interne", {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
});

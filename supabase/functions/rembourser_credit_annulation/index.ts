import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
      },
    });
  }

  try {
    const { credit_id } = await req.json();

    console.log("🔁 Reçu demande de remboursement pour crédit :", credit_id);

    if (!credit_id) {
      console.error("⛔ credit_id manquant");
      return new Response("credit_id manquant", {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    const { data: credit, error: creditError } = await supabase
      .from("credits_annulation")
      .select("id, montant_rembourse, inscription_id, details")
      .eq("id", credit_id)
      .single();

    if (creditError || !credit) {
      console.error("❌ Crédit introuvable :", creditError);
      return new Response("Crédit non trouvé", {
        status: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    console.log("✅ Crédit trouvé :", credit);

    if (credit.details?.stripe_refund_id) {
      console.warn("⚠️ Crédit déjà remboursé :", credit.details.stripe_refund_id);
      return new Response(JSON.stringify({
        warning: "Ce crédit a déjà été remboursé.",
        refund_id: credit.details.stripe_refund_id,
      }), {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }

    // 1. Paiement individuel
    let { data: paiement } = await supabase
      .from("paiements")
      .select("id, stripe_payment_intent_id")
      .eq("inscription_id", credit.inscription_id)
      .eq("status", "succeeded")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // 2. Sinon, chercher dans paiements groupés
    if (!paiement) {
      const { data: paiementsGroupes, error: groupesError } = await supabase
        .from("paiements")
        .select("id, stripe_payment_intent_id, inscription_ids")
        .eq("status", "succeeded");

      if (groupesError) {
        console.error("❌ Erreur paiements groupés :", groupesError);
        return new Response("Erreur paiements groupés", {
          status: 500,
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      }

      paiement = paiementsGroupes.find(
        (p) => Array.isArray(p.inscription_ids) && p.inscription_ids.includes(credit.inscription_id)
      );
    }

    if (!paiement?.stripe_payment_intent_id) {
      console.error("❌ Aucun paiement trouvé pour cette inscription");
      return new Response("Aucun paiement Stripe valide trouvé pour cette inscription.", {
        status: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    console.log("💳 Paiement trouvé :", paiement);

    // Stripe refund
    const refund = await stripe.refunds.create({
      payment_intent: paiement.stripe_payment_intent_id,
      amount: Math.round(Number(credit.montant_rembourse) * 100),
    });

    console.log("✅ Remboursement Stripe effectué :", refund.id);

    // Récupération de l'inscription pour l'email
const { data: inscription, error: inscriptionError } = await supabase
  .from("inscriptions")
  .select("email, prenom, nom")
  .eq("id", credit.inscription_id)
  .single();

if (inscriptionError || !inscription?.email) {
  console.error("❌ Erreur récupération email inscription :", inscriptionError);
} else {
  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Tickrace <no-reply@tickrace.com>",
      to: [inscription.email],
      subject: "Confirmation de votre remboursement Tickrace",
      html: `
        <p>Bonjour ${inscription.prenom ?? ""} ${inscription.nom ?? ""},</p>
        <p>Nous confirmons le remboursement de votre inscription d'un montant de <strong>${credit.montant_rembourse.toFixed(2)} €</strong>.</p>
        <p>Merci pour votre confiance,</p>
        <p>L’équipe Tickrace</p>
      `,
    }),
  });

  if (!resendRes.ok) {
    const errorText = await resendRes.text();
    console.error("❌ Erreur envoi email Resend :", errorText);
  } else {
    console.log("📧 Email de confirmation envoyé à :", inscription.email);
  }
}

    const { error: updateError } = await supabase
      .from("credits_annulation")
      .update({
        details: {
          ...credit.details,
          stripe_refund_id: refund.id,
        },
        paiement_id: paiement.id,
      })
      .eq("id", credit.id);

    if (updateError) {
      console.error("❌ Erreur mise à jour Supabase :", updateError);
      return new Response("Erreur lors de la mise à jour Supabase", {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    console.log("📝 Crédit mis à jour avec ID remboursement");

    return new Response(JSON.stringify({
      success: true,
      refund_id: refund.id,
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("💥 Erreur interne :", error);
    return new Response("Erreur interne", {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
});

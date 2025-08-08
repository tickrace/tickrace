// supabase/functions/create-checkout-session/index.ts
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

serve(async (req) => {
  // ✅ OPTIONS preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const body = await req.json();
    console.log("📥 Données reçues:", body);

    const { user_id, course_id, prix_total, inscription_id, email } = body;

    // 🔎 Log ciblé pour debug
    console.log("🔎 Champs:", {
      user_id,
      course_id,
      prix_total,
      inscription_id,
      emailPresent: !!email,
    });

    // ✅ Validation stricte
    if (!user_id || !course_id || !prix_total || !inscription_id || !email) {
      console.error("❌ Paramètre manquant", {
        has_user_id: !!user_id,
        has_course_id: !!course_id,
        has_prix_total: !!prix_total,
        has_inscription_id: !!inscription_id,
        has_email: !!email,
      });
      return new Response(
        JSON.stringify({ error: "Paramètre manquant dans la requête" }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    // 🧾 Création de la session Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: "Inscription à la course" },
            unit_amount: Math.round(Number(prix_total) * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",

      // ✅ Email utilisé pour pré-remplir Stripe + reçu
      customer_email: String(email),
      payment_intent_data: {
        receipt_email: String(email),
      },

      // ✅ Redirections après paiement
      success_url: "https://www.tickrace.com/merci",
      cancel_url: "https://www.tickrace.com/cancel",

      // 🔗 Métadonnées utiles pour le webhook
      metadata: {
        user_id: String(user_id),
        course_id: String(course_id),
        prix_total: String(prix_total),
        inscription_id: String(inscription_id),
      },
    });

    console.log("✅ Session Stripe créée :", { session_id: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("💥 Erreur create-checkout-session :", e?.message ?? e);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }
});

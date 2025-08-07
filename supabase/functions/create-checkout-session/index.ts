// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Méthode non autorisée", { status: 405 });
  }

  try {
    const { user_id, course_id, prix_total, inscription_id } = await req.json();

    if (!user_id || !course_id || !prix_total || !inscription_id) {
      console.error("❌ Données manquantes", { user_id, course_id, prix_total, inscription_id });
      return new Response("Données manquantes", { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Inscription course Tickrace",
            },
            unit_amount: Math.round(prix_total * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        user_id,
        course_id,
        inscription_id,
      },
      success_url: "https://www.tickrace.com/inscription-validee",
      cancel_url: "https://www.tickrace.com/inscription-annulee",
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ Erreur création session Stripe :", err.message);
    return new Response("Erreur serveur", { status: 500 });
  }
});

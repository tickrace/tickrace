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
    return new Response("ok", {
      headers: corsHeaders(),
    });
  }

  try {
    const body = await req.json();

    console.log("📥 Données reçues:", body);

const { user_id, course_id, prix_total, inscription_id, email } = body;

if (!user_id || !course_id || !prix_total || !inscription_id || !email) {
      console.error("❌ Paramètre manquant");
      return new Response(
        JSON.stringify({ error: "Paramètre manquant dans la requête" }),
        {
          status: 400,
          headers: {
            ...corsHeaders(),
            "Content-Type": "application/json",
          },
        }
      );
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Inscription à la course",
            },
            unit_amount: Math.round(prix_total * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",

      success_url: "https://www.tickrace.com/merci",
      cancel_url: "https://www.tickrace.com/cancel",
      metadata: {
        user_id,
        course_id,
        prix_total: prix_total.toString(),
        inscription_id,
      },
    });

    console.log("✅ Session Stripe créée :", session.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json",
      },
    });
  } catch (e) {
    console.error("❌ Erreur :", e);
    return new Response(
      JSON.stringify({ error: "Erreur serveur" }),
      {
        status: 500,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json",
        },
      }
    );
  }
});

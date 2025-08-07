// ✅ create-checkout-session/index.ts
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

serve(async (req) => {
  const body = await req.json();

  const { user_id, course_id, prix_total, inscription_id } = body;
  if (!user_id || !course_id || !prix_total || !inscription_id) {
    console.error("❌ Paramètre manquant");
    return new Response("Bad Request", { status: 400 });
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
    success_url: "https://www.tickrace.com/success",
    cancel_url: "https://www.tickrace.com/cancel",
    metadata: {
      user_id,
      course_id,
      prix_total,
      inscription_id,
    },
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { "Content-Type": "application/json" },
  });
});
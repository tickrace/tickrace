// ✅ supabase/functions/create-checkout-session/index.ts
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  try {
    const { user_id, course_id, prix_total, inscriptions } = await req.json();
    console.log("🔁 Données reçues:", { user_id, course_id, prix_total, inscriptions });

    const inscriptionIds = inscriptions.map((i: { id: string }) => i.id);
    console.log("📦 IDs envoyés à Stripe :", inscriptionIds);

    const customerEmail = inscriptions[0]?.email || "contact@tickrace.com";

    const session = await stripe.checkout.sessions.create({
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
      success_url: "https://www.tickrace.com/merci?success=true",
      cancel_url: "https://www.tickrace.com/inscription?cancelled=true",
      metadata: {
        user_id,
        course_id,
        inscription_ids: inscriptionIds.join(","),
      },
      customer_email: customerEmail,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("❌ Erreur Stripe:", err);
    return new Response("Erreur Stripe", { status: 500 });
  }
});
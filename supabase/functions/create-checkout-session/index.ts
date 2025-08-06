// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

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
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), {
      status: 405,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });
  }

  try {
    const { user_id, course_id, inscriptions, prix_total } = await req.json();

    console.log("🔁 Données reçues:", { user_id, course_id, prix_total, inscriptions });

    if (!inscriptions || inscriptions.length === 0) {
      return new Response(JSON.stringify({ error: "Aucune inscription transmise" }), {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // On prend le premier email pour Stripe
    const firstInscriptionId = inscriptions[0]?.id;
    let email = "test@tickrace.com";

    if (firstInscriptionId) {
      const { data: firstInscription } = await supabase
        .from("inscriptions")
        .select("email")
        .eq("id", firstInscriptionId)
        .single();

      if (firstInscription?.email) {
        email = firstInscription.email;
      }
    }

    // Cherche ou crée un client Stripe
    const { data: existingClient } = await supabase
      .from("stripe_clients")
      .select("stripe_customer_id")
      .eq("user_id", user_id)
      .single();

    let stripeCustomerId = existingClient?.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { user_id },
      });

      stripeCustomerId = customer.id;

      await supabase.from("stripe_clients").insert({
        user_id,
        stripe_customer_id: stripeCustomerId,
      });
    }

    // Crée la session de paiement Stripe
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      receipt_email: email,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: "Inscription course Tickrace" },
            unit_amount: Math.round(prix_total * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        user_id,
        course_id,
        inscription_ids: inscriptions.map(i => i.id).join(","),
      },
      success_url: "https://www.tickrace.com/merci?success=true",
      cancel_url: "https://www.tickrace.com/inscription?cancelled=true",
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("❌ Erreur Stripe:", err);
    return new Response(JSON.stringify({ error: "Erreur interne", details: err.message }), {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });
  }
});

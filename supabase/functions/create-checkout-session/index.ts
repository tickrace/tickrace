// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"), {
  apiVersion: "2024-04-10",
});

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Méthode non autorisée", { status: 405 });
  }

  try {
    const { user_id, nom, prenom, email, montant_total, format_id } =
      await req.json();

    // 1. Vérifier si le client existe déjà dans Supabase
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: clientStripe, error: errorClient } = await supabaseAdmin
      .from("stripe_clients")
      .select("stripe_customer_id")
      .eq("user_id", user_id)
      .single();

    let stripeCustomerId = clientStripe?.stripe_customer_id;

    // 2. Créer le client Stripe si nécessaire
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email,
        name: `${prenom} ${nom}`,
        metadata: {
          user_id,
        },
      });

      stripeCustomerId = customer.id;

      // Enregistrer dans Supabase
      await supabaseAdmin.from("stripe_clients").insert({
        user_id,
        stripe_customer_id: stripeCustomerId,
      });
    }

    // 3. Créer la session Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Inscription course Tickrace",
            },
            unit_amount: Math.round(montant_total * 100), // en centimes
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        user_id,
        format_id,
      },
      success_url: "https://www.tickrace.com/merci?success=true",
      cancel_url: "https://www.tickrace.com/inscription?cancelled=true",
    });

    return new Response(
      JSON.stringify({ checkout_url: session.url }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    console.error("Erreur Stripe:", err);
    return new Response("Erreur interne", { status: 500 });
  }
});

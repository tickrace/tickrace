// supabase/functions/stripe-webhook/index.ts
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});
const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

serve(async (req) => {
  // Pas de CORS nécessaire pour un webhook
  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig!, endpointSecret);
    console.log("✅ Webhook reçu :", event.type);
  } catch (err) {
    console.error("❌ Erreur de signature Stripe :", err.message);
    return new Response("Webhook signature error", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const inscription_id = session.metadata?.inscription_id;
    const user_id = session.metadata?.user_id ?? null;
    // On évite d’utiliser prix_total des metadata, on lit la source Stripe :
    const montant_total = (session.amount_total ?? 0) / 100;
    const stripe_payment_intent_id = session.payment_intent as string | null;
    const email = (session.customer_details?.email || session.customer_email || "") as string;

    console.log("🔎 Données session:", {
      inscription_id,
      user_id,
      montant_total,
      stripe_payment_intent_id,
      email_present: !!email,
    });

    if (!inscription_id || !stripe_payment_intent_id) {
      console.error("❌ Données manquantes (inscription_id ou payment_intent)");
      return new Response("Missing data", { status: 400 });
    }

    // Supabase admin
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Idempotence: si un paiement avec ce payment_intent existe déjà, on sort proprement
    const { data: existingPay, error: existingErr } = await supabase
      .from("paiements")
      .select("id, stripe_payment_intent_id")
      .eq("stripe_payment_intent_id", stripe_payment_intent_id)
      .maybeSingle();

    if (existingErr) {
      console.error("⚠️ Erreur lecture paiement existant :", existingErr.message);
      // on continue quand même, mais on log
    }

    if (existingPay) {
      console.log("ℹ️ Paiement déjà enregistré, on ignore (idempotence):", existingPay.id);
      return new Response("ok", { status: 200 });
    }

    // 1) Valider l’inscription
    const { error: updErr } = await supabase
      .from("inscriptions")
      .update({ statut: "validée" })
      .eq("id", inscription_id);

    if (updErr) {
      console.error("❌ Erreur mise à jour inscription :", updErr.message);
      return new Response("Update error", { status: 500 });
    }
    console.log("✅ Inscription validée :", inscription_id);

    // 2) Insérer le paiement (⚠️ PAS de course_id ici, le schéma n’a pas cette colonne)
    const { error: payErr } = await supabase.from("paiements").insert({
      user_id,
      inscription_id,
      // inscription_ids: null, // on n’utilise plus le groupé
      montant_total,
      devise: "EUR",
      stripe_payment_intent_id,
      status: "succeeded",
      reversement_effectue: false,
      type: "individuel",
    });

    if (payErr) {
      console.error("❌ Erreur insertion paiement :", payErr.message);
      return new Response("Insert payment error", { status: 500 });
    }
    console.log("✅ Paiement enregistré pour l’inscription :", inscription_id);
  }

  return new Response("ok", { status: 200 });
});

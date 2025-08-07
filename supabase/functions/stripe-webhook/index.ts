// ✅ stripe-webhook/index.ts
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});
const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, endpointSecret);
  } catch (err) {
    console.error("❌ Erreur de signature Stripe :", err.message);
    return new Response("Webhook Error", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const user_id = session.metadata?.user_id;
    const course_id = session.metadata?.course_id;
    const prix_total = parseFloat(session.metadata?.prix_total || "0");
    const inscription_id = session.metadata?.inscription_id;
    const payment_intent = session.payment_intent;

    if (!inscription_id || !user_id || !course_id || !payment_intent) {
      console.error("❌ Données manquantes dans le webhook");
      return new Response("Données manquantes", { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: updateError } = await supabase
      .from("inscriptions")
      .update({ statut: "validée" })
      .eq("id", inscription_id);

    if (updateError) {
      console.error("❌ Erreur mise à jour inscription :", updateError.message);
      return new Response("Erreur update", { status: 500 });
    }

    const { error: insertError } = await supabase.from("paiements").insert({
      user_id,
      course_id,
      montant_total: prix_total,
      stripe_payment_intent_id: payment_intent,
      status: "succeeded",
      inscription_id,
      type: "individuel",
      reversement_effectue: false,
    });

    if (insertError) {
      console.error("❌ Erreur insertion paiement :", insertError.message);
      return new Response("Erreur paiement", { status: 500 });
    }

    console.log(`✅ Paiement individuel enregistré pour ${inscription_id}`);
  }

  return new Response("ok", { status: 200 });
});

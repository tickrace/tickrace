// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Méthode non autorisée", { status: 405 });
  }

  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, endpointSecret);
  } catch (err) {
    console.error("⚠️ Signature invalide :", err.message);
    return new Response("Signature invalide", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const user_id = session.metadata?.user_id;
    const format_id = session.metadata?.format_id;
    const montant_total = session.amount_total / 100;
    const stripe_payment_intent_id = session.payment_intent;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 🔎 1. Récupérer toutes les inscriptions en attente
    const { data: inscriptions, error: errIns } = await supabase
      .from("inscriptions")
      .select("id")
      .eq("coureur_id", user_id)
      .eq("format_id", format_id)
      .eq("statut", "en attente");

    if (errIns || !inscriptions || inscriptions.length === 0) {
      console.error("❌ Aucune inscription trouvée pour ce paiement.");
      return new Response("Inscriptions manquantes", { status: 400 });
    }

    const inscriptionIds = inscriptions.map((i) => i.id);

    // ✅ 2. Valider toutes les inscriptions
    const { error: errUpdate } = await supabase
      .from("inscriptions")
      .update({ statut: "validée" })
      .in("id", inscriptionIds);

    if (errUpdate) {
      console.error("❌ Erreur update inscriptions :", errUpdate.message);
      return new Response("Erreur update", { status: 500 });
    }

    // 💰 3. Enregistrer le paiement groupé
    const { error: errPaiement } = await supabase.from("paiements").insert({
      user_id,
      type: "groupé",
      inscription_ids: inscriptionIds,
      inscription_id: null,
      montant_total,
      devise: "EUR",
      stripe_payment_intent_id,
      status: "succeeded",
      reversement_effectue: false,
    });

    if (errPaiement) {
      console.error("❌ Erreur insertion paiement :", errPaiement.message);
      return new Response("Erreur paiement", { status: 500 });
    }

    console.log(`✅ Paiement groupé confirmé (${inscriptionIds.length} inscriptions, ${montant_total} €)`);
  }

  return new Response("ok", { status: 200 });
});

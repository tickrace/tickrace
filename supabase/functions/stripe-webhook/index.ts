// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
import { Resend } from "https://esm.sh/resend@2.0.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});
const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);
const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

serve(async (req) => {
  console.log("📥 Requête reçue :", req.method);

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "https://www.tickrace.com",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Méthode non autorisée", {
      status: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  console.log("📦 Corps reçu :", body.slice(0, 100) + "...");

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, endpointSecret);
    console.log("✅ Signature Stripe valide :", event.type);
  } catch (err) {
    console.error("⚠️ Signature Stripe invalide :", err.message);
    return new Response("Signature invalide", {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const user_id = session.metadata?.user_id;
    const course_id = session.metadata?.course_id;
    const inscription_id = session.metadata?.inscription_id;
    const montant_total = session.amount_total / 100;
    const stripe_payment_intent_id = session.payment_intent;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: inscription, error: errIns } = await supabase
      .from("inscriptions")
      .select("id, email, nom, prenom")
      .eq("id", inscription_id)
      .eq("statut", "en attente")
      .single();

    if (errIns || !inscription) {
      console.error("❌ Inscription introuvable ou déjà validée.");
      return new Response("Inscription manquante", {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    const { error: errUpdate } = await supabase
      .from("inscriptions")
      .update({ statut: "validée" })
      .eq("id", inscription_id);

    if (errUpdate) {
      console.error("❌ Erreur update inscription :", errUpdate.message);
      return new Response("Erreur update", {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    const { error: errPaiement } = await supabase.from("paiements").insert({
      user_id,
      type: "individuel",
      inscription_id,
      montant_total,
      devise: "EUR",
      stripe_payment_intent_id,
      status: "succeeded",
      reversement_effectue: false,
    });

    if (errPaiement) {
      console.error("❌ Erreur insertion paiement :", errPaiement.message);
      return new Response("Erreur paiement", {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    console.log(`✅ Paiement confirmé : ${montant_total} € pour ${inscription.nom} ${inscription.prenom}`);

    const lien = `https://www.tickrace.com/mon-inscription/${inscription.id}`;
    const html = `
      <p>Bonjour ${inscription.prenom} ${inscription.nom},</p>
      <p>Votre inscription est confirmée 🎉</p>
      <p><strong>Numéro d'inscription :</strong> ${inscription.id}</p>
      <p>👉 <a href="${lien}">Voir mon inscription</a></p>
      <p>Merci pour votre confiance et à bientôt sur la ligne de départ !</p>
      <p>L'équipe Tickrace</p>
    `;

    try {
      await resend.emails.send({
        from: "Tickrace <inscription@tickrace.com>",
        to: inscription.email,
        subject: "Votre inscription est confirmée ✔️",
        html,
      });
      console.log(`📧 Email envoyé à ${inscription.email}`);
    } catch (e) {
      console.error(`❌ Erreur Resend vers ${inscription.email} :`, e.message);
    }
  }

  return new Response("ok", {
    status: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
});

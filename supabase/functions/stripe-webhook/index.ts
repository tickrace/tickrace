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
    const montant_total = session.amount_total / 100;
    const stripe_payment_intent_id = session.payment_intent;
    const inscriptionIds = session.metadata?.inscription_ids?.split(",").filter(Boolean) ?? [];

    console.log("📌 Inscriptions Stripe metadata:", inscriptionIds);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: inscriptions, error: errIns } = await supabase
      .from("inscriptions")
      .select("id, email, nom, prenom")
      .in("id", inscriptionIds);

    if (errIns || !inscriptions || inscriptions.length === 0) {
      console.error("❌ Aucune inscription trouvée pour ce paiement.");
      return new Response("Inscriptions manquantes", {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    const { error: errUpdate } = await supabase
      .from("inscriptions")
      .update({ statut: "validée" })
      .in("id", inscriptionIds);

    if (errUpdate) {
      console.error("❌ Erreur update inscriptions :", errUpdate.message);
      return new Response("Erreur update", {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    const paiementData = {
      user_id,
      inscription_ids: inscriptionIds,
      inscription_id: inscriptionIds.length === 1 ? inscriptionIds[0] : null,
      type: inscriptionIds.length === 1 ? "individuel" : "groupé",
      montant_total,
      devise: "EUR",
      stripe_payment_intent_id,
      status: "succeeded",
      reversement_effectue: false,
    };

    const { data: paiementInserted, error: errPaiement } = await supabase
      .from("paiements")
      .insert(paiementData)
      .select()
      .single();

    if (errPaiement || !paiementInserted) {
      console.error("❌ Erreur insertion paiement :", errPaiement?.message);
      console.error("💥 Données envoyées :", paiementData);
      return new Response("Erreur paiement", {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    console.log("✅ Paiement enregistré :", paiementInserted.id);

    for (const i of inscriptions) {
      const lien = `https://www.tickrace.com/mon-inscription/${i.id}`;
      const html = `
        <p>Bonjour ${i.prenom} ${i.nom},</p>
        <p>Votre inscription est confirmée 🎉</p>
        <p><strong>Numéro d'inscription :</strong> ${i.id}</p>
        <p>👉 <a href="${lien}">Voir mon inscription</a></p>
        <p>Merci pour votre confiance et à bientôt sur la ligne de départ !</p>
        <p>L'équipe Tickrace</p>
      `;

      try {
        await resend.emails.send({
          from: "Tickrace <inscription@tickrace.com>",
          to: i.email,
          subject: "Votre inscription est confirmée ✔️",
          html,
        });
        console.log(`📧 Email envoyé à ${i.email}`);
      } catch (e) {
        console.error(`❌ Erreur Resend vers ${i.email} :`, e.message);
      }
    }
  }

  return new Response("ok", {
    status: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
});

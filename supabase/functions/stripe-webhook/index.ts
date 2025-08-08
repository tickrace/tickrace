// supabase/functions/stripe-webhook/index.ts
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
import { Resend } from "https://esm.sh/resend@3.2.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});
const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

serve(async (req) => {
  // Webhook: pas de CORS
  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig!, endpointSecret);
    console.log("✅ Webhook reçu :", event.type);
  } catch (err: any) {
    console.error("❌ Erreur de signature Stripe :", err.message);
    return new Response("Webhook signature error", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const inscription_id = session.metadata?.inscription_id;
    const user_id = session.metadata?.user_id ?? null;
    const montant_total = (session.amount_total ?? 0) / 100;
    const stripe_payment_intent_id = session.payment_intent as string | null;
    const fallbackEmail = (session.customer_details?.email || session.customer_email || "") as string;

    console.log("🔎 Données session:", {
      inscription_id,
      user_id,
      montant_total,
      stripe_payment_intent_id,
      email_present: !!fallbackEmail,
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

    // Idempotence: déjà payé ?
    const { data: existingPay, error: existingErr } = await supabase
      .from("paiements")
      .select("id, stripe_payment_intent_id")
      .eq("stripe_payment_intent_id", stripe_payment_intent_id)
      .maybeSingle();

    if (existingErr) {
      console.error("⚠️ Erreur lecture paiement existant :", existingErr.message);
      // on continue quand même
    }

    if (existingPay) {
      console.log("ℹ️ Paiement déjà enregistré, on ignore (idempotence):", existingPay.id);
      return new Response("ok", { status: 200 });
    }

    // 1) Valider l’inscription
    const { error: updErr } = await supabase
      .from("inscriptions")
      .update({ statut: "validée" }) // garde ton libellé actuel
      .eq("id", inscription_id);

    if (updErr) {
      console.error("❌ Erreur mise à jour inscription :", updErr.message);
      return new Response("Update error", { status: 500 });
    }
    console.log("✅ Inscription validée :", inscription_id);

    // 2) Insérer le paiement
    const { error: payErr } = await supabase.from("paiements").insert({
      user_id,
      inscription_id,
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

    // 3) Récupérer les infos pour l’email
    const { data: insc, error: inscErr } = await supabase
      .from("inscriptions")
      .select("id, nom, prenom, email, course_id, format_id")
      .eq("id", inscription_id)
      .maybeSingle();

    if (inscErr) {
      console.error("⚠️ Impossible de lire l'inscription pour l'email :", inscErr.message);
    }

    let courseNom: string | null = null;
    let formatNom: string | null = null;

    if (insc?.course_id) {
      const { data: course } = await supabase
        .from("courses")
        .select("nom, lieu")
        .eq("id", insc.course_id)
        .maybeSingle();
      courseNom = course?.nom ?? null;
    }

    if (insc?.format_id) {
      const { data: format } = await supabase
        .from("formats")
        .select("nom")
        .eq("id", insc.format_id)
        .maybeSingle();
      formatNom = format?.nom ?? null;
    }

    const toEmail = (insc?.email || fallbackEmail || "").trim();
    if (!toEmail) {
      console.warn("⚠️ Aucun email disponible pour l'inscription", inscription_id);
    } else {
      // 4) Envoyer l’email via Resend (ne bloque pas le webhook en cas d’échec)
      const courseLabel = courseNom ?? "votre course";
      const formatLabel = formatNom ? ` (${formatNom})` : "";
      const urlInscription = `https://www.tickrace.com/mon-inscription/${inscription_id}`;

      const html = `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height:1.5; color:#111">
          <h2 style="margin:0 0 16px">Confirmation d'inscription</h2>
          <p>Bonjour ${[insc?.prenom, insc?.nom].filter(Boolean).join(" ") || ""},</p>
          <p>Votre inscription à <strong>${courseLabel}${formatLabel}</strong> est <strong>confirmée</strong>.</p>
          <p>Montant payé : <strong>${montant_total.toFixed(2)} EUR</strong></p>
          <p>Vous pouvez consulter le détail de votre inscription ici :</p>
          <p><a href="${urlInscription}" style="color:#6D28D9">Voir mon inscription</a></p>
          <p style="margin-top:24px">Sportivement,<br/>L'équipe Tickrace</p>
        </div>
      `;

      try {
        await resend.emails.send({
          from: "Tickrace <noreply@tickrace.com>",
          to: toEmail,
          subject: "✅ Confirmation d'inscription",
          html,
          text: `Bonjour ${[insc?.prenom, insc?.nom].filter(Boolean).join(" ") || ""},

Votre inscription à ${courseLabel}${formatLabel} est confirmée.
Montant payé : ${montant_total.toFixed(2)} EUR

Voir mon inscription : ${urlInscription}

Sportivement,
L'équipe Tickrace`,
        });
        console.log(`📧 Email de confirmation envoyé à ${toEmail}`);
      } catch (e) {
        console.error("❌ Échec envoi email Resend :", e);
        // on n'échoue pas le webhook pour un souci d'email
      }
    }
  }

  return new Response("ok", { status: 200 });
});

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
  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig!, endpointSecret);
    console.log("✅ Webhook reçu :", event.type, "eventId:", event.id);
  } catch (err: any) {
    console.error("❌ Erreur de signature Stripe :", err?.message);
    return new Response("Webhook signature error", { status: 400 });
  }

  // util: traitement commun (1 ou plusieurs inscriptions)
  async function processPayment(args: {
    inscription_id?: string | null;
    inscription_ids?: string[] | string | null;
    user_id?: string | null;
    prix_total?: string | number | null;
    payment_intent_id: string;
    fallbackEmail?: string | null;
  }) {
    // normaliser ids
    let ids: string[] = [];
    if (args.inscription_id) ids = [args.inscription_id];
    else if (args.inscription_ids) {
      try {
        ids = Array.isArray(args.inscription_ids)
          ? args.inscription_ids
          : JSON.parse(String(args.inscription_ids));
      } catch {
        // noop
      }
    }

    const montant_total = Number(args.prix_total ?? 0);
    const stripe_payment_intent_id = args.payment_intent_id;
    const fallbackEmail = args.fallbackEmail?.trim() || "";

    console.log("🔎 processPayment:", {
      ids,
      montant_total,
      stripe_payment_intent_id,
      hasFallbackEmail: !!fallbackEmail,
    });

    if (!stripe_payment_intent_id || ids.length === 0) {
      console.error("❌ Données manquantes pour processPayment");
      return new Response("Missing data", { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // idempotence
    const { data: existingPay, error: existingErr } = await supabase
      .from("paiements")
      .select("id")
      .eq("stripe_payment_intent_id", stripe_payment_intent_id)
      .maybeSingle();

    if (existingErr) {
      console.warn("⚠️ Erreur lecture paiement existant :", existingErr.message);
    }
    if (existingPay) {
      console.log("ℹ️ Paiement déjà enregistré (idempotence) :", existingPay.id);
      return new Response("ok", { status: 200 });
    }

    // 1) valider inscriptions (⚠️ uniformise le libellé si besoin)
    const { error: updErr } = await supabase
      .from("inscriptions")
      .update({ statut: "validé" }) // ou "validée" si tu tiens au féminin partout
      .in("id", ids);

    if (updErr) {
      console.error("❌ Erreur mise à jour inscriptions :", updErr.message);
      return new Response("Update error", { status: 500 });
    }
    console.log("✅ Inscriptions validées :", ids);

    // 2) insert paiement
    const paiementRow = {
      user_id: args.user_id ?? null,
      inscription_id: ids.length === 1 ? ids[0] : null,
      inscription_ids: ids.length > 1 ? ids : null,
      montant_total: isFinite(montant_total) ? montant_total : null,
      devise: "EUR",
      stripe_payment_intent_id,
      status: "succeeded",
      reversement_effectue: false,
      type: ids.length > 1 ? "groupé" : "individuel",
    };

    const { error: payErr } = await supabase.from("paiements").insert(paiementRow);
    if (payErr) {
      console.error("❌ Erreur insertion paiement :", payErr.message);
      return new Response("Insert payment error", { status: 500 });
    }
    console.log("✅ Paiement enregistré :", paiementRow);

    // 3) emails (un par inscription)
    const { data: inscriptions, error: inscErr } = await supabase
      .from("inscriptions")
      .select("id, nom, prenom, email, course_id, format_id")
      .in("id", ids);

    if (inscErr) {
      console.error("⚠️ Lecture inscriptions pour email :", inscErr.message);
    }

    // petite cache pour éviter N requêtes identiques
    const courseCache = new Map<string, { nom: string | null; lieu: string | null }>();
    const formatCache = new Map<string, { nom: string | null }>();

    async function getCourse(course_id: string | null) {
      if (!course_id) return { nom: "votre course", lieu: null };
      if (!courseCache.has(course_id)) {
        const { data } = await supabase
          .from("courses")
          .select("nom, lieu")
          .eq("id", course_id)
          .maybeSingle();
        courseCache.set(course_id, { nom: data?.nom ?? null, lieu: data?.lieu ?? null });
      }
      return courseCache.get(course_id)!;
    }

    async function getFormat(format_id: string | null) {
      if (!format_id) return { nom: null };
      if (!formatCache.has(format_id)) {
        const { data } = await supabase
          .from("formats")
          .select("nom")
          .eq("id", format_id)
          .maybeSingle();
        formatCache.set(format_id, { nom: data?.nom ?? null });
      }
      return formatCache.get(format_id)!;
    }

    for (const insc of inscriptions || []) {
      const toEmail = (insc.email || fallbackEmail || "").trim();
      if (!toEmail) {
        console.warn("⚠️ Aucun email pour l'inscription", insc.id);
        continue;
      }

      const course = await getCourse(insc.course_id);
      const format = await getFormat(insc.format_id);
      const courseLabel = course.nom ?? "votre course";
      const formatLabel = format.nom ? ` (${format.nom})` : "";
      const urlInscription = `https://www.tickrace.com/mon-inscription/${insc.id}`;

      const html = `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height:1.5; color:#111">
          <h2 style="margin:0 0 16px">Confirmation d'inscription</h2>
          <p>Bonjour ${[insc.prenom, insc.nom].filter(Boolean).join(" ") || ""},</p>
          <p>Votre inscription à <strong>${courseLabel}${formatLabel}</strong> est <strong>confirmée</strong>.</p>
          <p>Montant payé : <strong>${(isFinite(montant_total) ? montant_total : 0).toFixed(2)} EUR</strong></p>
          <p>Consulter votre inscription :</p>
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
          text: `Bonjour ${[insc.prenom, insc.nom].filter(Boolean).join(" ") || ""},
Votre inscription à ${courseLabel}${formatLabel} est confirmée.
Montant payé : ${(isFinite(montant_total) ? montant_total : 0).toFixed(2)} EUR
Voir mon inscription : ${urlInscription}
Sportivement,
L'équipe Tickrace`,
        });
        console.log(`📧 Email envoyé à ${toEmail} (inscription ${insc.id})`);
      } catch (e) {
        console.error("❌ Échec envoi email Resend :", e);
      }
    }

    return new Response("ok", { status: 200 });
  }

  // Flux 1 : Checkout session completed (idéal)
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    console.log("🧾 session.metadata =", session.metadata);

    return await processPayment({
      inscription_id: session.metadata?.inscription_id ?? null,
      inscription_ids: session.metadata?.inscription_ids ?? null,
      user_id: session.metadata?.user_id ?? null,
      prix_total: session.metadata?.prix_total ?? (session.amount_total ?? 0) / 100,
      payment_intent_id: (session.payment_intent as string) ?? "",
      fallbackEmail: (session.customer_details?.email || session.customer_email || "") as string,
    });
  }

  // Flux 2 : Charge succeeded (fallback) — on lit le PI.metadata ou la Session via PI
  if (event.type === "charge.succeeded") {
    const charge = event.data.object as Stripe.Charge;
    const piId = charge.payment_intent as string;
    console.log("💳 charge.succeeded for PI:", piId, "chargeId:", charge.id);

    // 2a) Essayer PI.metadata d'abord
    try {
      const pi = await stripe.paymentIntents.retrieve(piId);
      // @ts-ignore deno types
      const md = (pi.metadata || {}) as Record<string, string>;
      if (md && (md.inscription_id || md.inscription_ids)) {
        console.log("🧾 PI.metadata présent → traitement via PI.metadata", md);
        return await processPayment({
          inscription_id: md.inscription_id ?? null,
          inscription_ids: (md.inscription_ids as any) ?? null,
          user_id: md.user_id ?? null,
          prix_total: md.prix_total ?? (pi.amount ?? 0) / 100,
          payment_intent_id: piId,
          fallbackEmail: charge.receipt_email || charge.billing_details?.email || null,
        });
      }
    } catch (e) {
      console.warn("⚠️ lecture PI.metadata échouée:", e);
    }

    // 2b) Sinon, retrouver la Checkout Session via PI
    try {
      const list = await stripe.checkout.sessions.list({ payment_intent: piId, limit: 1 });
      const session = list.data?.[0];
      if (session) {
        console.log("🧾 Retrouvé Checkout Session par PI =", session.id, "metadata:", session.metadata);
        return await processPayment({
          inscription_id: session.metadata?.inscription_id ?? null,
          inscription_ids: session.metadata?.inscription_ids ?? null,
          user_id: session.metadata?.user_id ?? null,
          prix_total: session.metadata?.prix_total ?? (session.amount_total ?? 0) / 100,
          payment_intent_id: piId,
          fallbackEmail: (session.customer_details?.email || session.customer_email || "") as string,
        });
      }
    } catch (e) {
      console.warn("⚠️ Impossible de retrouver la Checkout Session par PI:", e);
    }

    console.error("❌ Impossible de déterminer les inscriptions depuis charge.succeeded (pas de metadata)");
    return new Response("Missing metadata", { status: 400 });
  }

  // ignorer les autres events
  return new Response("ok", { status: 200 });
});

// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
import { Resend } from "https://esm.sh/resend@3.2.0";

// ====== ENV ======
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const TICKRACE_BASE_URL = Deno.env.get("TICKRACE_BASE_URL")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(RESEND_API_KEY);

// ====== CORS (utile si tu veux tester en direct) ======
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let event;
  try {
    const sig = req.headers.get("stripe-signature")!;
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Bad signature", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Récupère le PaymentIntent pour récupérer app_fee + destination
      const pi = await stripe.paymentIntents.retrieve(
        session.payment_intent as string,
      );

      const amountTotalCents = session.amount_total ?? pi.amount ?? 0;
      const applicationFeeCents = (pi.application_fee_amount ?? 0);

      // Destination account (si destination charges)
      const destinationAccount = (pi.transfer_data as any)?.destination ?? null;

      // Récupère l’ID de charge
      const chargeId = (pi.latest_charge as string) || null;

      // Frais Stripe (depuis la balance transaction du compte connecté si destination)
      let stripeFeeCents: number | null = null;
      let balanceTxId: string | null = null;

      if (chargeId) {
        if (destinationAccount) {
          // Charge est sur le compte connecté
          const ch = await stripe.charges.retrieve(chargeId, {
            stripeAccount: destinationAccount,
            expand: ["balance_transaction"],
          });
          const bt = ch.balance_transaction as unknown as Stripe.BalanceTransaction;
          stripeFeeCents = bt?.fee ?? null;
          balanceTxId = bt?.id ?? null;
        } else {
          // Charge sur le compte plateforme
          const ch = await stripe.charges.retrieve(chargeId, {
            expand: ["balance_transaction"],
          });
          const bt = ch.balance_transaction as unknown as Stripe.BalanceTransaction;
          stripeFeeCents = bt?.fee ?? null;
          balanceTxId = bt?.id ?? null;
        }
      }

      const netToOrganizerCents =
        (amountTotalCents ?? 0) - (applicationFeeCents ?? 0) - (stripeFeeCents ?? 0);

      // Métadonnées (inscription unique)
      const inscriptionIdMeta =
        (session.metadata?.inscription_id as string) ??
        (pi.metadata?.inscription_id as string) ?? null;

      const inscriptionIds: string[] = inscriptionIdMeta
        ? [inscriptionIdMeta]
        : [];

      // 1) MAJ inscriptions -> validé
      if (inscriptionIds.length > 0) {
        const { error: errUpdate } = await supabase
          .from("inscriptions")
          .update({ statut: "validé" })
          .in("id", inscriptionIds);
        if (errUpdate) console.error("Erreur MAJ inscriptions:", errUpdate);
      }

      // 2) Enregistrement paiement
      const { error: errPay } = await supabase.from("paiements").insert({
        inscription_ids: inscriptionIds,
        stripe_payment_intent_id: String(pi.id),
        stripe_charge_id: chargeId,
        stripe_balance_transaction_id: balanceTxId,
        destination_account_id: destinationAccount,
        amount_total_cents: amountTotalCents,
        application_fee_cents: applicationFeeCents,
        stripe_fee_cents: stripeFeeCents,
        net_to_organizer_cents: netToOrganizerCents,
        currency: (pi.currency ?? "eur"),
      });
      if (errPay) console.error("Erreur insert paiements:", errPay);

      // 3) Envoi email confirmation (à chaque inscription)
      if (inscriptionIds.length > 0) {
        const { data: rows } = await supabase
          .from("inscriptions")
          .select("id, email, nom, prenom")
          .in("id", inscriptionIds);

        for (const row of rows ?? []) {
          if (!row?.email) continue;
          try {
            await resend.emails.send({
              from: "Tickrace <no-reply@tickrace.com>",
              to: row.email,
              subject: "Confirmation d’inscription",
              html: `
                <div style="font-family:Arial,sans-serif;">
                  <h2>Votre inscription est confirmée ✅</h2>
                  <p>Bonjour ${row.prenom ?? ""} ${row.nom ?? ""},</p>
                  <p>Nous confirmons le paiement et la validation de votre inscription.</p>
                  <p>Votre numéro d’inscription : <strong>${row.id}</strong></p>
                  <p>Consultez votre inscription ici :</p>
                  <p><a href="${TICKRACE_BASE_URL}/mon-inscription/${row.id}">${TICKRACE_BASE_URL}/mon-inscription/${row.id}</a></p>
                  <hr/>
                  <p>Merci et bonne préparation !</p>
                </div>
              `,
            });
          } catch (e) {
            console.error("Erreur envoi email Resend:", e);
          }
        }
      }
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("Erreur webhook:", e);
    return new Response("error", { status: 500, headers: corsHeaders });
  }
});

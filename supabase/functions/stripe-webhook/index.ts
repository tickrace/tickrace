// supabase/functions/stripe-webhook/index.ts
// Edge Function Stripe Webhook pour Tickrace

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.6.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- ENV --------------------------------------------------------------------

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SEND_INSCRIPTION_EMAIL_URL = Deno.env.get("SEND_INSCRIPTION_EMAIL_URL")!;
// Exemple: "https://xxx.supabase.co/functions/v1/send-inscription-email"

// ---------------------------------------------------------------------------

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---------------------------------------------------------------------------

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let event: Stripe.Event;

  try {
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      console.error("Missing stripe-signature header");
      return new Response("Bad Request", { status: 400 });
    }

    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("❌ Erreur construction event Stripe:", err);
    return new Response("Webhook Error", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }
      // Si besoin, tu peux gérer d’autres events (payment_intent.succeeded, refund, etc.)
      default:
        console.log("ℹ️ Event non géré:", event.type);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("❌ Erreur traitement webhook:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
});

// ---------------------------------------------------------------------------
//  LOGIQUE PRINCIPALE
// ---------------------------------------------------------------------------

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log("✅ checkout.session.completed:", session.id);

  // --- Récup des métadatas --------------------------------------------------
  const metadata = session.metadata || {};
  const inscriptionIdsRaw = metadata.inscription_ids ?? "[]";
  let inscriptionIds: string[] = [];

  try {
    if (typeof inscriptionIdsRaw === "string") {
      inscriptionIds = JSON.parse(inscriptionIdsRaw);
    } else if (Array.isArray(inscriptionIdsRaw)) {
      inscriptionIds = inscriptionIdsRaw;
    }
  } catch (e) {
    console.warn("Impossible de parser inscription_ids, valeur brute:", inscriptionIdsRaw);
    inscriptionIds = [];
  }

  const mainInscriptionId = inscriptionIds.length === 1 ? inscriptionIds[0] : null;
  const typeInscription = metadata.type ?? "individuel";
  const traceId = metadata.trace_id ?? null;

  // --- Récup PaymentIntent + Charge + Balance Transaction -------------------

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  if (!paymentIntentId) {
    console.error("❌ Aucun payment_intent sur la session", session.id);
    throw new Error("Missing payment_intent");
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });

  const charge =
    typeof paymentIntent.latest_charge === "string"
      ? await stripe.charges.retrieve(paymentIntent.latest_charge)
      : (paymentIntent.latest_charge as Stripe.Charge | null);

  if (!charge) {
    console.error("❌ Aucun charge lié au PaymentIntent", paymentIntentId);
    throw new Error("Missing charge");
  }

  const amountTotalCents =
    session.amount_total ?? paymentIntent.amount_received ?? paymentIntent.amount ?? 0;
  const amountSubtotalCents = session.amount_subtotal ?? null;

  // Balance transaction pour les frais Stripe
  let balanceTxId: string | null = null;
  if (typeof charge.balance_transaction === "string") {
    balanceTxId = charge.balance_transaction;
  }

  let balanceTx: Stripe.BalanceTransaction | null = null;
  if (balanceTxId) {
    balanceTx = await stripe.balanceTransactions.retrieve(balanceTxId);
  }

  const applicationFeeAmount =
    (paymentIntent.application_fee_amount as number | null) ??
    (charge.application_fee_amount as number | null) ??
    0;

  const destinationAccountId =
    (charge.transfer_data as any)?.destination ??
    (charge.destination as string | null) ??
    null;

  const platformFeeAmount =
    applicationFeeAmount && applicationFeeAmount > 0
      ? applicationFeeAmount
      : Math.round(amountTotalCents * 0.05); // fallback 5% si pas de application_fee_amount

  const feeTotal = balanceTx?.fee ?? null;

  // Transfert direct (si tu utilises transfer_group / charges avec transfert direct)
  const transferId =
    typeof charge.transfer === "string"
      ? charge.transfer
      : (charge.transfer as Stripe.Transfer | undefined)?.id ?? null;

  // Montant en euros pour affichage (pour info)
  const montantTotalEur = amountTotalCents / 100;

  // --- Upsert dans la table paiements --------------------------------------

  const paiementPayload: Record<string, any> = {
    inscription_id: mainInscriptionId,
    inscription_ids: inscriptionIds.length ? inscriptionIds : null,
    montant_total: montantTotalEur, // numeric en euros
    devise: session.currency ?? "eur",
    stripe_payment_intent_id: paymentIntentId,
    stripe_session_id: session.id,
    stripe_payment_intent: paymentIntentId,
    stripe_charge_id: charge.id,
    charge_id: charge.id,
    receipt_url: charge.receipt_url ?? null,
    status: "paye",
    reversement_effectue: false,
    type: typeInscription,
    trace_id: traceId,
    amount_subtotal: amountSubtotalCents,
    amount_total: amountTotalCents,
    total_amount_cents: amountTotalCents,
    fee_total: feeTotal,
    balance_transaction_id: balanceTx?.id ?? balanceTxId,
    application_fee_amount: applicationFeeAmount || null,
    destination_account_id: destinationAccountId,
    platform_fee_amount: platformFeeAmount,
    transferred_total_cents: 0,
    refunded_total_cents: 0,
    reversed_total_cents: 0,
  };

  // On upsert via stripe_session_id (unique par paiement)
  const { data: existingPaiement, error: searchError } = await supabaseAdmin
    .from("paiements")
    .select("id")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (searchError) {
    console.error("Erreur recherche paiement existant:", searchError);
  }

  let paiementId: string | null = null;

  if (existingPaiement?.id) {
    const { data, error } = await supabaseAdmin
      .from("paiements")
      .update(paiementPayload)
      .eq("id", existingPaiement.id)
      .select("id")
      .single();

    if (error) {
      console.error("❌ Erreur update paiement:", error);
      throw error;
    }
    paiementId = data.id;
  } else {
    const { data, error } = await supabaseAdmin
      .from("paiements")
      .insert(paiementPayload)
      .select("id")
      .single();

    if (error) {
      console.error("❌ Erreur insert paiement:", error);
      throw error;
    }
    paiementId = data.id;
  }

  console.log("✅ Paiement enregistré / mis à jour:", paiementId);

  // --- Mise à jour des inscriptions + envoi d’email ------------------------

  // NB : même si tu veux supprimer les inscriptions groupées à terme,
  // cette boucle gère à la fois 1 ou plusieurs inscriptions.
  for (const inscriptionId of inscriptionIds) {
    // 1) update statut inscription => "valide" & liaison paiement
    const { error: updateInsError } = await supabaseAdmin
      .from("inscriptions")
      .update({
        statut: "valide", // adapte si ton enum est différent
        paiement_id: paiementId,
      })
      .eq("id", inscriptionId);

    if (updateInsError) {
      console.error(
        `❌ Erreur update inscription ${inscriptionId} :`,
        updateInsError,
      );
      continue;
    }

    console.log(`✅ Inscription ${inscriptionId} mise à jour`);

    // 2) Appel de la fonction send-inscription-email pour chaque coureur
    try {
      await sendConfirmationEmail(inscriptionId);
      console.log(`📧 Email de confirmation envoyé pour inscription ${inscriptionId}`);
    } catch (e) {
      console.error(`❌ Erreur envoi email pour inscription ${inscriptionId}:`, e);
    }
  }
}

// ---------------------------------------------------------------------------
//  APPEL DE L’EDGE FUNCTION D’ENVOI D’EMAIL
// ---------------------------------------------------------------------------

async function sendConfirmationEmail(inscriptionId: string) {
  if (!SEND_INSCRIPTION_EMAIL_URL) {
    console.warn("SEND_INSCRIPTION_EMAIL_URL non défini, email non envoyé.");
    return;
  }

  const res = await fetch(SEND_INSCRIPTION_EMAIL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Si tu sécurises par Bearer:
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      inscription_id: inscriptionId,
      // Le Edge function send-inscription-email va lui-même
      // récupérer nom de course + montant total + options.
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Erreur send-inscription-email:", res.status, text);
    throw new Error("send-inscription-email failed");
  }
}

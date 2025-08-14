// supabase/functions/stripe-webhook/index.ts
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
import { Resend } from "https://esm.sh/resend@3.2.0?target=deno&deno-std=0.192.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const TICKRACE_BASE_URL = Deno.env.get("TICKRACE_BASE_URL") || "https://www.tickrace.com";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const resendApiKey = Deno.env.get("RESEND_API_KEY") || null;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const ALLOWLIST = ["https://www.tickrace.com","http://localhost:5173","http://127.0.0.1:5173"];
function cors(origin: string | null) {
  const allowed = origin && ALLOWLIST.includes(origin) ? origin : ALLOWLIST[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature, prefer",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}
const isUUID = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v as string);

serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers });

  // Vérif signature
  let event: Stripe.Event;
  try {
    const sig = req.headers.get("stripe-signature")!;
    const raw = await req.text();
    event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch (e: any) {
    console.error("❌ Bad signature:", e?.message ?? e);
    return new Response(JSON.stringify({ error: "Bad signature" }), { status: 400, headers });
  }

  try {
    // ⚠️ Direct charges ⇒ on attend des events "connect" avec event.account = acct_...
    const connectedAccount = (event as any).account as string | undefined;
    if (!connectedAccount) {
      console.error("❌ Event sans 'account' (Connect non activé sur l’endpoint)");
      return new Response(JSON.stringify({ error: "Missing connected account in event" }), { status: 400, headers });
    }

    if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
      let session: Stripe.Checkout.Session | null = null;
      let pi: Stripe.PaymentIntent;

      if (event.type === "checkout.session.completed") {
        session = event.data.object as Stripe.Checkout.Session;
        pi = await stripe.paymentIntents.retrieve(
          session.payment_intent as string,
          { stripeAccount: connectedAccount, expand: ["latest_charge.balance_transaction"] }
        );
      } else {
        // payment_intent.succeeded envoyé par le compte connecté
        pi = await stripe.paymentIntents.retrieve(
          (event.data.object as Stripe.PaymentIntent).id,
          { stripeAccount: connectedAccount, expand: ["latest_charge.balance_transaction"] }
        );
      }

      const amountTotalCents = (session?.amount_total ?? pi.amount) ?? 0;
      const currency = (pi.currency ?? "eur");
      const applicationFeeCents = typeof pi.application_fee_amount === "number"
        ? pi.application_fee_amount
        : Math.round(amountTotalCents * 0.05); // fallback

      // Métadonnées (dispo directement dans l’event, au pire via PI)
      const md = { ...(session?.metadata || {}), ...(pi.metadata || {}) } as Record<string,string>;
      const inscription_id = md["inscription_id"];
      const course_id = md["course_id"];
      const user_id = md["user_id"];
      const trace_id = md["trace_id"];

      if (!isUUID(inscription_id) || !isUUID(course_id) || !isUUID(user_id) || !isUUID(trace_id)) {
        console.error("❌ Metadata invalide", { inscription_id, course_id, user_id, trace_id });
        return new Response(JSON.stringify({ error: "Metadata manquante" }), { status: 400, headers });
      }

      // Idempotence via PI
      const { data: exists } = await supabase.from("paiements").select("id").eq("stripe_payment_intent_id", String(pi.id)).maybeSingle();
      if (exists) {
        await supabase.from("inscriptions").update({ statut: "validé" }).eq("id", inscription_id);
        return new Response(JSON.stringify({ ok: true, duplicated: true }), { status: 200, headers });
      }

      // Frais Stripe (sur le compte connecté) + reçu
      let stripeFeeCents = 0, balanceTxId: string | null = null, chargeId: string | null = null, receiptUrl: string | null = null;
      if (pi.latest_charge) {
        const ch = typeof (pi.latest_charge as any).balance_transaction !== "undefined"
          ? (pi.latest_charge as any)
          : await stripe.charges.retrieve(pi.latest_charge as string, { stripeAccount: connectedAccount, expand: ["balance_transaction"] });

        chargeId = ch.id;
        const bt = ch.balance_transaction as Stripe.BalanceTransaction | undefined;
        stripeFeeCents = bt?.fee ?? 0;
        balanceTxId = bt?.id ?? null;
        receiptUrl = ch.receipt_url ?? null;
      }

      // MAJ inscription
      await supabase.from("inscriptions").update({ statut: "validé" }).eq("id", inscription_id);

      // Upsert paiements (complète le pré-insert par trace_id si présent)
      const row = {
        inscription_id,
        montant_total: amountTotalCents / 100, devise: currency,
        stripe_payment_intent_id: String(pi.id),
        status: pi.status ?? "succeeded",
        reversement_effectue: false,
        user_id, type: "individuel",
        inscription_ids: [inscription_id],
        trace_id,
        receipt_url: receiptUrl,
        charge_id: chargeId,
        application_fee_amount: applicationFeeCents,
        destination_account_id: connectedAccount, // 👈 le compte connecté
        transfer_id: null,                        // pas de transfer en direct charges
        amount_subtotal: amountTotalCents,
        amount_total: amountTotalCents,
        fee_total: stripeFeeCents,                // 👈 frais Stripe déduits chez l’organisateur
        balance_transaction_id: balanceTxId,
      };

      const { data: pre } = await supabase.from("paiements").select("id").eq("trace_id", trace_id).maybeSingle();
      if (pre?.id) await supabase.from("paiements").update(row).eq("id", pre.id);
      else         await supabase.from("paiements").insert(row);

      // Email (optionnel)
      try {
        if (resend) {
          const { data: insc } = await supabase.from("inscriptions").select("id, email, nom, prenom").eq("id", inscription_id).single();
          if (insc?.email) {
            await resend.emails.send({
              from: "Tickrace <no-reply@tickrace.com>",
              to: insc.email,
              sub

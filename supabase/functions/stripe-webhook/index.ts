// supabase/functions/stripe-webhook/index.ts
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
import { Resend } from "https://esm.sh/resend@3.2.0?target=deno&deno-std=0.192.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const TICKRACE_BASE_URL = Deno.env.get("TICKRACE_BASE_URL") || "https://www.tickrace.com";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const resendApiKey = Deno.env.get("RESEND_API_KEY") || null;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const ALLOWLIST = [
  "https://www.tickrace.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function cors(origin: string | null) {
  const allowedOrigin = origin && ALLOWLIST.includes(origin) ? origin : ALLOWLIST[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, stripe-signature, prefer",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}

function isUUID(v: unknown) {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

serve(async (req) => {
  const headers = cors(req.headers.get("origin"));

  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), {
      status: 405,
      headers,
    });
  }

  // 🔐 Vérif signature
  let event: Stripe.Event;
  try {
    const sig = req.headers.get("stripe-signature")!;
    const raw = await req.text();
    event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch (e: any) {
    console.error("❌ Webhook bad signature:", e?.message ?? e);
    return new Response(JSON.stringify({ error: "Bad signature" }), {
      status: 400,
      headers,
    });
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
      let pi: Stripe.PaymentIntent;
      let session: Stripe.Checkout.Session | null = null;

      if (event.type === "checkout.session.completed") {
        session = event.data.object as Stripe.Checkout.Session;
        pi = await stripe.paymentIntents.retrieve(
          session.payment_intent as string
        );
      } else {
        pi = event.data.object as Stripe.PaymentIntent;
      }

      // Sur destination charges :
      // - la charge est sur le compte connecté (destination)
      // - application_fee_amount est sur le PI (plateforme)
      const amountTotalCents = (session?.amount_total ?? pi.amount) ?? 0;
      const currency = (pi.currency ?? "eur");
      const applicationFeeCents = (pi.application_fee_amount ?? 0);

      // Destination account depuis PI.transfer_data
      const destinationAccount = (pi.transfer_data as any)?.destination ?? null;

      // Metadata
      const md = {
        ...(session?.metadata || {}),
        ...(pi.metadata || {}),
      } as Record<string, string>;

      const inscription_id = md["inscription_id"];
      const course_id = md["course_id"];
      const user_id = md["user_id"];
      const trace_id = md["trace_id"];

      if (!isUUID(inscription_id) || !isUUID(course_id) || !isUUID(user_id) || !isUUID(trace_id)) {
        console.error("❌ Metadata manquante/invalide", { inscription_id, course_id, user_id, trace_id });
        return new Response(JSON.stringify({ error: "Metadata manquante" }), {
          status: 400,
          headers,
        });
      }

      console.log("🧭 TRACE stripe-webhook (Destination charges)", {
        trace_id, inscription_id, course_id, user_id, amountTotalCents, currency, destinationAccount, applicationFeeCents
      });

      // Idempotence via PI
      const { data: exists } = await supabase
        .from("paiements")
        .select("id")
        .eq("stripe_payment_intent_id", String(pi.id))
        .maybeSingle();
      if (exists) {
        console.log("ℹ️ Paiement déjà enregistré (idempotent).", { pi: pi.id });
        await supabase.from("inscriptions").update({ statut: "validé" }).eq("id", inscription_id);
        return new Response(JSON.stringify({ ok: true, duplicated: true }), { status: 200, headers });
      }

      // Récup charge (sur le compte connecté) pour :
      // - frais Stripe réels du compte connecté (fee_total),
      // - receipt_url,
      // - balance_transaction_id
      let stripeFeeCents: number | null = null;
      let balanceTxId: string | null = null;
      let chargeId: string | null = null;
      let receiptUrl: string | null = null;

      if (pi.latest_charge && destinationAccount) {
        const ch = await stripe.charges.retrieve(
          pi.latest_charge as string,
          { stripeAccount: destinationAccount, expand: ["balance_transaction"] },
        );
        chargeId = ch.id;
        receiptUrl = (ch as any).receipt_url ?? null;
        const bt = ch.balance_transaction as unknown as Stripe.BalanceTransaction;
        stripeFeeCents = bt?.fee ?? null;
        balanceTxId = bt?.id ?? null;
      }

      // MAJ inscription -> validé
      await supabase.from("inscriptions").update({ statut: "validé" }).eq("id", inscription_id);

      // Upsert paiements (compléter le pré-insert par trace_id si existant)
      const row = {
        inscription_id,
        montant_total: amountTotalCents / 100,  // euros
        devise: currency,
        stripe_payment_intent_id: String(pi.id),
        status: pi.status ?? "succeeded",
        reversement_effectue: false,
        user_id,
        type: "individuel",
        inscription_ids: [inscription_id],
        trace_id,
        receipt_url: receiptUrl,
        charge_id: chargeId,
        application_fee_amount: applicationFeeCents,
        destination_account_id: destinationAccount,
        transfer_id: null,                      // pas de transfer manuel en destination charges
        amount_subtotal: amountTotalCents,      // cents
        amount_total: amountTotalCents,         // cents
        fee_total: stripeFeeCents,              // frais Stripe (compte connecté)
        balance_transaction_id: balanceTxId,
      };

      // Compléter la ligne pré-enregistrée si elle existe
      const { data: pre } = await supabase
        .from("paiements")
        .select("id")
        .eq("trace_id", trace_id)
        .maybeSingle();

      if (pre?.id) {
        const { error: upErr } = await supabase.from("paiements").update(row).eq("id", pre.id);
        if (upErr) console.error("❌ Erreur update paiements:", upErr);
      } else {
        const { error: insErr } = await supabase.from("paiements").insert(row);
        if (insErr) console.error("❌ Erreur insert paiements:", insErr);
      }

      // Email (optionnel)
      try {
        if (resend) {
          const { data: insc } = await supabase
            .from("inscriptions")
            .select("id, email, nom, prenom")
            .eq("id", inscription_id)
            .single();

          if (insc?.email) {
            await resend.emails.send({
              from: "Tickrace <no-reply@tickrace.com>",
              to: insc.email,
              subject: "Confirmation d’inscription",
              html: `
                <div style="font-family:Arial,sans-serif;">
                  <h2>Votre inscription est confirmée ✅</h2>
                  <p>Bonjour ${insc.prenom ?? ""} ${insc.nom ?? ""},</p>
                  <p>Nous confirmons le paiement et la validation de votre inscription.</p>
                  <p>Votre numéro d’inscription : <strong>${insc.id}</strong></p>
                  <p>Consultez votre inscription :</p>
                  <p><a href="${TICKRACE_BASE_URL}/mon-inscription/${insc.id}">${TICKRACE_BASE_URL}/mon-inscription/${insc.id}</a></p>
                  <hr/>
                  <p>Merci et bonne préparation !</p>
                </div>
              `,
            });
          }
        }
      } catch (e) {
        console.error("⚠️ Erreur envoi email Resend:", e);
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    // Événements non gérés
    return new Response(JSON.stringify({ ok: true, ignored: event.type }), {
      status: 200,
      headers,
    });
  } catch (e: any) {
    console.error("💥 Erreur stripe-webhook:", e?.message ?? e, e?.stack);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), {
      status: 500,
      headers,
    });
  }
});

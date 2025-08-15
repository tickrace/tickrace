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
  const o = origin && ALLOWLIST.includes(origin) ? origin : ALLOWLIST[0];
  return {
    "Access-Control-Allow-Origin": o,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature, prefer",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}
const isUUID = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v as string);

// util: lit charge + balance transaction sur le connected account
async function readChargeWithBT(chargeId: string, connectedAcct: string) {
  // 1) essayer avec expand
  try {
    const charge = await stripe.charges.retrieve(chargeId, {
      stripeAccount: connectedAcct,
      expand: ["balance_transaction"],
    }) as any;

    let btId: string | null = null;
    let fee = 0;

    if (charge?.balance_transaction && typeof charge.balance_transaction === "object") {
      btId = charge.balance_transaction.id ?? null;
      fee = charge.balance_transaction.fee ?? 0;
    } else if (typeof charge?.balance_transaction === "string") {
      btId = charge.balance_transaction;
      try {
        const bt = await stripe.balanceTransactions.retrieve(btId, { stripeAccount: connectedAcct });
        fee = bt?.fee ?? 0;
      } catch (e) {
        console.warn("⚠️ balanceTransactions.retrieve a échoué:", (e as any)?.message ?? e);
      }
    } else {
      console.warn("⚠️ Pas de balance_transaction sur la charge.");
    }

    return {
      chargeId: charge?.id ?? null,
      receiptUrl: charge?.receipt_url ?? null,
      balanceTxId: btId,
      stripeFeeCents: fee,
    };
  } catch (e) {
    console.error("❌ charges.retrieve (connected) a échoué:", (e as any)?.message ?? e);
    return { chargeId: null, receiptUrl: null, balanceTxId: null, stripeFeeCents: 0 };
  }
}

serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers });

  // signature
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
    let connectedAccount = (event as any).account as string | undefined;

    let session: Stripe.Checkout.Session | null = null;
    let pi: Stripe.PaymentIntent | null = null;
    let chEvt: Stripe.Charge | null = null;
    let md: Record<string, string> = {};

    if (event.type === "checkout.session.completed") {
      session = event.data.object as Stripe.Checkout.Session;
      md = { ...(session.metadata || {}) };
    } else if (event.type === "payment_intent.succeeded") {
      pi = event.data.object as Stripe.PaymentIntent;
      md = { ...(pi.metadata || {}) };
    } else if (event.type === "charge.succeeded" || event.type === "charge.captured") {
      // Très fiable pour récupérer balance_transaction
      chEvt = event.data.object as Stripe.Charge;
      // On récupère le PI pour les metadata
      const piId = chEvt.payment_intent as string | undefined;
      if (!connectedAccount) {
        // fallback si endpoint pas en "connected events"
        // on retrouvera plus bas via course_id
      }
      if (piId && connectedAccount) {
        pi = await stripe.paymentIntents.retrieve(piId, { stripeAccount: connectedAccount });
        md = { ...(pi.metadata || {}) };
      }
    } else {
      return new Response(JSON.stringify({ ok: true, ignored: event.type }), { status: 200, headers });
    }

    const inscription_id = md["inscription_id"];
    const course_id = md["course_id"];
    const user_id = md["user_id"];
    const trace_id = md["trace_id"];

    if (!isUUID(inscription_id) || !isUUID(course_id) || !isUUID(user_id) || !isUUID(trace_id)) {
      console.error("❌ Metadata invalide", { inscription_id, course_id, user_id, trace_id });
      return new Response(JSON.stringify({ error: "Metadata manquante" }), { status: 400, headers });
    }

    // fallback si pas d'account dans l'event
    if (!connectedAccount) {
      const { data: course, error: cErr } = await supabase
        .from("courses").select("organisateur_id").eq("id", course_id).single();
      if (cErr || !course) return new Response(JSON.stringify({ error: "Course introuvable" }), { status: 404, headers });

      const { data: profil, error: pErr } = await supabase
        .from("profils_utilisateurs").select("stripe_account_id").eq("user_id", course.organisateur_id).maybeSingle();
      if (pErr || !profil?.stripe_account_id) {
        return new Response(JSON.stringify({ error: "Organisateur non configuré Stripe" }), { status: 409, headers });
      }
      connectedAccount = profil.stripe_account_id;
    }

    // Récupérer PI si on ne l'a pas encore
    if (!pi && session?.payment_intent) {
      pi = await stripe.paymentIntents.retrieve(session.payment_intent as string, {
        stripeAccount: connectedAccount,
        expand: ["latest_charge.balance_transaction"],
      });
    } else if (pi && !(pi as any).latest_charge) {
      pi = await stripe.paymentIntents.retrieve(pi.id, {
        stripeAccount: connectedAccount,
        expand: ["latest_charge.balance_transaction"],
      });
    } else if (!pi && chEvt?.payment_intent) {
      pi = await stripe.paymentIntents.retrieve(chEvt.payment_intent as string, {
        stripeAccount: connectedAccount,
        expand: ["latest_charge.balance_transaction"],
      });
    }

    if (!pi) return new Response(JSON.stringify({ error: "PaymentIntent introuvable" }), { status: 404, headers });

    const amountTotalCents = (session?.amount_total ?? (chEvt?.amount ?? pi.amount)) ?? 0;
    const currency = (pi.currency ?? "eur");
    const applicationFeeCents = typeof pi.application_fee_amount === "number"
      ? pi.application_fee_amount : Math.round(amountTotalCents * 0.05);

    // Lire charge + balance transaction (priorité: event charge, sinon PI.latest_charge)
    let chargeId: string | null = null;
    if (chEvt?.id) chargeId = chEvt.id;
    else if (typeof pi.latest_charge === "string") chargeId = pi.latest_charge;
    else if ((pi.latest_charge as any)?.id) chargeId = (pi.latest_charge as any).id;

    let stripeFeeCents = 0, balanceTxId: string | null = null, receiptUrl: string | null = null;
    if (chargeId) {
      const { chargeId: cid, receiptUrl: ru, balanceTxId: btid, stripeFeeCents: fee } =
        await readChargeWithBT(chargeId, connectedAccount);
      chargeId = cid;
      receiptUrl = ru;
      balanceTxId = btid;
      stripeFeeCents = fee;
    }

    // Valider l’inscription (idempotent)
    await supabase.from("inscriptions").update({ statut: "validé" }).eq("id", inscription_id);

    // Idempotence via PI
    const { data: exists } = await supabase
      .from("paiements").select("id").eq("stripe_payment_intent_id", String(pi.id)).maybeSingle();

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
      destination_account_id: connectedAccount,
      transfer_id: null,
      amount_subtotal: amountTotalCents,
      amount_total: amountTotalCents,
      fee_total: stripeFeeCents,           // ✅ frais Stripe (connected)
      balance_transaction_id: balanceTxId, // ✅ id BT
    };

    if (exists?.id) {
      await supabase.from("paiements").update(row).eq("id", exists.id);
    } else {
      const { data: pre } = await supabase.from("paiements").select("id").eq("trace_id", trace_id).maybeSingle();
      if (pre?.id) await supabase.from("paiements").update(row).eq("id", pre.id);
      else await supabase.from("paiements").insert(row);
    }

    // Email (optionnel)
    try {
      if (resend) {
        const { data: insc } = await supabase
          .from("inscriptions").select("id, email, nom, prenom").eq("id", inscription_id).single();
        if (insc?.email) {
          await resend.emails.send({
            from: "Tickrace <no-reply@tickrace.com>",
            to: insc.email,
            subject: "Confirmation d’inscription",
            html: `
              <div style="font-family:Arial,sans-serif;">
                <h2>Votre inscription est confirmée ✅</h2>
                <p>Bonjour ${insc.prenom ?? ""} ${insc.nom ?? ""},</p>
                <p>Votre numéro d’inscription : <strong>${insc.id}</strong></p>
                <p><a href="${TICKRACE_BASE_URL}/mon-inscription/${insc.id}">${TICKRACE_BASE_URL}/mon-inscription/${insc.id}</a></p>
                <hr/>
                <p>Merci et bonne préparation !</p>
              </div>
            `,
          });
        }
      }
    } catch (e) { console.error("⚠️ Resend error:", e); }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e: any) {
    console.error("💥 stripe-webhook (direct) error:", e?.message ?? e, e?.stack);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500, headers });
  }
});

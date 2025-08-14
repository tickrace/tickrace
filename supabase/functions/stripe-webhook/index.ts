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

const ALLOWLIST = ["https://www.tickrace.com", "http://localhost:5173", "http://127.0.0.1:5173"];
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
const isUUID = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v as string);

serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers });

  // 1) Vérification de signature
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
    // En direct charges, on reçoit idéalement des "Connect events"
    // (Dashboard → Webhooks → cocher “Events on connected accounts”)
    let connectedAccount = (event as any).account as string | undefined;

    // 2) On prépare objets & métadonnées
    let session: Stripe.Checkout.Session | null = null;
    let pi: Stripe.PaymentIntent | null = null;
    let md: Record<string, string> = {};

    if (event.type === "checkout.session.completed") {
      session = event.data.object as Stripe.Checkout.Session;
      md = { ...(session.metadata || {}) };
    } else if (event.type === "payment_intent.succeeded") {
      pi = event.data.object as Stripe.PaymentIntent;
      md = { ...(pi.metadata || {}) };
    } else {
      // on acquitte les autres events
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

    // 3) Fallback si l’endpoint n’est PAS configuré en “connect events”
    if (!connectedAccount) {
      // On retrouve le compte connecté via la course -> organisateur
      const { data: course, error: cErr } = await supabase
        .from("courses")
        .select("organisateur_id")
        .eq("id", course_id)
        .single();
      if (cErr || !course) {
        console.error("❌ Course introuvable", cErr);
        return new Response(JSON.stringify({ error: "Course introuvable" }), { status: 404, headers });
      }
      const { data: profil, error: pErr } = await supabase
        .from("profils_utilisateurs")
        .select("stripe_account_id")
        .eq("user_id", course.organisateur_id)
        .maybeSingle();
      if (pErr || !profil?.stripe_account_id) {
        console.error("❌ Organisateur sans stripe_account_id", pErr);
        return new Response(JSON.stringify({ error: "Organisateur non configuré Stripe" }), { status: 409, headers });
      }
      connectedAccount = profil.stripe_account_id;
    }

    // 4) Récupérer PaymentIntent (sur le COMPTE CONNECTÉ)
    if (!pi && session?.payment_intent) {
      pi = await stripe.paymentIntents.retrieve(session.payment_intent as string, {
        stripeAccount: connectedAccount,
        expand: ["latest_charge.balance_transaction"],
      });
    } else if (pi && !("latest_charge" in pi) /* types */) {
      pi = await stripe.paymentIntents.retrieve(pi.id, {
        stripeAccount: connectedAccount,
        expand: ["latest_charge.balance_transaction"],
      });
    }

    if (!pi) {
      console.error("❌ PaymentIntent introuvable");
      return new Response(JSON.stringify({ error: "PaymentIntent introuvable" }), { status: 404, headers });
    }

    const amountTotalCents = (session?.amount_total ?? pi.amount) ?? 0;
    const currency = (pi.currency ?? "eur");
    // App fee (5%) : en direct charges, PI.application_fee_amount est renseigné ; on garde un fallback
    const applicationFeeCents =
      typeof pi.application_fee_amount === "number" ? pi.application_fee_amount : Math.round(amountTotalCents * 0.05);

    // Frais Stripe (sur le compte connecté) + charge/receipt
    let stripeFeeCents = 0;
    let balanceTxId: string | null = null;
    let chargeId: string | null = null;
    let receiptUrl: string | null = null;

    if (pi.latest_charge) {
      // latest_charge peut déjà contenir balance_transaction si expand ok
      const ch: any =
        typeof (pi.latest_charge as any).balance_transaction !== "undefined"
          ? (pi.latest_charge as any)
          : await stripe.charges.retrieve(pi.latest_charge as string, {
              stripeAccount: connectedAccount,
              expand: ["balance_transaction"],
            });

      chargeId = ch.id ?? null;
      receiptUrl = ch.receipt_url ?? null;
      const bt = ch.balance_transaction as Stripe.BalanceTransaction | undefined;
      stripeFeeCents = bt?.fee ?? 0;
      balanceTxId = bt?.id ?? null;
    }

    // 5) Idempotence (si déjà en base, on valide l’inscription et on sort)
    const { data: exists } = await supabase
      .from("paiements")
      .select("id")
      .eq("stripe_payment_intent_id", String(pi.id))
      .maybeSingle();

    // Valider l’inscription (idempotent)
    await supabase.from("inscriptions").update({ statut: "validé" }).eq("id", inscription_id);

    const row = {
      inscription_id,
      montant_total: amountTotalCents / 100,
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
      destination_account_id: connectedAccount,
      transfer_id: null, // Direct charges: pas de transfer
      amount_subtotal: amountTotalCents,
      amount_total: amountTotalCents,
      fee_total: stripeFeeCents, // frais Stripe du compte connecté
      balance_transaction_id: balanceTxId,
    };

    if (exists?.id) {
      await supabase.from("paiements").update(row).eq("id", exists.id);
    } else {
      // tenter d’enrichir le pré-insert par trace_id s’il existe déjà
      const { data: pre } = await supabase.from("paiements").select("id").eq("trace_id", trace_id).maybeSingle();
      if (pre?.id) await supabase.from("paiements").update(row).eq("id", pre.id);
      else await supabase.from("paiements").insert(row);
    }

    // 6) Email de confirmation (optionnel)
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
                <p>Votre numéro d’inscription : <strong>${insc.id}</strong></p>
                <p><a href="${TICKRACE_BASE_URL}/mon-inscription/${insc.id}">${TICKRACE_BASE_URL}/mon-inscription/${insc.id}</a></p>
                <hr/>
                <p>Merci et bonne préparation !</p>
              </div>
            `,
          });
        }
      }
    } catch (e) {
      console.error("⚠️ Resend error:", e);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e: any) {
    console.error("💥 stripe-webhook (direct) error:", e?.message ?? e, e?.stack);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500, headers });
  }
});

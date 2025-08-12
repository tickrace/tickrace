// supabase/functions/verify-checkout-session/index.ts
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

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
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
    "Access-Control-Max-Age": "86400",
  };
}

serve(async (req) => {
  const headers = cors(req.headers.get("origin"));

  if (req.method === "OPTIONS") return new Response("ok", { headers });

  // Accept: GET ?session_id=...  OR  POST { sessionId }
  let sessionId: string | null = null;
  if (req.method === "GET") {
    const url = new URL(req.url);
    sessionId = url.searchParams.get("session_id");
  } else if (req.method === "POST") {
    try {
      const body = await req.json();
      sessionId = body?.sessionId ?? body?.session_id ?? null;
    } catch {/* noop */}
  } else {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    if (!sessionId) {
      return new Response(JSON.stringify({ paid: false, error: "session_id manquant" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // 1) Récup session + un minimum d’infos
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent", "customer"],
    });

    const paid =
      session.payment_status === "paid" ||
      session.status === "complete" ||
      (typeof session.payment_intent === "object" &&
        session.payment_intent?.status === "succeeded");

    // 2) Si on a un PaymentIntent, on va chercher les détails utiles “destination charges”
    let receipt_url: string | null = null;
    let charge_id: string | null = null;
    let application_fee_amount: number | null = null;     // en cents
    let destination_account_id: string | null = null;     // acct_...
    let fee_total: number | null = null;                  // frais Stripe sur la charge (en cents)
    let balance_transaction_id: string | null = null;

    try {
      if (session.payment_intent && typeof session.payment_intent === "object") {
        const piId = session.payment_intent.id;
        const pi = await stripe.paymentIntents.retrieve(piId, {
          expand: ["latest_charge.balance_transaction", "charges.data.balance_transaction", "transfer_data.destination"],
        });

        application_fee_amount = (pi as any).application_fee_amount ?? null;
        destination_account_id = (pi.transfer_data as any)?.destination ?? null;

        const charge = (pi.charges?.data?.[0]) as any;
        if (charge) {
          charge_id = charge.id ?? null;
          receipt_url = charge.receipt_url ?? null;

          const bt = charge.balance_transaction as any;
          if (bt) {
            fee_total = typeof bt.fee === "number" ? bt.fee : null;
            balance_transaction_id = bt.id ?? null;
          }
        }
      } else {
        // fallback (rare en pratique avec Checkout)
        // On tente latest_charge depuis la session.payment_intent id s’il est string
        if (typeof session.payment_intent === "string") {
          const pi = await stripe.paymentIntents.retrieve(session.payment_intent, {
            expand: ["latest_charge.balance_transaction", "charges.data.balance_transaction", "transfer_data.destination"],
          });
          application_fee_amount = (pi as any).application_fee_amount ?? null;
          destination_account_id = (pi.transfer_data as any)?.destination ?? null;

          const charge = (pi.charges?.data?.[0]) as any;
          if (charge) {
            charge_id = charge.id ?? null;
            receipt_url = charge.receipt_url ?? null;

            const bt = charge.balance_transaction as any;
            if (bt) {
              fee_total = typeof bt.fee === "number" ? bt.fee : null;
              balance_transaction_id = bt.id ?? null;
            }
          }
        }
      }
    } catch (_) {
      // On ne casse pas la vérification si la récupération détaillée échoue
    }

    const resp = {
      paid,
      status: session.status,
      payment_status: session.payment_status,
      amount_total: (session.amount_total ?? 0) / 100,
      currency: session.currency,
      metadata: session.metadata ?? {},
      // + infos utiles pour destination charges
      application_fee_amount,      // cents
      destination_account_id,      // acct_...
      charge_id,
      receipt_url,
      fee_total,                   // cents (frais Stripe)
      balance_transaction_id,
    };

    return new Response(JSON.stringify(resp), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ paid: false, error: "Erreur serveur" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});

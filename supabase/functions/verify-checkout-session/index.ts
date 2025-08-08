// supabase/functions/verify-checkout-session/index.ts
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors() });
  }

  try {
    // session_id via query (?session_id=) ou body JSON
    const url = new URL(req.url);
    const qsSessionId = url.searchParams.get("session_id");
    const body = qsSessionId ? null : await req.json().catch(() => null);
    const session_id = qsSessionId || body?.session_id;

    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id manquant" }), {
        status: 400,
        headers: { ...cors(), "Content-Type": "application/json" },
      });
    }

    // On récupère la session Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["payment_intent"],
    });

    const result = {
      id: session.id,
      status: session.status, // open / complete / expired
      payment_status: session.payment_status, // unpaid / paid / no_payment_required
      amount_total: session.amount_total,
      currency: session.currency,
      customer_email: session.customer_details?.email ?? session.customer_email ?? null,
      metadata: session.metadata ?? {},
      payment_intent_status:
        typeof session.payment_intent === "object"
          ? session.payment_intent.status
          : null,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("❌ verify-checkout-session error:", e?.message || e);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), {
      status: 500,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }
});

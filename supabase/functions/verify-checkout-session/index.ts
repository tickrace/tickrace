// supabase/functions/verify-checkout-session/index.ts
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    let session_id: string | null = null;

    if (req.method === "POST") {
      // Appel via supabase.functions.invoke -> body JSON
      const body = await req.json().catch(() => null);
      session_id = body?.session_id ?? null;
      console.log("📥 POST /verify-checkout-session body:", body);
    } else if (req.method === "GET") {
      // (Optionnel) support GET ?session_id=...
      const url = new URL(req.url);
      session_id = url.searchParams.get("session_id");
      console.log("📥 GET /verify-checkout-session query session_id:", session_id);
    } else {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders() });
    }

    if (!session_id) {
      console.error("❌ session_id manquant");
      return new Response(
        JSON.stringify({ error: "session_id manquant" }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    // Récupérer la session Stripe (expand pour avoir plus d’infos)
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["payment_intent", "customer_details"],
    });

    // Logs utiles côté serveur
    console.log("💳 Stripe session:", {
      id: session.id,
      status: session.status,                // 'complete' | 'open' | 'expired'
      payment_status: session.payment_status, // 'paid' | 'unpaid' | 'no_payment_required'
      amount_total: session.amount_total,
      currency: session.currency,
      customer_email: session.customer_details?.email ?? session.customer_email ?? null,
      metadata: session.metadata,
      payment_intent_status:
        typeof session.payment_intent === "object"
          ? session.payment_intent.status
          : null,
    });

    const response = {
      success: session.payment_status === "paid" && session.status === "complete",
      checkout_status: session.status,
      payment_status: session.payment_status,
      amount_total: session.amount_total, // en cents
      currency: session.currency,
      customer_email: session.customer_details?.email ?? session.customer_email ?? null,
      metadata: session.metadata ?? {},
      payment_intent_status:
        typeof session.payment_intent === "object"
          ? session.payment_intent.status
          : null,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("💥 Erreur verify-checkout-session :", e);
    return new Response(
      JSON.stringify({ error: "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }
});

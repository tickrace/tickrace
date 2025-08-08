// supabase/functions/verify-checkout-session/index.ts
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

const cors = {
  "Access-Control-Allow-Origin": "https://www.tickrace.com", // or "*"
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const url = new URL(req.url);
    const session_id = url.searchParams.get("session_id");
    if (!session_id) {
      return new Response(JSON.stringify({ ok: false, error: "session_id manquant" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // (auth check optional—if you require Authorization, keep it, otherwise remove)
    // const auth = req.headers.get("authorization");
    // if (!auth) {
    //   return new Response(JSON.stringify({ ok: false, error: "Missing authorization header" }), {
    //     status: 401,
    //     headers: { ...cors, "Content-Type": "application/json" },
    //   });
    // }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    const paid =
      session.payment_status === "paid" ||
      session.status === "complete" ||
      session.mode === "payment" && !!session.payment_intent;

    return new Response(JSON.stringify({
      ok: true,
      paid,
      status: session.payment_status ?? session.status,
      session_id,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("verify-checkout-session error:", e);
    return new Response(JSON.stringify({ ok: false, error: "Erreur serveur" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

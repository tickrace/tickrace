import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

const ALLOWED_ORIGIN = "https://www.tickrace.com"; // ajoute ton domaine si besoin
const cors = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Vary": "Origin",
};

serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const url = new URL(req.url);
    const session_id = url.searchParams.get("session_id");
    console.log("🔎 verify-checkout-session called with:", session_id);

    if (!session_id) {
      return new Response(JSON.stringify({ ok: false, error: "session_id manquant" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);
    console.log("✅ Stripe session status:", {
      id: session.id,
      payment_status: session.payment_status,
      status: session.status,
      mode: session.mode,
    });

    const paid =
      session.payment_status === "paid" ||
      session.status === "complete";

    return new Response(JSON.stringify({
      ok: true,
      paid,
      status: session.payment_status ?? session.status,
      session_id,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("💥 verify-checkout-session error:", e);
    return new Response(JSON.stringify({ ok: false, error: "Erreur serveur" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

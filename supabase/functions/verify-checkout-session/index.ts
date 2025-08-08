// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

function cors() {
  return {
    "Access-Control-Allow-Origin": "*", // front sans header -> OK
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type", // pas d'apikey/authorization
  };
}

serve(async (req) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors() });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), {
      status: 405,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");

    console.log("🔎 Vérification Stripe session_id:", sessionId);

    if (!sessionId) {
      console.error("⛔ session_id manquant");
      return new Response(
        JSON.stringify({ paid: false, error: "session_id manquant" }),
        { status: 400, headers: { ...cors(), "Content-Type": "application/json" } }
      );
    }

    // Récupération de la session Checkout
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent", "customer"],
    });

    // Quelques logs utiles
    console.log("✅ Session Stripe récupérée:", {
      id: session.id,
      status: session.status,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,
    });

    // Statut "paid" robuste (Stripe renvoie payment_status: 'paid' si OK)
    const paid =
      session.payment_status === "paid" ||
      session.status === "complete" ||
      (typeof session.payment_intent === "object" &&
        session.payment_intent?.status === "succeeded");

    // Optionnel: URL du reçu (quand dispo)
    let receipt_url: string | null = null;
    try {
      if (typeof session.payment_intent === "object" && session.payment_intent?.latest_charge) {
        // @ts-ignore deno types
        const chargeId = session.payment_intent.latest_charge as string;
        // @ts-ignore deno types
        const charge = await stripe.charges.retrieve(chargeId);
        // @ts-ignore deno types
        receipt_url = charge?.receipt_url ?? null;
      }
    } catch (_e) {
      // pas grave si non dispo
    }

    // Réponse JSON consommée par /merci
    const resp = {
      paid,
      status: session.status,
      payment_status: session.payment_status,
      amount_total: (session.amount_total ?? 0) / 100,
      currency: session.currency,
      metadata: session.metadata ?? {},
      receipt_url,
    };

    return new Response(JSON.stringify(resp), {
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("💥 Erreur verify-checkout-session:", e?.message ?? e);
    return new Response(
      JSON.stringify({ paid: false, error: "Erreur serveur" }),
      { status: 500, headers: { ...cors(), "Content-Type": "application/json" } }
    );
  }
});

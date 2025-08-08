// supabase/functions/create-checkout-session/index.ts
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

// Autoriser prod + dev
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
    // Important: inclure les en-têtes utilisés par supabase.functions.invoke
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
    "Access-Control-Max-Age": "86400",
  };
}

serve(async (req) => {
  const headers = cors(req.headers.get("origin"));

  // Préflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    // Corps attendu:
    // {
    //   user_id: string,
    //   course_id: string,
    //   prix_total: number | string,
    //   inscription_id: string,
    //   email: string,
    //   successUrl?: string, // optionnel
    //   cancelUrl?: string   // optionnel
    // }
    const body = await req.json();
    const origin = req.headers.get("origin");
    console.log("📥 create-checkout-session :: origin =", origin);
    console.log("📥 Données reçues:", body);

    const {
      user_id,
      course_id,
      prix_total,
      inscription_id,
      email,
      successUrl,
      cancelUrl,
    } = body ?? {};

    // Validation basique
    const prixNumber = Number(prix_total);
    const unitAmount = Number.isFinite(prixNumber) ? Math.round(prixNumber * 100) : NaN;

    console.log("🔎 Champs normalisés:", {
      has_user_id: !!user_id,
      has_course_id: !!course_id,
      prix_total_raw: prix_total,
      prixNumber,
      unitAmount,
      inscription_id,
      emailPresent: !!email,
      successUrl: successUrl || "(default /merci)",
      cancelUrl: cancelUrl || "(default /paiement-annule)",
    });

    if (!user_id || !course_id || !inscription_id || !email || !Number.isFinite(prixNumber) || unitAmount <= 0) {
      console.error("❌ Paramètre manquant/invalid", {
        user_id, course_id, inscription_id, email, prix_total, unitAmount,
      });
      return new Response(JSON.stringify({ error: "Paramètre manquant ou invalide" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const SU_URL = (successUrl || "https://www.tickrace.com/merci") + "?session_id={CHECKOUT_SESSION_ID}";
    const CA_URL = (cancelUrl  || "https://www.tickrace.com/paiement-annule") + "?session_id={CHECKOUT_SESSION_ID}";

    // Création de la session Stripe
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Inscription à la course",
              // Tu peux ajouter ici des infos supplémentaires si tu veux (course, format, etc.)
            },
            unit_amount: unitAmount, // en cents
          },
          quantity: 1,
        },
      ],
      // Préremplir l’email Stripe + reçu
      customer_email: String(email),
      payment_intent_data: {
        receipt_email: String(email),
      },
      // Redirections
      success_url: SU_URL,
      cancel_url: CA_URL,
      // Métadonnées lues par stripe-webhook
      metadata: {
        user_id: String(user_id),
        course_id: String(course_id),
        prix_total: String(prix_total),
        inscription_id: String(inscription_id),
      },
    });

    console.log("✅ Session Stripe créée :", {
      session_id: session.id,
      url: session.url,
      amount_total_preview: unitAmount,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...headers, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    console.error("💥 Erreur create-checkout-session :", e?.message ?? e, e?.stack);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), {
      status: 500,
      headers: { ...cors(req.headers.get("origin")), "Content-Type": "application/json" },
    });
  }
});

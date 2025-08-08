// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
// Aligner esm.sh sur la même std que Deno pour éviter les polyfills foireux
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
    "Access-Control-Max-Age": "86400",
  };
}

function isUUID(v: unknown) {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

serve(async (req) => {
  const headers = cors(req.headers.get("origin"));

  if (req.method === "OPTIONS") return new Response("ok", { headers });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const origin = req.headers.get("origin");
    console.log("📥 create-checkout-session :: origin =", origin);
    console.log("📥 Données reçues:", body);

    const {
      user_id,
      course_id,
      prix_total,       // number | string
      inscription_id,
      email,
      successUrl,       // optionnel
      cancelUrl,        // optionnel
      trace_id: traceIdFromClient, // 🆕 optionnel : le front peut en fournir un
    } = body ?? {};

    // Prix -> cents
    const prixNumber = Number(prix_total);
    const unitAmount = Number.isFinite(prixNumber) ? Math.round(prixNumber * 100) : NaN;

    // 🔐 Validation
    if (!user_id || !course_id || !inscription_id || !email || !Number.isFinite(prixNumber) || unitAmount <= 0) {
      console.error("❌ Paramètre manquant/invalid", {
        has_user_id: !!user_id,
        has_course_id: !!course_id,
        has_inscription_id: !!inscription_id,
        has_email: !!email,
        prix_total,
        unitAmount,
      });
      return new Response(JSON.stringify({ error: "Paramètre manquant ou invalide" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // 🧭 trace_id : on prend celui du client s'il est valide, sinon on en génère un
    const trace_id = isUUID(traceIdFromClient) ? traceIdFromClient : crypto.randomUUID();
    if (!isUUID(traceIdFromClient)) {
      console.log("ℹ️ Nouveau trace_id généré (client absent/invalide) :", trace_id);
    }
    console.log("🧭 TRACE create-checkout-session", { trace_id, inscription_id, user_id, course_id, prix_total });

    // 💾 MAJ dans la table inscriptions AVANT Stripe
    const { error: updateErr } = await supabase
      .from("inscriptions")
      .update({ paiement_trace_id: trace_id })
      .eq("id", inscription_id);

    if (updateErr) {
      console.error("❌ Erreur maj paiement_trace_id:", updateErr.message);
    }

    // URLs
    const SU_URL = (successUrl || "https://www.tickrace.com/merci") + "?session_id={CHECKOUT_SESSION_ID}";
    const CA_URL = (cancelUrl  || "https://www.tickrace.com/paiement-annule") + "?session_id={CHECKOUT_SESSION_ID}";

    // ✅ metadata sur Session + PaymentIntent
    const commonMetadata = {
      inscription_id: String(inscription_id),
      user_id: String(user_id),
      course_id: String(course_id),
      prix_total: String(prix_total),
      trace_id, // 👈 toujours présent
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: "Inscription à la course" },
            unit_amount: unitAmount, // en cents
          },
          quantity: 1,
        },
      ],
      customer_email: String(email),
      payment_intent_data: {
        receipt_email: String(email),
        metadata: commonMetadata, // 👈 PI.metadata
      },
      success_url: SU_URL,
      cancel_url: CA_URL,
      metadata: commonMetadata,     // 👈 Session.metadata
    });

    console.log("✅ Session Stripe créée :", {
      session_id: session.id,
      url: session.url,
      amount_total_preview: unitAmount,
      trace_id,
    });

    // On renvoie aussi le trace_id au front (pratique pour logger côté client)
    return new Response(JSON.stringify({ url: session.url, trace_id }), {
      headers: { ...headers, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    console.error("💥 Erreur create-checkout-session :", e?.message ?? e, e?.stack);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});

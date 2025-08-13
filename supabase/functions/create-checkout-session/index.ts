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
    "Content-Type": "application/json",
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
      headers,
    });
  }

  try {
    const body = await req.json();
    const origin = req.headers.get("origin");
    console.log("📥 create-checkout-session (Separate charges & transfers) :: origin =", origin);
    console.log("📥 Données reçues:", body);

    const {
      user_id,
      course_id,
      prix_total,            // number | string
      inscription_id,
      email,
      successUrl,           // optionnel
      cancelUrl,            // optionnel
      trace_id: traceIdFromClient,
    } = body ?? {};

    // Prix -> cents
    const prixNumber = Number(prix_total);
    const unitAmount = Number.isFinite(prixNumber) ? Math.round(prixNumber * 100) : NaN;

    // 🔐 Validation minimale
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
        headers,
      });
    }

    // 🧭 trace_id (on prend celui du client s'il est valide, sinon on en génère un)
    const trace_id = isUUID(traceIdFromClient) ? traceIdFromClient : crypto.randomUUID();
    if (!isUUID(traceIdFromClient)) {
      console.log("ℹ️ Nouveau trace_id généré (client absent/invalide) :", trace_id);
    }
    console.log("🧭 TRACE create-checkout-session", { trace_id, inscription_id, user_id, course_id, prix_total });

    // 💾 Marque l'inscription avec le trace_id AVANT Stripe (comme avant)
    const { error: updateErr } = await supabase
      .from("inscriptions")
      .update({ paiement_trace_id: trace_id })
      .eq("id", inscription_id);
    if (updateErr) {
      console.error("❌ Erreur maj paiement_trace_id:", updateErr.message);
    }

    // 🔎 Récup organiser -> compte Stripe
    // courses.organisateur_id -> profils_utilisateurs.stripe_account_id
    const { data: course, error: cErr } = await supabase
      .from("courses")
      .select("organisateur_id, nom")
      .eq("id", course_id)
      .single();
    if (cErr || !course) {
      console.error("❌ Course non trouvée", cErr);
      return new Response(JSON.stringify({ error: "Course introuvable" }), { status: 404, headers });
    }

    const { data: profil, error: pErr } = await supabase
      .from("profils_utilisateurs")
      .select("stripe_account_id, email")
      .eq("user_id", course.organisateur_id)
      .maybeSingle();
    if (pErr) {
      console.error("❌ Erreur lecture profil organisateur", pErr);
      return new Response(JSON.stringify({ error: "Profil organisateur introuvable" }), { status: 500, headers });
    }

    const destinationAccount = profil?.stripe_account_id ?? null;

    // 🧯 Sécurité : on bloque si pas de compte Connect (sinon on encaisse sans pouvoir transférer ensuite)
    if (!destinationAccount) {
      console.warn("⚠️ Organisateur sans stripe_account_id → paiement indisponible");
      return new Response(JSON.stringify({
        error: "L'organisateur n'a pas encore configuré Stripe.",
        code: "ORGANISER_STRIPE_NOT_CONFIGURED",
      }), { status: 409, headers });
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

    // 🧾 Création de la Session Checkout (Separate charges & transfers)
    // 👉 Pas de application_fee_amount, pas de transfer_data
    // 👉 On ajoute un transfer_group et (optionnel) on_behalf_of
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
        on_behalf_of: destinationAccount,     // facultatif mais utile pour le descriptor
        transfer_group: `grp_${trace_id}`,    // pour lier ensuite le transfer à la charge
        metadata: commonMetadata,             // PI.metadata
      },
      success_url: SU_URL,
      cancel_url: CA_URL,
      metadata: commonMetadata,               // Session.metadata
    });

    console.log("✅ Session Stripe créée (Separate C&T) :", {
      session_id: session.id,
      url: session.url,
      amount_total_preview: unitAmount,
      destination_for_behalf_of: destinationAccount,
      trace_id,
    });

    return new Response(JSON.stringify({ url: session.url, trace_id }), {
      headers,
      status: 200,
    });
  } catch (e: any) {
    console.error("💥 Erreur create-checkout-session (Separate C&T):", e?.message ?? e, e?.stack);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), {
      status: 500,
      headers,
    });
  }
});

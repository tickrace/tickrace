// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const ALLOWLIST = ["https://www.tickrace.com","http://localhost:5173","http://127.0.0.1:5173"];
const cors = (o: string | null) => ({
  "Access-Control-Allow-Origin": (o && ALLOWLIST.includes(o)) ? o : ALLOWLIST[0],
  "Vary": "Origin",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
});
const isUUID = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v as string);

serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers });

  try {
    const body = await req.json();
    const { user_id, course_id, prix_total, inscription_id, email, successUrl, cancelUrl, trace_id: traceIn } = body ?? {};
    if (!isUUID(user_id) || !isUUID(course_id) || !isUUID(inscription_id) || !email) {
      return new Response(JSON.stringify({ error: "Paramètres invalides" }), { status: 400, headers });
    }

    const prixNumber = Number(prix_total);
    const unitAmount = Number.isFinite(prixNumber) ? Math.round(prixNumber * 100) : NaN;
    if (!Number.isFinite(prixNumber) || unitAmount <= 0) {
      return new Response(JSON.stringify({ error: "prix_total invalide" }), { status: 400, headers });
    }

    const trace_id = isUUID(traceIn) ? traceIn : crypto.randomUUID();

    // Récup organiser -> compte connecté (destination du transfer J+1)
    const { data: course, error: cErr } = await supabase.from("courses")
      .select("organisateur_id, nom").eq("id", course_id).single();
    if (cErr || !course) return new Response(JSON.stringify({ error: "Course introuvable" }), { status: 404, headers });

    const { data: profil, error: pErr } = await supabase.from("profils_utilisateurs")
      .select("stripe_account_id").eq("user_id", course.organisateur_id).maybeSingle();
    if (pErr) return new Response(JSON.stringify({ error: "Erreur lecture profil" }), { status: 500, headers });
    const destinationAccount = profil?.stripe_account_id ?? null;
    if (!destinationAccount) {
      return new Response(JSON.stringify({ error: "Organisateur non configuré Stripe", code: "ORGANISER_STRIPE_NOT_CONFIGURED" }), { status: 409, headers });
    }

    // Marquer l'inscription + pré-insert paiement (status 'created')
    await supabase.from("inscriptions").update({ paiement_trace_id: trace_id }).eq("id", inscription_id);
    await supabase.from("paiements").insert({
      inscription_id, user_id, montant_total: prixNumber, devise: "eur",
      status: "created", type: "individuel", inscription_ids: [inscription_id],
      trace_id, amount_subtotal: unitAmount, amount_total: unitAmount,
      destination_account_id: destinationAccount
    });

    const metadata = {
      inscription_id: String(inscription_id),
      user_id: String(user_id),
      course_id: String(course_id),
      prix_total: String(prix_total),
      trace_id,
    };

    // ✅ SCT : Checkout sur la PLATEFORME (pas de stripeAccount)
    // Pas d'application_fee_amount ici; la commission sera retenue lors du transfer.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: { name: "Inscription à la course" },
          unit_amount: unitAmount,
        },
        quantity: 1,
      }],
      customer_email: String(email),
      payment_intent_data: {
        transfer_group: `grp_${trace_id}`,  // lien charge <-> transfer
        metadata,
      },
      success_url: (successUrl || "https://www.tickrace.com/merci") + "?session_id={CHECKOUT_SESSION_ID}&inscription_id="+inscription_id,
      cancel_url: (cancelUrl || "https://www.tickrace.com/paiement-annule") + "?session_id={CHECKOUT_SESSION_ID}&inscription_id="+inscription_id,
      metadata,
    });

    return new Response(JSON.stringify({ url: session.url, trace_id }), { status: 200, headers });
  } catch (e: any) {
    console.error("create-checkout-session (SCT) error:", e?.message ?? e, e?.stack);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500, headers });
  }
});

// supabase/functions/create-checkout-session/index.ts
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const ALLOWLIST = ["https://www.tickrace.com","http://localhost:5173","http://127.0.0.1:5173"];
function cors(origin: string | null) {
  const allowed = origin && ALLOWLIST.includes(origin) ? origin : ALLOWLIST[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}
const isUUID = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v as string);

serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers });

  try {
    const body = await req.json();
    const { user_id, course_id, prix_total, inscription_id, email, successUrl, cancelUrl, trace_id: traceIn } = body ?? {};

    // Prix -> cents
    const prixNumber = Number(prix_total);
    const unitAmount = Number.isFinite(prixNumber) ? Math.round(prixNumber * 100) : NaN;

    // Validation
    if (!isUUID(user_id))         return new Response(JSON.stringify({ error: "user_id invalide" }), { status: 400, headers });
    if (!isUUID(course_id))       return new Response(JSON.stringify({ error: "course_id invalide" }), { status: 400, headers });
    if (!isUUID(inscription_id))  return new Response(JSON.stringify({ error: "inscription_id invalide" }), { status: 400, headers });
    if (!email)                   return new Response(JSON.stringify({ error: "email requis" }), { status: 400, headers });
    if (!Number.isFinite(prixNumber) || unitAmount <= 0)
      return new Response(JSON.stringify({ error: "prix_total doit être > 0" }), { status: 400, headers });

    // trace_id
    const trace_id = isUUID(traceIn) ? traceIn : crypto.randomUUID();

    // Tagger l’inscription
    await supabase.from("inscriptions").update({ paiement_trace_id: trace_id }).eq("id", inscription_id);

    // Organisateur -> compte connecté
    const { data: course } = await supabase.from("courses").select("organisateur_id, nom").eq("id", course_id).single();
    if (!course) return new Response(JSON.stringify({ error: "Course introuvable" }), { status: 404, headers });

    const { data: profil } = await supabase.from("profils_utilisateurs").select("stripe_account_id").eq("user_id", course.organisateur_id).maybeSingle();
    const destinationAccount = profil?.stripe_account_id ?? null;
    if (!destinationAccount) {
      return new Response(JSON.stringify({ error: "Organisateur non configuré Stripe", code: "ORGANISER_STRIPE_NOT_CONFIGURED" }), { status: 409, headers });
    }

    // Pré-insert paiement (trace)
    await supabase.from("paiements").insert({
      inscription_id,
      user_id,
      montant_total: prixNumber, devise: "eur",
      status: "created", type: "individuel",
      inscription_ids: [inscription_id],
      trace_id,
      amount_subtotal: unitAmount, amount_total: unitAmount
    });

    // Commission 5 %
    const appFeeCents = Math.round(unitAmount * 0.05);

    // URLs (on ajoute l’inscription_id pour un éventuel fallback de vérif)
    const SU_URL = `${successUrl || "https://www.tickrace.com/merci"}?session_id={CHECKOUT_SESSION_ID}&inscription_id=${inscription_id}`;
    const CA_URL = `${cancelUrl || "https://www.tickrace.com/paiement-annule"}?session_id={CHECKOUT_SESSION_ID}&inscription_id=${inscription_id}`;

    // Métadonnées
    const metadata = {
      inscription_id: String(inscription_id),
      user_id: String(user_id),
      course_id: String(course_id),
      prix_total: String(prix_total),
      trace_id,
    };

    // ✅ DIRECT CHARGES : la Session est créée sur le compte connecté
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: { currency: "eur", product_data: { name: "Inscription à la course" }, unit_amount: unitAmount },
        quantity: 1,
      }],
      customer_email: String(email),
      payment_intent_data: {
        application_fee_amount: appFeeCents, // 5% pour Tickrace
        metadata,
      },
      success_url: SU_URL,
      cancel_url: CA_URL,
      metadata,
    }, { stripeAccount: destinationAccount }); // 👈 clé Direct charges

    return new Response(JSON.stringify({ url: session.url, trace_id }), { status: 200, headers });
  } catch (e: any) {
    console.error("create-checkout-session (direct) error:", e?.message ?? e, e?.stack);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500, headers });
  }
});

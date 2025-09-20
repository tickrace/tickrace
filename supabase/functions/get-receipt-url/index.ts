// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const ALLOWLIST = ["https://www.tickrace.com","http://localhost:5173","http://127.0.0.1:5173"];
const cors = (origin: string | null) => {
  const allowed = origin && ALLOWLIST.includes(origin) ? origin : ALLOWLIST[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
    "Access-Control-Max-Age": "86400",
  };
};

serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "MÃ©thode non autorisÃ©e" }), { status: 405, headers: { ...headers, "Content-Type": "application/json" }});
  }

  try {
    // âš ï¸ On exige un JWT (le client doit Ãªtre connectÃ©)
    const auth = req.headers.get("authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Missing authorization header" }), { status: 401, headers: { ...headers, "Content-Type": "application/json" }});

    const { inscription_id, trace_id, payment_intent_id } = await req.json() ?? {};

    // 1) DÃ©terminer le PaymentIntent
    let piId: string | null = payment_intent_id ?? null;

    // a) si pas fourni, tenter par trace_id -> paiements
    if (!piId && trace_id) {
      const { data: payByTrace } = await supabaseAdmin
        .from("paiements").select("stripe_payment_intent_id")
        .eq("trace_id", trace_id)
        .order("created_at", { ascending: false })
        .limit(1).maybeSingle();
      piId = payByTrace?.stripe_payment_intent_id ?? null;
    }

    // b) si toujours rien, et quâ€™on a inscription_id -> via paiements, puis via paiement_trace_id
    if (!piId && inscription_id) {
      const { data: payByIns } = await supabaseAdmin
        .from("paiements").select("stripe_payment_intent_id")
        .eq("inscription_id", inscription_id)
        .order("created_at", { ascending: false })
        .limit(1).maybeSingle();
      piId = payByIns?.stripe_payment_intent_id ?? null;

      if (!piId) {
        const { data: insc } = await supabaseAdmin
          .from("inscriptions").select("paiement_trace_id").eq("id", inscription_id).maybeSingle();
        if (insc?.paiement_trace_id) {
          const { data: pay2 } = await supabaseAdmin
            .from("paiements").select("stripe_payment_intent_id")
            .eq("trace_id", insc.paiement_trace_id)
            .order("created_at", { ascending: false })
            .limit(1).maybeSingle();
          piId = pay2?.stripe_payment_intent_id ?? null;
        }
      }
    }

    if (!piId) {
      return new Response(JSON.stringify({ error: "PaymentIntent introuvable" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" }});
    }

    // 2) Stripe: rÃ©cupÃ©rer latest_charge -> receipt_url
    const pi = await stripe.paymentIntents.retrieve(piId);
    const chargeId = (pi.latest_charge as string) || null;
    if (!chargeId) {
      return new Response(JSON.stringify({ error: "Aucune charge liÃ©e Ã  ce PaymentIntent" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" }});
    }
    const charge = await stripe.charges.retrieve(chargeId);
    // @ts-ignore
    const receipt_url = charge?.receipt_url ?? null;
    if (!receipt_url) {
      return new Response(JSON.stringify({ error: "ReÃ§u indisponible" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" }});
    }

    // 3) (Optionnel) Persister en base si colonne receipt_url existe
    try {
      await supabaseAdmin.from("paiements")
        .update({ receipt_url })
        .eq("stripe_payment_intent_id", piId);
    } catch (_) {}

    return new Response(JSON.stringify({ receipt_url }), { status: 200, headers: { ...headers, "Content-Type": "application/json" }});
  } catch (e: any) {
    console.error("get-receipt-url error:", e?.message ?? e);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500, headers: { ...headers, "Content-Type": "application/json" }});
  }
});

// hard guard
try { (globalThis | Out-Null) } catch {} // keep file non-empty

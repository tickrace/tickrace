// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0";

(globalThis as any).process = undefined;

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ALLOWLIST = ["https://www.tickrace.com","http://localhost:5173","http://127.0.0.1:5173"];
function cors(origin: string | null) {
  const o = origin && ALLOWLIST.includes(origin) ? origin : ALLOWLIST[0];
  return {
    "Access-Control-Allow-Origin": o,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}

const isUUID = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v as string);

serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers });
  }

  try {
    const { inscription_id, trace_id, pi_id } = await req.json();

    // 1) chercher dans la DB
    let payRow: any = null;
    if (isUUID(inscription_id)) {
      const { data } = await supabase.from("paiements")
        .select("*")
        .eq("inscription_id", inscription_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      payRow = data ?? null;
    }
    if (!payRow && isUUID(trace_id)) {
      const { data } = await supabase.from("paiements")
        .select("*")
        .eq("trace_id", trace_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      payRow = data ?? null;
    }
    if (!payRow && typeof pi_id === "string") {
      const { data } = await supabase.from("paiements")
        .select("*")
        .eq("stripe_payment_intent_id", pi_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      payRow = data ?? null;
    }

    // Si la DB a déjà le reçu, renvoie
    if (payRow?.receipt_url) {
      return new Response(JSON.stringify({ ok: true, receipt_url: payRow.receipt_url }), { status: 200, headers });
    }

    // 2) Fallback via Stripe
    const piToFetch = (typeof pi_id === "string" && pi_id) || payRow?.stripe_payment_intent_id;
    if (!piToFetch) {
      return new Response(JSON.stringify({ error: "Aucun PaymentIntent pour retrouver le reçu" }), { status: 404, headers });
    }

    const pi = await stripe.paymentIntents.retrieve(String(piToFetch), { expand: ["latest_charge"] });
    let receiptUrl: string | null = null;

    if (pi.latest_charge) {
      const ch: any = typeof pi.latest_charge === "string"
        ? await stripe.charges.retrieve(String(pi.latest_charge))
        : (pi.latest_charge as any);
      receiptUrl = ch?.receipt_url ?? null;
    }

    if (receiptUrl) {
      if (payRow?.id) {
        await supabase.from("paiements").update({ receipt_url: receiptUrl }).eq("id", payRow.id);
      }
      return new Response(JSON.stringify({ ok: true, receipt_url: receiptUrl }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ ok: false, receipt_url: null }), { status: 200, headers });
  } catch (e: any) {
    console.error("get-receipt-url error:", e?.message ?? e, e?.stack);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500, headers });
  }
});

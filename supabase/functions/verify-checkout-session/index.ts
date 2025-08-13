// supabase/functions/verify-checkout-session/index.ts
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

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
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
    "Access-Control-Max-Age": "86400",
  };
}

serve(async (req) => {
  const headers = cors(req.headers.get("origin"));

  if (req.method === "OPTIONS") return new Response("ok", { headers });

  // Accept: GET ?session_id=...  OR  POST { sessionId }
  let sessionId: string | null = null;
  if (req.method === "GET") {
    const url = new URL(req.url);
    sessionId = url.searchParams.get("session_id");
  } else if (req.method === "POST") {
    try {
      const body = await req.json();
      sessionId = body?.sessionId ?? body?.session_id ?? null;
    } catch {/* noop */}
  } else {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    if (!sessionId) {
      return new Response(JSON.stringify({ paid: false, error: "session_id manquant" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // 1) Récup session + un minimum d’infos
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent", "customer"],
    });

    const paid =
      session.payment_status === "paid" ||
      session.status === "complete" ||
      (typeof session.payment_intent === "object" &&
        session.payment_intent?.status === "succeeded");

    // 2) Détails “destination charges” (robuste pour fee_total)
    let receipt_url: string | null = null;
    let charge_id: string | null = null;
    let application_fee_amount: number | null = null;     // cents
    let destination_account_id: string | null = null;     // acct_...
    let fee_total: number | null = null;                  // cents (frais Stripe)
    let balance_transaction_id: string | null = null;

    try {
      // PaymentIntent ID quelle que soit sa forme
      const piId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent as any)?.id;

      if (piId) {
        // 1) PI “simple” pour lire la fee d’appli et la destination
        const pi = await stripe.paymentIntents.retrieve(piId);
        application_fee_amount = (pi as any).application_fee_amount ?? null;
        destination_account_id = (pi.transfer_data as any)?.destination ?? null;

        // 2) Identifie la charge la plus récente
        const latestChargeId =
          (pi.latest_charge as string) ||
          (pi.charges?.data?.[0]?.id ?? null);

        if (latestChargeId) {
          // 3) Recharge la charge avec balance_transaction (assure fee_total)
          const fullCharge = await stripe.charges.retrieve(latestChargeId, {
            expand

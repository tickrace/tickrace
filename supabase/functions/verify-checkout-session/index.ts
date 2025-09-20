// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0&pin=v135";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0&pin=v135";

console.log("BUILD verify-checkout-session 2025-09-20T19:55Z");

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
    const { session_id, trace_id, inscription_id, groupe_id } = await req.json();

    if (!session_id && !trace_id) {
      return new Response(JSON.stringify({ error: "session_id ou trace_id requis" }), { status: 400, headers });
    }

    const session = session_id ? await stripe.checkout.sessions.retrieve(session_id) : null;
    const paid = session ? (session.payment_status === "paid" || session.status === "complete") : true;

    let pi = session?.payment_intent ? await stripe.paymentIntents.retrieve(session.payment_intent as string, {
      expand: ["latest_charge.balance_transaction"],
    }) : null;

    if (!pi && trace_id) {
      const { data: pay } = await supabase.from("paiements").select("stripe_payment_intent_id").eq("trace_id", trace_id).maybeSingle();
      if (pay?.stripe_payment_intent_id) {
        pi = await stripe.paymentIntents.retrieve(pay.stripe_payment_intent_id, {
          expand: ["latest_charge.balance_transaction"],
        });
      }
    }

    if (!pi) {
      return new Response(JSON.stringify({ error: "PaymentIntent introuvable" }), { status: 404, headers });
    }

    const md = { ...(session?.metadata || {}), ...(pi.metadata || {}) } as Record<string,string>;
    const out = {
      ok: paid,
      mode: md["type"] || "individuel",
      trace_id: md["trace_id"] || trace_id || null,
      payment_intent_id: String(pi.id),
      amount_total_cents: (session?.amount_total ?? pi.amount) ?? 0,
      receipt_url: (typeof (pi.latest_charge as any)?.receipt_url === "string")
        ? (pi.latest_charge as any).receipt_url
        : null,
      inscriptions: [] as Array<{id:string, nom:string, prenom:string, email:string, statut:string}>,
    };

    // Remonte les inscriptions liées (individuel ou groupe)
    if (out.mode === "individuel") {
      const idToUse = isUUID(inscription_id) ? inscription_id : md["inscription_id"];
      if (isUUID(idToUse)) {
        const { data: insc } = await supabase.from("inscriptions")
          .select("id, nom, prenom, email, statut")
          .eq("id", idToUse).maybeSingle();
        if (insc) out.inscriptions = [insc as any];
      }
    } else {
      const gid = isUUID(groupe_id) ? groupe_id : md["groupe_id"];
      if (isUUID(gid)) {
        const { data: mates } = await supabase.from("inscriptions")
          .select("id, nom, prenom, email, statut")
          .eq("groupe_id", gid).order("created_at", { ascending: true });
        out.inscriptions = (mates || []) as any;
      }
    }

    return new Response(JSON.stringify(out), { status: 200, headers });
  } catch (e: any) {
    console.error("verify-checkout-session error:", e?.message ?? e, e?.stack);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500, headers });
  }
});

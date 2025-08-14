// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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
const isUUID = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v as string);

serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers });

  try {
    const { session_id, inscription_id } = await req.json();
    if (!session_id) return new Response(JSON.stringify({ error: "session_id requis" }), { status: 400, headers });
    if (!isUUID(inscription_id)) return new Response(JSON.stringify({ error: "inscription_id invalide" }), { status: 400, headers });

    // 1) Retrouver le compte connecté (via l’inscription -> course -> organisateur)
    const { data: insc, error: eInsc } = await supabase
      .from("inscriptions")
      .select("id, course_id")
      .eq("id", inscription_id)
      .single();
    if (eInsc || !insc) return new Response(JSON.stringify({ error: "Inscription introuvable" }), { status: 404, headers });

    const { data: course, error: eCourse } = await supabase
      .from("courses")
      .select("organisateur_id")
      .eq("id", insc.course_id)
      .single();
    if (eCourse || !course) return new Response(JSON.stringify({ error: "Course introuvable" }), { status: 404, headers });

    const { data: profil, error: eProfil } = await supabase
      .from("profils_utilisateurs")
      .select("stripe_account_id")
      .eq("user_id", course.organisateur_id)
      .maybeSingle();
    if (eProfil) return new Response(JSON.stringify({ error: "Profil organisateur introuvable" }), { status: 500, headers });

    const connectedAcct = profil?.stripe_account_id ?? null;
    if (!connectedAcct) {
      return new Response(JSON.stringify({ error: "Organisateur non configuré Stripe", code: "ORGANISER_STRIPE_NOT_CONFIGURED" }), { status: 409, headers });
    }

    // 2) Récupérer la session + PI sur le compte connecté
    const session = await stripe.checkout.sessions.retrieve(session_id, { stripeAccount: connectedAcct });
    if (!session) return new Response(JSON.stringify({ error: "Session introuvable" }), { status: 404, headers });

    // Statut payé ?
    const paid = session.payment_status === "paid" || session.status === "complete";
    if (!paid) {
      return new Response(JSON.stringify({ ok: false, status: session.payment_status ?? session.status }), { status: 200, headers });
    }

    const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string, {
      stripeAccount: connectedAcct,
      expand: ["latest_charge.balance_transaction"],
    });

    // 3) Données financières
    const amountTotalCents = (session.amount_total ?? pi.amount) ?? 0;
    const currency = (pi.currency ?? "eur");
    const appFeeCents = typeof pi.application_fee_amount === "number"
      ? pi.application_fee_amount
      : Math.round(amountTotalCents * 0.05); // fallback 5%

    // Frais Stripe (sur le compte connecté)
    let stripeFeeCents = 0, balanceTxId: string | null = null, chargeId: string | null = null, receiptUrl: string | null = null;
    if (pi.latest_charge) {
      const ch = typeof (pi.latest_charge as any).balance_transaction !== "undefined"
        ? (pi.latest_charge as any)
        : await stripe.charges.retrieve(pi.latest_charge as string, { stripeAccount: connectedAcct, expand: ["balance_transaction"] });
      chargeId = ch.id;
      receiptUrl = ch.receipt_url ?? null;
      const bt = ch.balance_transaction as Stripe.BalanceTransaction | undefined;
      stripeFeeCents = bt?.fee ?? 0;
      balanceTxId = bt?.id ?? null;
    }

    // 4) Métadonnées pour upsert
    const md = { ...(session.metadata || {}), ...(pi.metadata || {}) } as Record<string, string>;
    const user_id = isUUID(md["user_id"]) ? md["user_id"] : null;
    const trace_id = isUUID(md["trace_id"]) ? md["trace_id"] : null;

    // 5) MAJ inscription -> validé (idempotent)
    await supabase.from("inscriptions").update({ statut: "validé" }).eq("id", inscription_id);

    // 6) Upsert paiements (d’abord par trace_id si présent, sinon par PI)
    const row = {
      inscription_id,
      montant_total: amountTotalCents / 100, devise: currency,
      stripe_payment_intent_id: String(pi.id),
      status: pi.status ?? "succeeded",
      reversement_effectue: false,
      user_id,
      type: "individuel",
      inscription_ids: [inscription_id],
      trace_id,
      receipt_url: receiptUrl,
      charge_id: chargeId,
      application_fee_amount: appFeeCents,
      destination_account_id: connectedAcct,
      transfer_id: null, // direct charges: pas de transfer
      amount_subtotal: amountTotalCents,
      amount_total: amountTotalCents,
      fee_total: stripeFeeCents,
      balance_transaction_id: balanceTxId,
    };

    let upsertDone = false;
    if (trace_id) {
      const { data: pre } = await supabase.from("paiements").select("id").eq("trace_id", trace_id).maybeSingle();
      if (pre?.id) {
        await supabase.from("paiements").update(row).eq("id", pre.id);
        upsertDone = true;
      }
    }
    if (!upsertDone) {
      const { data: byPI } = await supabase.from("paiements").select("id").eq("stripe_payment_intent_id", row.stripe_payment_intent_id).maybeSingle();
      if (byPI?.id) await supabase.from("paiements").update(row).eq("id", byPI.id);
      else          await supabase.from("paiements").insert(row);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e: any) {
    console.error("verify-checkout-session (direct) error:", e?.message ?? e, e?.stack);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500, headers });
  }
});

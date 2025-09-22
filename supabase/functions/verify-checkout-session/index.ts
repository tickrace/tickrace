// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0&pin=v135";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0&pin=v135";

console.log("BUILD verify-checkout-session 2025-09-22T20:40Z (CORS aligned)");

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const ALLOWLIST = ["https://www.tickrace.com","http://localhost:5173","http://127.0.0.1:5173"];
function buildCorsHeaders(req: Request) {
  const origin = req.headers.get("origin");
  const allowOrigin = origin && ALLOWLIST.includes(origin) ? origin : ALLOWLIST[0];
  const reqMethod = req.headers.get("access-control-request-method") || "POST";
  const reqHeaders =
    req.headers.get("access-control-request-headers") ||
    "authorization, x-client-info, apikey, content-type, prefer";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": `${reqMethod}, OPTIONS`,
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}
const isUUID = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v as string);

serve(async (req) => {
  const headers = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers });

  try {
    const { session_id, inscription_id: inscriptionIdIn, trace_id: traceIn } = await req.json();
    if (!session_id && !isUUID(traceIn)) {
      return new Response(JSON.stringify({ error: "session_id ou trace_id requis" }), { status: 400, headers });
    }

    // 1) Retrouver la session Stripe (via session_id, ou via trace_id -> PaymentIntent)
    let session: Stripe.Checkout.Session | null = null;
    let pi: Stripe.PaymentIntent | null = null;

    if (session_id) {
      session = await stripe.checkout.sessions.retrieve(session_id);
      if (!session) return new Response(JSON.stringify({ error: "Session introuvable" }), { status: 404, headers });
      const piId = session.payment_intent as string | null;
      if (piId) pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge.balance_transaction"] });
    } else {
      const { data: payByTrace } = await supabase
        .from("paiements")
        .select("stripe_payment_intent_id")
        .eq("trace_id", traceIn)
        .maybeSingle();

      if (payByTrace?.stripe_payment_intent_id) {
        pi = await stripe.paymentIntents.retrieve(payByTrace.stripe_payment_intent_id, { expand: ["latest_charge.balance_transaction"] });
      } else {
        return new Response(JSON.stringify({ error: "Paiement introuvable pour ce trace_id" }), { status: 404, headers });
      }
    }

    if (!pi && session?.payment_intent) {
      pi = await stripe.paymentIntents.retrieve(session.payment_intent as string, { expand: ["latest_charge.balance_transaction"] });
    }
    if (!pi) return new Response(JSON.stringify({ error: "PaymentIntent introuvable" }), { status: 404, headers });

    const paid =
      (session?.payment_status === "paid" || session?.status === "complete") ||
      (pi.status === "succeeded" || pi.status === "requires_capture");

    if (!paid) {
      return new Response(JSON.stringify({ ok: false, status: session?.payment_status ?? pi.status }), { status: 200, headers });
    }

    // 2) Montants + charges
    const amountTotalCents = (session?.amount_total ?? pi.amount) ?? 0;
    const currency = (pi.currency ?? "eur");

    let stripeFeeCents = 0, balanceTxId: string | null = null, chargeId: string | null = null, receiptUrl: string | null = null;
    if (pi.latest_charge) {
      const ch: any =
        typeof (pi.latest_charge as any).balance_transaction !== "undefined"
          ? (pi.latest_charge as any)
          : await stripe.charges.retrieve(pi.latest_charge as string, { expand: ["balance_transaction"] });

      chargeId = ch.id ?? null;
      receiptUrl = ch.receipt_url ?? null;

      const bt = ch.balance_transaction;
      if (bt && typeof bt === "object" && "fee" in bt) {
        stripeFeeCents = bt.fee ?? 0;
        balanceTxId = bt.id ?? null;
      } else if (typeof bt === "string") {
        const bt2 = await stripe.balanceTransactions.retrieve(bt);
        stripeFeeCents = bt2?.fee ?? 0;
        balanceTxId = bt2?.id ?? null;
      }
    }

    // 3) Metadata consolidée
    const md = { ...(session?.metadata || {}), ...(pi.metadata || {}) } as Record<string,string>;
    const trace_id = isUUID(md["trace_id"]) ? md["trace_id"] : (isUUID(traceIn) ? traceIn : null);
    const course_id = isUUID(md["course_id"]) ? md["course_id"] : null;
    const user_id   = isUUID(md["user_id"])   ? md["user_id"]   : null;
    const mode      = md["mode"] || "individuel";

    const inscription_id_md = md["inscription_id"];
    const group_ids_csv = md["group_ids"] || "";
    const inscription_ids_csv = md["inscription_ids"] || "";
    const inscIds = inscription_ids_csv ? inscription_ids_csv.split(",").filter(isUUID) : [];

    // 4) Destination (organisateur)
    let destinationAccount: string | null = null;
    if (course_id) {
      const { data: course } = await supabase.from("courses").select("organisateur_id").eq("id", course_id).single();
      if (course?.organisateur_id) {
        const { data: profil } = await supabase.from("profils_utilisateurs").select("stripe_account_id").eq("user_id", course.organisateur_id).maybeSingle();
        destinationAccount = profil?.stripe_account_id ?? null;
      }
    }

    // Commission plateforme
    const platformFeeCents = Math.round(amountTotalCents * 0.05);

    // 5) Idempotent: compléter/mettre à jour la ligne paiements
    const payRowData: any = {
      inscription_id: mode === "individuel"
        ? (isUUID(inscriptionIdIn) ? inscriptionIdIn : (isUUID(inscription_id_md) ? inscription_id_md : null))
        : null,
      montant_total: amountTotalCents / 100,
      devise: currency,
      stripe_payment_intent_id: String(pi.id),
      status: pi.status ?? "succeeded",
      reversement_effectue: false,
      user_id,
      type: mode,
      inscription_ids: mode === "individuel"
        ? [ (isUUID(inscriptionIdIn) ? inscriptionIdIn : (isUUID(inscription_id_md) ? inscription_id_md : "")) ].filter(isUUID)
        : inscIds,
      trace_id,
      receipt_url: receiptUrl,
      charge_id: chargeId,
      destination_account_id: destinationAccount,
      amount_subtotal: amountTotalCents,
      amount_total: amountTotalCents,
      fee_total: stripeFeeCents,
      platform_fee_amount: platformFeeCents,
      balance_transaction_id: balanceTxId,
      options_total_eur: md["options_total_eur"] ? Number(md["options_total_eur"]) : undefined,
    };

    let upsertDone = false;
    if (trace_id) {
      const { data: pre } = await supabase.from("paiements").select("id").eq("trace_id", trace_id).maybeSingle();
      if (pre?.id) { await supabase.from("paiements").update(payRowData).eq("id", pre.id); upsertDone = true; }
    }
    if (!upsertDone) {
      const { data: byPI } = await supabase.from("paiements").select("id").eq("stripe_payment_intent_id", payRowData.stripe_payment_intent_id).maybeSingle();
      if (byPI?.id) await supabase.from("paiements").update(payRowData).eq("id", byPI.id);
      else          await supabase.from("paiements").insert(payRowData);
    }

    // 6) Valider les inscriptions (comme avant)
    if (mode === "individuel") {
      const finalInscId = (isUUID(inscriptionIdIn) ? inscriptionIdIn : (isUUID(inscription_id_md) ? inscription_id_md : null));
      if (finalInscId) await supabase.from("inscriptions").update({ statut: "validé" }).eq("id", finalInscId);
    } else {
      const groupIds = group_ids_csv ? group_ids_csv.split(",").filter(isUUID) : [];
      if (groupIds.length > 0) await supabase.from("inscriptions_groupes").update({ statut: "paye" }).in("id", groupIds);
      if (inscIds.length > 0) await supabase.from("inscriptions").update({ statut: "validé" }).in("id", inscIds);
    }

    // 7) Enfiler virement J+1
    if (destinationAccount) {
      const { data: payRow } = await supabase.from("paiements").select("id").eq("stripe_payment_intent_id", String(pi.id)).maybeSingle();
      const netToTransfer = Math.max(0, amountTotalCents - platformFeeCents - stripeFeeCents);
      if (payRow?.id && netToTransfer > 0) {
        const { data: existsQ } = await supabase
          .from("payout_queue")
          .select("id")
          .eq("paiement_id", payRow.id)
          .eq("status", "pending")
          .maybeSingle();
        if (!existsQ) {
          await supabase.from("payout_queue").insert({
            paiement_id: payRow.id,
            due_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            amount_cents: netToTransfer,
            status: "pending",
          });
        }
      }
    }

    // 8) Retourner de quoi afficher la page “merci”
    let inscriptions: any[] = [];
    if (mode === "individuel") {
      const finalInscId = (isUUID(inscriptionIdIn) ? inscriptionIdIn : (isUUID(inscription_id_md) ? inscription_id_md : null));
      if (finalInscId) {
        const { data: one } = await supabase.from("inscriptions").select("*").eq("id", finalInscId).maybeSingle();
        if (one) inscriptions = [one];
      }
    } else if (inscIds.length > 0) {
      const { data: many } = await supabase.from("inscriptions").select("*").in("id", inscIds);
      inscriptions = many || [];
    }

    return new Response(JSON.stringify({
      ok: true,
      mode,
      trace_id,
      session_id: session_id ?? null,
      payment_intent_id: pi.id,
      amount_total_cents: amountTotalCents,
      currency,
      receipt_url: receiptUrl,
      inscription_ids: mode === "individuel" ? (inscriptions[0]?.id ? [inscriptions[0].id] : []) : inscIds,
      group_ids: (md["group_ids"] || "").split(",").filter(isUUID),
      inscriptions,
    }), { status: 200, headers });
  } catch (e: any) {
    console.error("verify-checkout-session (SCT) error:", e?.message ?? e, e?.stack);
    const debug = Deno.env.get("DEBUG") === "1";
    return new Response(JSON.stringify({ error: debug ? (e?.message ?? "Erreur serveur") : "Erreur serveur" }), { status: 500, headers });
  }
});

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

    // 📌 SCT: tout se lit côté PLATEFORME (pas de stripeAccount)
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (!session) return new Response(JSON.stringify({ error: "Session introuvable" }), { status: 404, headers });

    const paid = session.payment_status === "paid" || session.status === "complete";
    if (!paid) {
      return new Response(JSON.stringify({ ok: false, status: session.payment_status ?? session.status }), { status: 200, headers });
    }

    // PI + charge + balance transaction
    const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string, {
      expand: ["latest_charge.balance_transaction"],
    });

    const amountTotalCents = (session.amount_total ?? pi.amount) ?? 0;
    const currency = (pi.currency ?? "eur");

    // Frais Stripe (plateforme) via balance transaction
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

    // Métadonnées utiles (trace, course, user)
    const md = { ...(session.metadata || {}), ...(pi.metadata || {}) } as Record<string,string>;
    const trace_id = isUUID(md["trace_id"]) ? md["trace_id"] : null;
    const course_id = isUUID(md["course_id"]) ? md["course_id"] : null;
    const user_id = isUUID(md["user_id"]) ? md["user_id"] : null;

    // Récup organiser -> compte connecté (destination des transfers J+1)
    let destinationAccount: string | null = null;
    if (course_id) {
      const { data: course } = await supabase.from("courses").select("organisateur_id").eq("id", course_id).single();
      if (course?.organisateur_id) {
        const { data: profil } = await supabase.from("profils_utilisateurs").select("stripe_account_id").eq("user_id", course.organisateur_id).maybeSingle();
        destinationAccount = profil?.stripe_account_id ?? null;
      }
    }

    // Commission Tickrace (5%) en cents (en SCT on la retient au moment du transfer)
    const platformFeeCents = Math.round(amountTotalCents * 0.05);

    // ✅ Valider l’inscription (idempotent)
    await supabase.from("inscriptions").update({ statut: "validé" }).eq("id", inscription_id);

    // ✅ Upsert paiement (complète le pré-insert)
    const row = {
      inscription_id,
      montant_total: amountTotalCents / 100,
      devise: currency,
      stripe_payment_intent_id: String(pi.id),
      status: pi.status ?? "succeeded",
      reversement_effectue: false,
      user_id,
      type: "individuel",
      inscription_ids: [inscription_id],
      trace_id,
      receipt_url: receiptUrl,
      charge_id: chargeId,
      destination_account_id: destinationAccount,
      amount_subtotal: amountTotalCents,
      amount_total: amountTotalCents,
      fee_total: stripeFeeCents,             // frais Stripe (plateforme, SCT)
      platform_fee_amount: platformFeeCents, // 5% Tickrace
      balance_transaction_id: balanceTxId,
    };

    let upsertDone = false;
    if (trace_id) {
      const { data: pre } = await supabase.from("paiements").select("id").eq("trace_id", trace_id).maybeSingle();
      if (pre?.id) { await supabase.from("paiements").update(row).eq("id", pre.id); upsertDone = true; }
    }
    if (!upsertDone) {
      const { data: byPI } = await supabase.from("paiements").select("id").eq("stripe_payment_intent_id", row.stripe_payment_intent_id).maybeSingle();
      if (byPI?.id) await supabase.from("paiements").update(row).eq("id", byPI.id);
      else          await supabase.from("paiements").insert(row);
    }

    // ✅ Enfile le virement J+1 si pas déjà en file
    if (destinationAccount) {
      const { data: payRow } = await supabase.from("paiements")
        .select("id").eq("stripe_payment_intent_id", String(pi.id)).maybeSingle();

      const netToTransfer = Math.max(0, amountTotalCents - platformFeeCents - stripeFeeCents);
      if (payRow?.id && netToTransfer > 0) {
        const { data: existsQ } = await supabase.from("payout_queue")
          .select("id").eq("paiement_id", payRow.id).eq("status","pending").maybeSingle();
        if (!existsQ) {
          await supabase.from("payout_queue").insert({
            paiement_id: payRow.id,
            due_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), // J+1
            amount_cents: netToTransfer,
            status: "pending",
          });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e: any) {
    console.error("verify-checkout-session (SCT) error:", e?.message ?? e, e?.stack);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500, headers });
  }
});

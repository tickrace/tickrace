// supabase/functions/refunds/index.ts
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const ALLOW = ["https://www.tickrace.com", "http://localhost:5173", "http://127.0.0.1:5173"];
function cors(o: string | null) {
  const origin = o && ALLOW.includes(o) ? o : ALLOW[0];
  return {
    "Access-Control-Allow-Origin": origin,
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

async function requireUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!jwt) return null;
  const { data } = await supabase.auth.getUser(jwt);
  return data?.user ?? null;
}

type Quote = {
  policy_tier: string;   // '>30j_90' | '15_29_50' | '7_14_25' | '<7_0'
  percent: number;       // 90, 50, 25, 0
  days_before: number;
  amount_total_cents: number;
  non_refundable_cents: number;
  base_cents: number;
  refund_cents: number;
};

function toCents(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? Math.round(v) : 0;
}
function computeTier(daysBefore: number): { tier: string; percent: number } {
  if (daysBefore >= 30) return { tier: ">30j_90", percent: 90 };
  if (daysBefore >= 15) return { tier: "15_29_50", percent: 50 };
  if (daysBefore >= 7) return { tier: "7_14_25", percent: 25 };
  return { tier: "<7_0", percent: 0 };
}
function roundCents(x: number): number { return Math.round(x); }

serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  const user = await requireUser(req);
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

  try {
    const body = await req.json();
    const { inscription_id, action, reason } = body || {};
    if (!isUUID(inscription_id) || !["quote", "confirm"].includes(String(action))) {
      return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers });
    }

    // 1) Inscription (sans user_id) + Paiement (utilisÃ© pour contrÃ´le d'accÃ¨s)
    const { data: insc, error: iErr } = await supabase
      .from("inscriptions")
      .select("id, course_id, statut, format_id") // format_id si dispo (sinon null)
      .eq("id", inscription_id)
      .single();
    if (iErr || !insc) return new Response(JSON.stringify({ error: "Inscription introuvable" }), { status: 404, headers });

    const { data: pay, error: pErr } = await supabase
      .from("paiements")
      .select("id, user_id, amount_total, fee_total, platform_fee_amount, stripe_payment_intent_id, transferred_total_cents, refunded_total_cents, reversed_total_cents")
      .eq("inscription_id", inscription_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pErr || !pay) return new Response(JSON.stringify({ error: "Paiement introuvable" }), { status: 404, headers });

    // ContrÃ´le d'accÃ¨s: le payeur
    if (pay.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
    }

    // 2) RÃ©cupÃ©ration de la date de l'Ã©preuve depuis formats
    // on privilÃ©gie l'Ã©preuve choisie (inscriptions.format_id), sinon on prend le format le plus proche (date la plus tÃ´t) de la course
    let fmt: { id: string; date: string | null; heure_depart: string | null } | null = null;

    if (insc.format_id && isUUID(insc.format_id)) {
      const { data: f1, error: f1Err } = await supabase
        .from("formats")
        .select("id, date, heure_depart")
        .eq("id", insc.format_id)
        .maybeSingle();
      if (f1Err) console.error("formats by id error:", f1Err);
      fmt = f1 ?? null;
    }
    if (!fmt) {
      const { data: f2, error: f2Err } = await supabase
        .from("formats")
        .select("id, date, heure_depart")
        .eq("course_id", insc.course_id)
        .order("date", { ascending: true })
        .limit(1);
      if (f2Err) console.error("formats by course error:", f2Err);
      fmt = (f2 && f2.length > 0) ? f2[0] : null;
    }

    if (!fmt || !fmt.date) {
      return new Response(JSON.stringify({ error: "Format introuvable ou sans date" }), { status: 409, headers });
    }

    // 3) Calcul daysBefore
    // On calcule sur la date (J) et, si disponible, l'heure dÃ©part.
    // Pour rester robuste sans lib TZ, on normalise au minuit UTC du jour de l'Ã©preuve.
    const [y, m, d] = String(fmt.date).split("-").map((s) => parseInt(s, 10)); // YYYY-MM-DD
    const eventMidnightUTC = Date.UTC(y, (m - 1), d, 0, 0, 0); // J 00:00 UTC

    // Si heure_depart renseignÃ©e, on l'intÃ¨gre (toujours en UTC pour le diff "jours" simplifiÃ©)
    let eventTs = eventMidnightUTC;
    if (fmt.heure_depart) {
      const [hh, mm, ss = "00"] = String(fmt.heure_depart).split(":");
      const addMs = (parseInt(hh || "0") * 3600 + parseInt(mm || "0") * 60 + parseInt(ss || "0")) * 1000;
      eventTs = eventMidnightUTC + addMs;
    }

    const nowTs = Date.now();
    const daysBefore = Math.floor((eventTs - nowTs) / (24 * 3600 * 1000));
    const { tier, percent } = computeTier(daysBefore);

    // 4) Calculs monÃ©taires (en cents)
    const amount_total_cents = toCents(pay.amount_total);
    const stripe_fee_cents = Math.max(0, toCents(pay.fee_total));
    const platform_fee_cents = Math.max(0, toCents(pay.platform_fee_amount));
    const non_refundable_cents = Math.max(0, stripe_fee_cents + platform_fee_cents);
    const base_cents = Math.max(0, amount_total_cents - non_refundable_cents);
    const refund_cents = roundCents(base_cents * (percent / 100));

    const quote: Quote = {
      policy_tier: tier,
      percent,
      days_before: daysBefore,
      amount_total_cents,
      non_refundable_cents,
      base_cents,
      refund_cents,
    };

    if (action === "quote") {
      return new Response(JSON.stringify({ quote }), { status: 200, headers });
    }

    // 5) action === "confirm" -> insert remboursement (idempotence via refund.id)
    const { data: created, error: rErr } = await supabase
      .from("remboursements")
      .insert([{
        paiement_id: pay.id,
        inscription_id,
        user_id: user.id,
        policy_tier: tier,
        percent,
        amount_total_cents,
        non_refundable_cents,
        base_cents,
        refund_cents,
        status: "requested",
        reason: reason ?? null,
      }])
      .select("id")
      .single();
    if (rErr || !created?.id) {
      return new Response(JSON.stringify({ error: "Insert remboursement impossible" }), { status: 500, headers });
    }

    // 6) Refund Stripe
    const refund = await stripe.refunds.create({
      payment_intent: String(pay.stripe_payment_intent_id),
      amount: refund_cents,
    }, { idempotencyKey: created.id });

    // 7) Reversal des transferts si nÃ©cessaire
    let remainingToReverse = refund_cents;
    let reversalIds: string[] = [];

    if (toCents(pay.transferred_total_cents) > toCents(pay.reversed_total_cents)) {
      const { data: transfers } = await supabase
        .from("paiement_transferts")
        .select("id, transfer_id, amount_cents, reversed_cents, destination_account_id")
        .eq("paiement_id", pay.id)
        .order("created_at", { ascending: false });

      const alreadyReversed = toCents(pay.reversed_total_cents);
      let transferable = Math.max(0, (toCents(pay.transferred_total_cents) - alreadyReversed));

      if (transferable > 0) {
        for (const t of transfers || []) {
          if (remainingToReverse <= 0) break;
          const remainingOnThis = Math.max(0, toCents(t.amount_cents) - toCents(t.reversed_cents));
          if (remainingOnThis <= 0) continue;
          const doReverse = Math.min(remainingOnThis, remainingToReverse);

          const rev = await stripe.transfers.createReversal(String(t.transfer_id), { amount: doReverse });
          reversalIds.push(rev.id);

          await supabase
            .from("paiement_transferts")
            .update({ reversed_cents: toCents(t.reversed_cents) + doReverse })
            .eq("id", t.id);

          remainingToReverse -= doReverse;
          transferable -= doReverse;
        }
      }
    }

    // 8) MAJ DB
    const newRefunded = toCents(pay.refunded_total_cents) + refund_cents;
    const newReversed = toCents(pay.reversed_total_cents) + (refund_cents - remainingToReverse);

    await supabase.from("paiements")
      .update({ refunded_total_cents: newRefunded, reversed_total_cents: newReversed })
      .eq("id", pay.id);

    const fullRefunded = refund_cents >= base_cents && percent > 0;
    const newStatus = percent === 0 ? insc.statut : (fullRefunded ? "remboursÃ©e_totalement" : "remboursÃ©e_partiellement");

    await supabase.from("inscriptions")
      .update({ statut: newStatus, cancelled_at: new Date().toISOString() })
      .eq("id", inscription_id);

    await supabase.from("remboursements")
      .update({
        status: "succeeded",
        processed_at: new Date().toISOString(),
        stripe_refund_id: refund.id,
        transfer_reversal_ids: reversalIds.length ? reversalIds : null,
      })
      .eq("id", created.id);

    return new Response(JSON.stringify({
      ok: true,
      quote,
      refund_id: created.id,
      stripe_refund_id: refund.id,
      transfer_reversal_ids: reversalIds,
    }), { status: 200, headers });

  } catch (e: any) {
    console.error("refunds error:", e?.message ?? e, e?.stack);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500, headers });
  }
});

// hard guard
try { (globalThis | Out-Null) } catch {} // keep file non-empty

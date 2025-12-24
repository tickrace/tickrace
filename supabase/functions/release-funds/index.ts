// supabase/functions/release-funds/index.ts
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@16.6.0?target=deno";

/* ------------------------------ ENV ------------------------------ */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

/* --------------------------- Clients ----------------------------- */
const supabaseSR = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });

/* ------------------------------ CORS ----------------------------- */
const ALLOWLIST = ["https://www.tickrace.com", "http://localhost:5173", "http://127.0.0.1:5173"];
function cors(origin: string | null) {
  const o = origin && ALLOWLIST.includes(origin) ? origin : ALLOWLIST[0];
  return {
    "Access-Control-Allow-Origin": o,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function ok(body: any, headers: Headers | Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

// ✔ parse "8,92" ou "8.92" ou 8.92
function normEuro(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val !== "string") return NaN;
  const s = val.replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/* --------------------------- Admin gate -------------------------- */
async function requireAdmin(req: Request) {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!jwt) return { ok: false, code: 401 as const };

  const { data: u, error } = await supabaseSR.auth.getUser(jwt);
  if (error || !u?.user?.id) return { ok: false, code: 401 as const };

  const { data: adminRow, error: adminErr } = await supabaseSR
    .from("admins")
    .select("user_id")
    .eq("user_id", u.user.id)
    .maybeSingle();

  if (adminErr) return { ok: false, code: 500 as const };
  if (!adminRow) return { ok: false, code: 403 as const };

  return { ok: true as const, user: u.user };
}

/* ------------------ Hydrate destination_account ------------------ */
/**
 * destination_account_id = profils_utilisateurs.stripe_account_id
 * chain:
 * paiement -> inscription(anchor) -> (course_id OR formats.course_id) -> course.organisateur_id -> profils_utilisateurs.stripe_account_id
 */
async function hydrateDestinationAccount(p: any): Promise<string | null> {
  if (p?.destination_account_id) return p.destination_account_id as string;

  const insId = (p?.inscription_ids?.[0] as string | null) ?? null;
  if (!insId) return null;

  // 1) inscription (course_id + format_id)
  const { data: ins, error: insErr } = await supabaseSR
    .from("inscriptions")
    .select("course_id, format_id")
    .eq("id", insId)
    .maybeSingle();

  if (insErr) {
    console.error("HYDRATE_DEST_INS_ERROR", insErr);
    return null;
  }

  let courseId: string | null = (ins as any)?.course_id ?? null;

  // 2) fallback via format -> course_id (utile si anciennes inscriptions n’ont pas course_id)
  if (!courseId) {
    const formatId: string | null = (ins as any)?.format_id ?? null;
    if (formatId) {
      const { data: f, error: fErr } = await supabaseSR
        .from("formats")
        .select("course_id")
        .eq("id", formatId)
        .maybeSingle();
      if (fErr) console.error("HYDRATE_DEST_FORMAT_ERROR", fErr);
      courseId = (f as any)?.course_id ?? null;
    }
  }

  if (!courseId) return null;

  // 3) course -> organisateur
  const { data: c, error: cErr } = await supabaseSR
    .from("courses")
    .select("organisateur_id")
    .eq("id", courseId)
    .maybeSingle();

  if (cErr) {
    console.error("HYDRATE_DEST_COURSE_ERROR", cErr);
    return null;
  }

  const orgaId = (c as any)?.organisateur_id ?? null;
  if (!orgaId) return null;

  // 4) profil -> stripe_account_id
  const { data: prof, error: pErr } = await supabaseSR
    .from("profils_utilisateurs")
    .select("stripe_account_id")
    .eq("user_id", orgaId)
    .maybeSingle();

  if (pErr) {
    console.error("HYDRATE_DEST_PROFILE_ERROR", pErr);
    return null;
  }

  const acct = (prof as any)?.stripe_account_id ?? null;
  if (!acct || typeof acct !== "string" || !acct.startsWith("acct_")) return null;

  const { error: upErr } = await supabaseSR
    .from("paiements")
    .update({ destination_account_id: acct, updated_at: new Date().toISOString() })
    .eq("id", p.id);

  if (upErr) console.error("HYDRATE_DEST_UPDATE_PAIEMENT_ERROR", upErr);

  return acct as string;
}

/* ------------------ Hydrate charge_id + fee_total ----------------- */
/**
 * Si charge_id / fee_total manquent, on les récupère via PaymentIntent.latest_charge
 * puis balance_transaction.fee
 */
async function hydrateChargeAndFees(p: any): Promise<{ chargeId: string | null; feeTotal: number | null }> {
  const existingCharge = (p?.charge_id as string | null) || (p?.stripe_charge_id as string | null) || null;
  const existingFee = typeof p?.fee_total === "number" ? (p.fee_total as number) : null;

  if (existingCharge && existingFee !== null) return { chargeId: existingCharge, feeTotal: existingFee };

  const piId =
    (p?.stripe_payment_intent_id as string | null) ||
    (p?.stripe_payment_intent as string | null) ||
    null;

  if (!piId) return { chargeId: existingCharge, feeTotal: existingFee };

  let charge: any = null;
  try {
    const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
    charge = (pi as any)?.latest_charge ?? null;
    if (typeof charge === "string") charge = await stripe.charges.retrieve(charge);
  } catch (e) {
    console.error("HYDRATE_PI_ERROR", { piId, e: (e as any)?.message || e });
    return { chargeId: existingCharge, feeTotal: existingFee };
  }

  const chargeId = (charge?.id as string | null) ?? existingCharge ?? null;
  const balanceTxId = typeof charge?.balance_transaction === "string" ? charge.balance_transaction : null;

  let feeTotal: number | null = existingFee;
  if (balanceTxId && feeTotal === null) {
    try {
      const bt = await stripe.balanceTransactions.retrieve(balanceTxId);
      feeTotal = typeof (bt as any)?.fee === "number" ? (bt as any).fee : null;
    } catch (e) {
      console.error("HYDRATE_BALANCE_TX_ERROR", { balanceTxId, e: (e as any)?.message || e });
    }
  }

  const { error: upErr } = await supabaseSR
    .from("paiements")
    .update({
      charge_id: chargeId,
      stripe_charge_id: chargeId,
      balance_transaction_id: balanceTxId,
      fee_total: feeTotal,
      updated_at: new Date().toISOString(),
    })
    .eq("id", p.id);

  if (upErr) console.error("HYDRATE_CHARGE_FEES_UPDATE_ERROR", upErr);

  return { chargeId, feeTotal };
}

/* ------------------------- gross computation ---------------------- */
function computeGrossCents(p: any): number {
  // priorité aux colonnes “cents”
  const a = Number(p?.total_amount_cents);
  if (Number.isFinite(a) && a > 0) return Math.round(a);

  const b = Number(p?.amount_total); // chez toi: integer, généralement cents
  if (Number.isFinite(b) && b > 0) return Math.round(b);

  const c = Number(p?.total_amount_cents); // doublon au cas où
  if (Number.isFinite(c) && c > 0) return Math.round(c);

  // fallback: montant_total (EUR en numeric)
  const m = Number(p?.montant_total);
  if (Number.isFinite(m) && m > 0) return Math.round(m * 100);

  return 0;
}

/* ------------------------------ Main ----------------------------- */
serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return ok({ error: "Method not allowed" }, headers, 405);

  const adm = await requireAdmin(req);
  if (!adm.ok) {
    const msg = adm.code === 401 ? "Unauthorized" : adm.code === 403 ? "Forbidden" : "Admin check error";
    return ok({ error: msg }, headers, adm.code);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { paiement_id, inscription_id, amount_eur } = body || {};
    if (!paiement_id && !inscription_id) {
      return ok({ error: "paiement_id ou inscription_id requis" }, headers, 400);
    }

    const { data: p, error: pe } = await supabaseSR
      .from("paiements")
      .select(
        [
          "id",
          "created_at",
          "inscription_ids",
          "montant_total",
          "total_amount_cents",
          "amount_total",
          "fee_total",
          "platform_fee_amount",
          "transferred_total_cents",
          "charge_id",
          "stripe_charge_id",
          "stripe_payment_intent_id",
          "stripe_payment_intent",
          "trace_id",
          "destination_account_id",
          "devise",
        ].join(","),
      )
      .or(
        `id.eq.${paiement_id ?? "00000000-0000-0000-0000-000000000000"},inscription_id.eq.${inscription_id ?? "00000000-0000-0000-0000-000000000000"}`,
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pe) {
      console.error("PAIEMENT_LOOKUP_ERROR", pe);
      return ok({ error: "paiement lookup error", details: pe.message }, headers, 500);
    }
    if (!p) return ok({ error: "paiement introuvable" }, headers, 404);

    // hydrate destination
    let destination = (p as any).destination_account_id as string | null;
    if (!destination) destination = await hydrateDestinationAccount(p);

    // hydrate charge + fees
    let chargeId = ((p as any).charge_id as string | null) || ((p as any).stripe_charge_id as string | null) || null;
    if (!chargeId || typeof (p as any).fee_total !== "number") {
      const h = await hydrateChargeAndFees(p);
      chargeId = chargeId || h.chargeId;
    }

    if (!destination || !chargeId) {
      return ok(
        {
          error: "destination_account_id / charge_id manquant",
          paiement_id: (p as any).id,
          destination_account_id: destination,
          charge_id: chargeId,
        },
        headers,
        400,
      );
    }

    const already = Number((p as any).transferred_total_cents || 0);

    const gross = computeGrossCents(p);
    const platform = Number((p as any).platform_fee_amount || 0);
    const feeStripe = Number((p as any).fee_total || 0);

    const maxNet = Math.max(0, gross - platform - feeStripe - already);

    const eurVal = normEuro(amount_eur);
    if (!Number.isFinite(eurVal) || eurVal <= 0) {
      return ok({ error: "amount_eur invalide" }, headers, 400);
    }

    const requested = Math.round(eurVal * 100);
    const toTransfer = Math.min(requested, maxNet);
    if (toTransfer <= 0) return ok({ error: "rien à transférer" }, headers, 400);

    const tr = await stripe.transfers.create({
      amount: toTransfer,
      currency: (((p as any).devise || "eur") as any),
      destination,
      source_transaction: chargeId,
      transfer_group: (p as any).trace_id ? `grp_${String((p as any).trace_id)}` : undefined,
    });

    await supabaseSR.from("paiement_transferts").insert({
      paiement_id: (p as any).id,
      amount_cents: toTransfer,
      transfer_id: tr.id,
      status: "succeeded",
    });

    const newTotal = already + toTransfer;
    await supabaseSR
      .from("paiements")
      .update({
        transferred_total_cents: newTotal,
        last_transfer_at: new Date().toISOString(),
        reversement_effectue: newTotal >= Math.max(0, gross - platform - feeStripe),
        updated_at: new Date().toISOString(),
      })
      .eq("id", (p as any).id);

    return ok({ ok: true, transfer_id: tr.id, amount_cents: toTransfer }, headers, 200);
  } catch (e: any) {
    console.error("release-funds error:", e?.raw?.message || e?.message || e);
    return ok(
      { error: e?.raw?.message || e?.message || "Erreur serveur", stripe: e?.raw ?? null },
      headers,
      500,
    );
  }
});

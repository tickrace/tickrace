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

// parse "8,92" / "8.92" / 8.92
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

/* ------------------ netTotal + alreadyPaid (aligné run-reversements) ------------------ */
async function computeNetTotalForPaiement(paiementId: string): Promise<number> {
  const { data, error } = await supabaseSR
    .from("organisateur_ledger")
    .select("net_org_cents")
    .eq("source_table", "paiements")
    .eq("source_id", paiementId)
    .eq("status", "confirmed")
    .limit(2000);

  if (error) throw error;
  return (data || []).reduce((s, r) => s + Number((r as any).net_org_cents || 0), 0);
}

async function computeAlreadyPaidForPaiement(paiementId: string): Promise<number> {
  const { data, error } = await supabaseSR
    .from("organisateur_reversements")
    .select("amount_cents")
    .eq("paiement_id", paiementId)
    .eq("status", "paid")
    .limit(2000);

  if (error) throw error;
  return (data || []).reduce((s, r) => s + Number((r as any).amount_cents || 0), 0);
}

/* ------------------ Hydrate destination + orga/course ------------------ */
async function hydrateOrgaCourseAndDestination(p: any): Promise<{
  destination: string | null;
  courseId: string | null;
  organisateurId: string | null;
}> {
  const existingDest = (p?.destination_account_id as string | null) ?? null;
  const insId = (p?.inscription_ids?.[0] as string | null) ?? (p?.inscription_id as string | null) ?? null;
  if (!insId) return { destination: existingDest, courseId: null, organisateurId: null };

  const { data: ins, error: insErr } = await supabaseSR
    .from("inscriptions")
    .select("course_id, format_id")
    .eq("id", insId)
    .maybeSingle();
  if (insErr) {
    console.error("HYDRATE_INS_ERROR", insErr);
    return { destination: existingDest, courseId: null, organisateurId: null };
  }

  let courseId: string | null = (ins as any)?.course_id ?? null;

  if (!courseId) {
    const formatId: string | null = (ins as any)?.format_id ?? null;
    if (formatId) {
      const { data: f } = await supabaseSR.from("formats").select("course_id").eq("id", formatId).maybeSingle();
      courseId = (f as any)?.course_id ?? null;
    }
  }
  if (!courseId) return { destination: existingDest, courseId: null, organisateurId: null };

  const { data: c, error: cErr } = await supabaseSR
    .from("courses")
    .select("organisateur_id")
    .eq("id", courseId)
    .maybeSingle();
  if (cErr) {
    console.error("HYDRATE_COURSE_ERROR", cErr);
    return { destination: existingDest, courseId, organisateurId: null };
  }

  const organisateurId = (c as any)?.organisateur_id ?? null;
  if (!organisateurId) return { destination: existingDest, courseId, organisateurId: null };

  let destination = existingDest;

  if (!destination) {
    const { data: prof } = await supabaseSR
      .from("profils_utilisateurs")
      .select("stripe_account_id")
      .eq("user_id", organisateurId)
      .maybeSingle();

    const acct = (prof as any)?.stripe_account_id ?? null;
    if (acct && typeof acct === "string" && acct.startsWith("acct_")) destination = acct;

    if (destination) {
      const { error: upErr } = await supabaseSR
        .from("paiements")
        .update({ destination_account_id: destination, updated_at: new Date().toISOString() })
        .eq("id", p.id);
      if (upErr) console.error("HYDRATE_DEST_UPDATE_PAIEMENT_ERROR", upErr);
    }
  }

  return { destination, courseId, organisateurId };
}

/* ------------------ Hydrate charge_id + fee_total ----------------- */
async function hydrateChargeAndFees(p: any): Promise<{ chargeId: string | null; feeTotal: number | null }> {
  const existingCharge = (p?.charge_id as string | null) || (p?.stripe_charge_id as string | null) || null;
  const existingFee = typeof p?.fee_total === "number" ? (p.fee_total as number) : null;
  if (existingCharge && existingFee !== null) return { chargeId: existingCharge, feeTotal: existingFee };

  const piId = (p?.stripe_payment_intent_id as string | null) || (p?.stripe_payment_intent as string | null) || null;
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
  const a = Number(p?.total_amount_cents);
  if (Number.isFinite(a) && a > 0) return Math.round(a);

  const b = Number(p?.amount_total);
  if (Number.isFinite(b) && b > 0) return Math.round(b);

  const m = Number(p?.montant_total);
  if (Number.isFinite(m) && m > 0) return Math.round(m * 100);

  return 0;
}

/* ------------------ Alignement reversements/ledger ------------------ */
async function writeManualReversementAndLedger(params: {
  organisateur_id: string;
  course_id: string;
  paiement_id: string;
  amount_cents: number;
  stripe_transfer_id: string;
}) {
  const nowIso = new Date().toISOString();

  // reversement manuel tranche=0 (multi-rows autorisées, et stripe_transfer_id unique)
  const { data: rev, error: revErr } = await supabaseSR
    .from("organisateur_reversements")
    .insert({
      organisateur_id: params.organisateur_id,
      course_id: params.course_id,
      paiement_id: params.paiement_id,
      tranche: 0,
      due_at: nowIso,
      currency: "eur",
      status: "paid",
      amount_cents: params.amount_cents,
      stripe_transfer_id: params.stripe_transfer_id,
      executed_at: nowIso,
      updated_at: nowIso,
      error: null,
    })
    .select("id")
    .maybeSingle();

  if (revErr) {
    // si déjà inséré (unique stripe_transfer_id) => on relit et on continue
    const code = (revErr as any)?.code || "";
    if (code === "23505") {
      const { data: ex } = await supabaseSR
        .from("organisateur_reversements")
        .select("id")
        .eq("stripe_transfer_id", params.stripe_transfer_id)
        .maybeSingle();
      const revId = (ex as any)?.id ?? null;
      if (!revId) throw new Error("reversement existant introuvable après conflit stripe_transfer_id");
      return { reversement_id: revId, ledger: "skipped_existing_reversement" };
    }
    throw revErr;
  }

  const reversementId = (rev as any)?.id as string | undefined;
  if (!reversementId) throw new Error("reversement_id manquant après insert");

  // ledger idempotent via source_key unique
  const sourceKey = `reversements:${reversementId}:transfer_created:${params.stripe_transfer_id}`;
  const { error: ledErr } = await supabaseSR.from("organisateur_ledger").insert({
    organisateur_id: params.organisateur_id,
    course_id: params.course_id,
    source_table: "organisateur_reversements",
    source_id: reversementId,
    source_event: "transfer_created",
    source_key: sourceKey,
    occurred_at: nowIso,
    gross_cents: 0,
    tickrace_fee_cents: 0,
    stripe_fee_cents: 0,
    net_org_cents: params.amount_cents,
    currency: "eur",
    status: "confirmed",
    label: "Reversement manuel (admin)",
    metadata: { paiement_id: params.paiement_id, transfer_id: params.stripe_transfer_id, tranche: 0 },
  });

  if (ledErr) {
    const code = (ledErr as any)?.code || "";
    if (code !== "23505") throw ledErr;
  }

  return { reversement_id: reversementId, ledger: "inserted" };
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
    if (!paiement_id && !inscription_id) return ok({ error: "paiement_id ou inscription_id requis" }, headers, 400);

    const { data: p, error: pe } = await supabaseSR
      .from("paiements")
      .select(
        [
          "id",
          "created_at",
          "inscription_ids",
          "inscription_id",
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
        `id.eq.${paiement_id ?? "00000000-0000-0000-0000-000000000000"},inscription_id.eq.${
          inscription_id ?? "00000000-0000-0000-0000-000000000000"
        }`,
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pe) return ok({ error: "paiement lookup error", details: pe.message }, headers, 500);
    if (!p) return ok({ error: "paiement introuvable" }, headers, 404);

    // hydrate destination + orga/course
    const hDest = await hydrateOrgaCourseAndDestination(p);
    const destination = hDest.destination;
    const courseId = hDest.courseId;
    const organisateurId = hDest.organisateurId;

    // hydrate charge + fees
    let chargeId = ((p as any).charge_id as string | null) || ((p as any).stripe_charge_id as string | null) || null;
    if (!chargeId || typeof (p as any).fee_total !== "number") {
      const h = await hydrateChargeAndFees(p);
      chargeId = chargeId || h.chargeId;
    }

    if (!destination || !chargeId || !organisateurId || !courseId) {
      return ok(
        {
          error: "destination_account_id / charge_id / organisateur_id / course_id manquant",
          paiement_id: (p as any).id,
          destination_account_id: destination,
          charge_id: chargeId,
          organisateur_id: organisateurId,
          course_id: courseId,
        },
        headers,
        400,
      );
    }

    // montant demandé
    const eurVal = normEuro(amount_eur);
    if (!Number.isFinite(eurVal) || eurVal <= 0) return ok({ error: "amount_eur invalide" }, headers, 400);
    const requested = Math.round(eurVal * 100);

    // cap "Stripe/charge math" (ton ancien calcul)
    const alreadyStripe = Number((p as any).transferred_total_cents || 0);
    const gross = computeGrossCents(p);
    const platform = Number((p as any).platform_fee_amount || 0);
    const feeStripe = Number((p as any).fee_total || 0);
    const maxNetFromPaiements = Math.max(0, gross - platform - feeStripe - alreadyStripe);

    // cap "ledger" (aligné run-reversements)
    const netTotal = await computeNetTotalForPaiement((p as any).id);
    const alreadyPaid = await computeAlreadyPaidForPaiement((p as any).id);
    const remainingLedger = Math.max(0, netTotal - alreadyPaid);

    // cap final blindé
    const toTransfer = Math.min(requested, maxNetFromPaiements, remainingLedger);
    if (toTransfer <= 0) return ok({ error: "rien à transférer (cap atteint)" }, headers, 400);

    // Stripe transfer (admin)
    const tr = await stripe.transfers.create({
      amount: toTransfer,
      currency: (((p as any).devise || "eur") as any),
      destination,
      source_transaction: chargeId,
      transfer_group: (p as any).trace_id ? `grp_${String((p as any).trace_id)}` : undefined,
      metadata: {
        paiement_id: String((p as any).id),
        course_id: String(courseId),
        organisateur_id: String(organisateurId),
        mode: "admin_release_funds",
      },
    });

    // log paiement_transferts
    await supabaseSR.from("paiement_transferts").insert({
      paiement_id: (p as any).id,
      amount_cents: toTransfer,
      transfer_id: tr.id,
      status: "succeeded",
    });

    // update paiements
    const newTotal = alreadyStripe + toTransfer;
    await supabaseSR
      .from("paiements")
      .update({
        transferred_total_cents: newTotal,
        last_transfer_at: new Date().toISOString(),
        reversement_effectue: newTotal >= Math.max(0, gross - platform - feeStripe),
        updated_at: new Date().toISOString(),
      })
      .eq("id", (p as any).id);

    // ✅ Alignement Option 1 : reversements + ledger
    const aligned = await writeManualReversementAndLedger({
      organisateur_id: organisateurId,
      course_id: courseId,
      paiement_id: String((p as any).id),
      amount_cents: toTransfer,
      stripe_transfer_id: tr.id,
    });

    return ok(
      {
        ok: true,
        paiement_id: (p as any).id,
        transfer_id: tr.id,
        amount_cents: toTransfer,
        caps: { maxNetFromPaiements, remainingLedger, requested },
        reversement_id: aligned.reversement_id,
        ledger: aligned.ledger,
      },
      headers,
      200,
    );
  } catch (e: any) {
    console.error("release-funds error:", e?.raw?.message || e?.message || e);
    return ok({ error: e?.raw?.message || e?.message || "Erreur serveur", stripe: e?.raw ?? null }, headers, 500);
  }
});

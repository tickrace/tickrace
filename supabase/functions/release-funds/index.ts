// supabase/functions/release-funds/index.ts
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@16.6.0?target=deno";
import { z } from "https://esm.sh/zod@3.23.8";

/* ------------------------------ ENV ------------------------------ */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });
const supabaseSR = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/* ------------------------------ CORS ------------------------------ */
const ALLOWLIST = [
  "https://www.tickrace.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

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

function ok(body: any, headers: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

/* ------------------------------ Utils ------------------------------ */
function normEuro(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val !== "string") return NaN;
  const s = val.replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
function cents(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

/* ------------------------------ Auth admin ------------------------------ */
async function requireAdmin(req: Request) {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!jwt) return { ok: false as const, code: 401 as const };

  const { data: u, error: uErr } = await supabaseSR.auth.getUser(jwt);
  if (uErr || !u?.user?.id) return { ok: false as const, code: 401 as const };

  const { data: adminRow, error: aErr } = await supabaseSR
    .from("admins")
    .select("user_id")
    .eq("user_id", u.user.id)
    .maybeSingle();

  if (aErr) {
    console.error("admins check error:", aErr);
    return { ok: false as const, code: 500 as const };
  }
  if (!adminRow) return { ok: false as const, code: 403 as const };

  return { ok: true as const, user: u.user };
}

/* ------------------------------ Body ------------------------------ */
const Body = z
  .object({
    paiement_id: z.string().uuid().optional(),
    inscription_id: z.string().uuid().optional(),
    amount_eur: z.union([z.number(), z.string()]).optional(), // si absent => full
  })
  .strip();

serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return ok({ error: "Method not allowed" }, headers, 405);

  const adm = await requireAdmin(req);
  if (!adm.ok) {
    const msg =
      adm.code === 401 ? "Unauthorized" : adm.code === 403 ? "Forbidden" : "Admin check error";
    return ok({ error: msg }, headers, adm.code);
  }

  try {
    const body = Body.parse(await req.json().catch(() => ({})));
    const { paiement_id, inscription_id, amount_eur } = body || {};

    if (!paiement_id && !inscription_id) {
      return ok({ error: "paiement_id ou inscription_id requis" }, headers, 400);
    }

    // 1) Charger paiement (nouvelle table)
    let q = supabaseSR.from("paiements").select(`
      id,
      devise,
      destination_account_id,
      charge_id,
      stripe_charge_id,
      stripe_payment_intent_id,
      stripe_payment_intent,
      stripe_session_id,
      trace_id,
      inscription_ids,
      transferred_total_cents,
      last_transfer_at,
      reversement_effectue,
      total_amount_cents,
      amount_total,
      platform_fee_amount,
      fee_total,
      refunded_total_cents
    `).limit(1);

    if (paiement_id) {
      q = q.eq("id", paiement_id);
    } else {
      // inscription_ids contient inscription_id
      q = q.contains("inscription_ids", [inscription_id]);
    }

    const { data: p, error: pe } = await q.order("created_at", { ascending: false }).maybeSingle();

    if (pe) {
      console.error("paiement lookup error:", pe);
      return ok({ error: "paiement lookup error", details: pe.message }, headers, 500);
    }
    if (!p) return ok({ error: "paiement introuvable" }, headers, 404);

    const destination = p.destination_account_id;
    const chargeId = p.charge_id || p.stripe_charge_id;

    if (!destination || !chargeId) {
      return ok({ error: "destination_account_id / charge_id manquant" }, headers, 400);
    }

    // 2) Calcul du max transférable (net restant)
    const gross =
      cents(p.total_amount_cents) ||
      cents(p.amount_total) ||
      0;

    const platformFee = cents(p.platform_fee_amount);
    const stripeFee = cents(p.fee_total);
    const refunded = cents(p.refunded_total_cents);
    const already = cents(p.transferred_total_cents);

    const netTotal = Math.max(0, gross - platformFee - stripeFee - refunded);
    const maxNet = Math.max(0, netTotal - already);

    // 3) Montant demandé (si absent => full)
    let toTransfer = maxNet;
    if (typeof amount_eur !== "undefined") {
      const eur = normEuro(amount_eur);
      if (!Number.isFinite(eur) || eur <= 0) {
        return ok({ error: "amount_eur invalide" }, headers, 400);
      }
      const requested = Math.round(eur * 100);
      toTransfer = Math.min(requested, maxNet);
    }

    if (toTransfer <= 0) {
      return ok(
        {
          error: "rien_a_transferer",
          gross,
          platformFee,
          stripeFee,
          refunded,
          already,
          netTotal,
          maxNet,
        },
        headers,
        400,
      );
    }

    // 4) Stripe transfer
    const tr = await stripe.transfers.create({
      amount: toTransfer,
      currency: (p.devise || "eur") as any,
      destination,
      source_transaction: chargeId,
      transfer_group: p.trace_id ? `grp_${p.trace_id}` : undefined,
    });

    // 5) Historique transfert (si table existe)
    const insertRes = await supabaseSR.from("paiement_transferts").insert({
      paiement_id: p.id,
      amount_cents: toTransfer,
      transfer_id: tr.id,
      status: tr.status || "succeeded",
      created_at: new Date().toISOString(),
    });
    if (insertRes.error) {
      // on log mais on ne bloque pas (certaines instances n’ont pas la table)
      console.error("paiement_transferts insert error:", insertRes.error);
    }

    const newTotal = already + toTransfer;
    const reversement_effectue = newTotal >= netTotal;

    const up = await supabaseSR.from("paiements").update({
      transferred_total_cents: newTotal,
      last_transfer_at: new Date().toISOString(),
      reversement_effectue,
      updated_at: new Date().toISOString(),
    }).eq("id", p.id);

    if (up.error) {
      console.error("paiements update error:", up.error);
      // transfert Stripe déjà fait => on renvoie quand même ok + warning
      return ok(
        {
          ok: true,
          warning: "transfer_ok_but_db_update_failed",
          details: up.error.message,
          paiement_id: p.id,
          transfer_id: tr.id,
          amount_cents: toTransfer,
          net_total_cents: netTotal,
          remaining_after_cents: Math.max(0, netTotal - newTotal),
        },
        headers,
        200,
      );
    }

    return ok(
      {
        ok: true,
        paiement_id: p.id,
        transfer_id: tr.id,
        amount_cents: toTransfer,
        gross_cents: gross,
        platform_fee_cents: platformFee,
        stripe_fee_cents: stripeFee,
        refunded_cents: refunded,
        already_cents: already,
        net_total_cents: netTotal,
        transferred_total_cents: newTotal,
        remaining_after_cents: Math.max(0, netTotal - newTotal),
        reversement_effectue,
      },
      headers,
      200,
    );
  } catch (e: any) {
    console.error("release-funds error:", e?.raw?.message || e?.message || e);
    return ok(
      {
        error: e?.raw?.message || e?.message || "Erreur serveur",
        stripe: e?.raw ?? null,
      },
      headers,
      500,
    );
  }
});

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

const ALLOWLIST = ["https://www.tickrace.com", "http://localhost:5173", "http://127.0.0.1:5173"];

/* --------------------------- Clients ----------------------------- */
const supabaseSR = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

/* ------------------------------ CORS ----------------------------- */
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
function json(body: any, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers });
}

/* ----------------------------- Utils ----------------------------- */
// ✅ parse "8,92" ou "8.92" ou 8.92
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

/* -------------------------- Admin guard -------------------------- */
async function requireAdmin(req: Request) {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!jwt) return { ok: false, code: 401 as const, msg: "Unauthorized" };

  const { data, error } = await supabaseSR.auth.getUser(jwt);
  const user = data?.user;
  if (error || !user?.id) return { ok: false, code: 401 as const, msg: "Unauthorized" };

  const { data: adminRow, error: adminErr } = await supabaseSR
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminErr) {
    console.error("ADMINS_CHECK_ERROR", adminErr);
    return { ok: false, code: 500 as const, msg: "Admin check error" };
  }
  if (!adminRow) return { ok: false, code: 403 as const, msg: "Forbidden" };

  return { ok: true as const, user };
}

/* ------------------------------ Main ----------------------------- */
serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, headers);

  const adm = await requireAdmin(req);
  if (!adm.ok) return json({ error: adm.msg }, adm.code, headers);

  try {
    const body = await req.json().catch(() => ({}));
    const paiement_id = body?.paiement_id as string | undefined;
    const inscription_id = body?.inscription_id as string | undefined;
    const amount_eur = body?.amount_eur;

    if (!paiement_id && !inscription_id) {
      return json({ error: "paiement_id ou inscription_id requis" }, 400, headers);
    }

    // ---- Load paiement (support ancienne colonne inscription_id ET nouvelle inscription_ids[])
    let payQuery = supabaseSR.from("paiements").select(`
      id,
      devise,
      trace_id,
      charge_id,
      stripe_charge_id,
      destination_account_id,
      transferred_total_cents,
      last_transfer_at,
      reversement_effectue,
      refunded_total_cents,
      fee_total,
      fee_total_cents,
      platform_fee_amount,
      platform_fee_cents,
      total_amount_cents,
      amount_total,
      amount_total_cents
    `).limit(1);

    if (paiement_id) {
      payQuery = payQuery.eq("id", paiement_id);
    } else if (inscription_id) {
      // nouvelle structure : inscription_ids uuid[]
      // (si jamais tu as encore une colonne inscription_id, tu peux aussi ajouter un OR côté SQL plus tard)
      payQuery = payQuery.contains("inscription_ids", [inscription_id]);
    }

    const { data: p, error: pe } = await payQuery.maybeSingle();
    if (pe) {
      console.error("PAIEMENT_LOOKUP_ERROR", pe);
      return json({ error: "paiement lookup error", details: pe.message }, 500, headers);
    }
    if (!p) return json({ error: "paiement introuvable" }, 404, headers);

    const chargeId = (p.stripe_charge_id || p.charge_id) as string | null;
    const destination = p.destination_account_id as string | null;

    if (!destination || !chargeId) {
      return json({ error: "destination_account_id / charge_id manquants sur le paiement" }, 400, headers);
    }

    const currency = (p.devise || "eur") as any;

    // ---- Calcul net transférable
    // total brut
    const gross =
      cents(p.total_amount_cents) ||
      cents(p.amount_total_cents) ||
      Math.round(cents(p.amount_total) * 100);

    // frais stripe (stockés en cents)
    const stripeFee = cents(p.fee_total_cents) || cents(p.fee_total);

    // commission Tickrace (stockée en cents)
    const platformFee = cents(p.platform_fee_cents) || cents(p.platform_fee_amount);

    // remboursements déjà constatés (si tu l’as)
    const refunded = cents(p.refunded_total_cents);

    // déjà versé
    const already = cents(p.transferred_total_cents);

    // net max transférable = gross - stripe - tickrace - refunded - already
    const maxNet = Math.max(0, gross - stripeFee - platformFee - refunded - already);

    const eur = normEuro(amount_eur);
    if (!Number.isFinite(eur) || eur <= 0) {
      return json({ error: "amount_eur invalide" }, 400, headers);
    }

    const requested = Math.round(eur * 100);
    const toTransfer = Math.min(requested, maxNet);
    if (toTransfer <= 0) return json({ error: "rien à transférer (net restant = 0)" }, 400, headers);

    // ---- Stripe transfer
    const tr = await stripe.transfers.create({
      amount: toTransfer,
      currency,
      destination,
      // transfert “depuis” la charge (séparate charges & transfers)
      source_transaction: chargeId,
      transfer_group: p.trace_id ? `grp_${p.trace_id}` : undefined,
      metadata: {
        paiement_id: String(p.id),
        mode: "manual_release_funds",
      },
    });

    // ---- Historique transferts (ancienne table) + update paiement
    // (si ta table s’appelle autrement, adapte juste ici)
    const { error: te } = await supabaseSR.from("paiement_transferts").insert({
      paiement_id: p.id,
      amount_cents: toTransfer,
      transfer_id: tr.id,
      status: tr?.reversed ? "reversed" : "succeeded",
      created_at: new Date().toISOString(),
    });
    if (te) console.error("PAIEMENT_TRANSFERTS_INSERT_ERROR", te);

    const newTotal = already + toTransfer;
    const netFinal = Math.max(0, gross - stripeFee - platformFee - refunded);
    const fullyPaid = newTotal >= netFinal;

    const { error: ue } = await supabaseSR
      .from("paiements")
      .update({
        transferred_total_cents: newTotal,
        last_transfer_at: new Date().toISOString(),
        reversement_effectue: fullyPaid,
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.id);

    if (ue) console.error("PAIEMENTS_UPDATE_ERROR", ue);

    return json(
      {
        ok: true,
        paiement_id: p.id,
        transfer_id: tr.id,
        amount_cents: toTransfer,
        currency,
        max_net_remaining_cents: maxNet,
        net_final_cents: netFinal,
        transferred_total_cents: newTotal,
        reversement_effectue: fullyPaid,
      },
      200,
      headers,
    );
  } catch (e: any) {
    console.error("RELEASE_FUNDS_FATAL", e?.raw?.message || e?.message || e);
    return json(
      {
        error: e?.raw?.message || e?.message || "Erreur serveur",
        stripe: e?.raw ?? null,
      },
      500,
      headers,
    );
  }
});

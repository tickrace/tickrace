// supabase/functions/release-funds/index.ts
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const supabaseSR = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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

// âœ”ï¸ parse "8,92" ou "8.92" ou 8.92
function normEuro(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val !== "string") return NaN;
  const s = val.replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

// âœ”ï¸ VÃ©rifie lâ€™admin dans la table `admins` (prÃ©sence = admin)
async function requireAdmin(req: Request) {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!jwt) return { ok: false, code: 401 as const };

  const { data: { user }, error } = await supabaseSR.auth.getUser(jwt);
  if (error || !user) return { ok: false, code: 401 as const };

  // âœ… Nouvelle table
  const { data: adminRow, error: adminErr } = await supabaseSR
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminErr) {
    console.error("admins check error:", adminErr);
    return { ok: false, code: 500 as const };
  }
  if (!adminRow) return { ok: false, code: 403 as const };

  return { ok: true as const, user };
}

serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  const adm = await requireAdmin(req);
  if (!adm.ok) {
    const msg = adm.code === 401 ? "Unauthorized" : adm.code === 403 ? "Forbidden" : "Admin check error";
    return new Response(JSON.stringify({ error: msg }), { status: adm.code, headers });
  }

  try {
    const body = await req.json();
    const { paiement_id, inscription_id, amount_eur } = body || {};
    if (!paiement_id && !inscription_id) {
      return new Response(JSON.stringify({ error: "paiement_id ou inscription_id requis" }), { status: 400, headers });
    }

    const { data: p } = await supabaseSR.from("paiements").select(`
      id, amount_total, fee_total, platform_fee_amount, transferred_total_cents,
      charge_id, trace_id, destination_account_id, devise
    `)
      .or(`id.eq.${paiement_id ?? "00000000-0000-0000-0000-000000000000"},inscription_id.eq.${inscription_id ?? "00000000-0000-0000-0000-000000000000"}`)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (!p) return new Response(JSON.stringify({ error: "paiement introuvable" }), { status: 404, headers });
    if (!p.destination_account_id || !p.charge_id) {
      return new Response(JSON.stringify({ error: "destination/charge manquante" }), { status: 400, headers });
    }

    const already = p.transferred_total_cents ?? 0;
    const maxNet = Math.max(0, (p.amount_total ?? 0) - (p.platform_fee_amount ?? 0) - (p.fee_total ?? 0) - already);

    const eur = normEuro(amount_eur);
    if (!Number.isFinite(eur) || eur <= 0) {
      return new Response(JSON.stringify({ error: "amount_eur invalide" }), { status: 400, headers });
    }
    const requested = Math.round(eur * 100);
    const toTransfer = Math.min(requested, maxNet);
    if (toTransfer <= 0) return new Response(JSON.stringify({ error: "rien Ã  transfÃ©rer" }), { status: 400, headers });

    const tr = await stripe.transfers.create({
      amount: toTransfer,
      currency: (p.devise || "eur") as any,
      destination: p.destination_account_id,
      source_transaction: p.charge_id,
      transfer_group: p.trace_id ? `grp_${p.trace_id}` : undefined,
    });

    await supabaseSR.from("paiement_transferts").insert({
      paiement_id: p.id, amount_cents: toTransfer, transfer_id: tr.id, status: "succeeded"
    });
    const newTotal = already + toTransfer;
    await supabaseSR.from("paiements").update({
      transferred_total_cents: newTotal,
      last_transfer_at: new Date().toISOString(),
      reversement_effectue: newTotal >= ((p.amount_total ?? 0) - (p.platform_fee_amount ?? 0) - (p.fee_total ?? 0))
    }).eq("id", p.id);

    return new Response(JSON.stringify({ ok: true, transfer_id: tr.id, amount_cents: toTransfer }), { status: 200, headers });
  } catch (e: any) {
    console.error("release-funds error:", e?.raw?.message || e?.message || e);
    // Renvoie l'erreur Stripe lisible si dispo
    return new Response(JSON.stringify({
      error: e?.raw?.message || e?.message || "Erreur serveur",
      stripe: e?.raw ?? null
    }), { status: 500, headers });
  }
});

// hard guard
try { (globalThis | Out-Null) } catch {} // keep file non-empty

// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// ⚠️ À sécuriser côté appelant (admin only) — par ex. vérifier un header partagé, ou JWT rôle "service"
serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const { paiement_id, inscription_id, amount_eur } = await req.json();
    if (!paiement_id && !inscription_id) return new Response(JSON.stringify({ error: "paiement_id ou inscription_id requis" }), { status: 400 });

    const { data: p } = await supabase.from("paiements").select(`
      id, amount_total, fee_total, platform_fee_amount, transferred_total_cents,
      charge_id, trace_id, destination_account_id, devise
    `)
    .or(`id.eq.${paiement_id ?? '00000000-0000-0000-0000-000000000000'},inscription_id.eq.${inscription_id ?? '00000000-0000-0000-0000-000000000000'}`)
    .order("created_at", { ascending: false })
    .limit(1).maybeSingle();

    if (!p) return new Response(JSON.stringify({ error: "paiement introuvable" }), { status: 404 });
    if (!p.destination_account_id || !p.charge_id) return new Response(JSON.stringify({ error: "destination/charge manquante" }), { status: 400 });

    const already = p.transferred_total_cents ?? 0;
    const maxNet = Math.max(0, (p.amount_total ?? 0) - (p.platform_fee_amount ?? 0) - (p.fee_total ?? 0) - already);
    const requested = Math.round(Number(amount_eur) * 100);
    if (!Number.isFinite(requested) || requested <= 0) return new Response(JSON.stringify({ error: "amount_eur invalide" }), { status: 400 });
    const toTransfer = Math.min(requested, maxNet);
    if (toTransfer <= 0) return new Response(JSON.stringify({ error: "rien à transférer" }), { status: 400 });

    const tr = await stripe.transfers.create({
      amount: toTransfer,
      currency: (p.devise || "eur") as any,
      destination: p.destination_account_id,
      source_transaction: p.charge_id,
      transfer_group: p.trace_id ? `grp_${p.trace_id}` : undefined,
    });

    await supabase.from("paiement_transferts").insert({ paiement_id: p.id, amount_cents: toTransfer, transfer_id: tr.id, status: "succeeded" });
    const newTotal = already + toTransfer;
    await supabase.from("paiements").update({
      transferred_total_cents: newTotal,
      last_transfer_at: new Date().toISOString(),
      reversement_effectue: newTotal >= ((p.amount_total ?? 0) - (p.platform_fee_amount ?? 0) - (p.fee_total ?? 0))
    }).eq("id", p.id);

    return new Response(JSON.stringify({ ok: true, transfer_id: tr.id, amount_cents: toTransfer }), { status: 200 });
  } catch (e: any) {
    console.error("release-funds error:", e?.message ?? e);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500 });
  }
});

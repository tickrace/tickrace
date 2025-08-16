// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

serve(async (req) => {
  try {
    // Traiter en petits lots
    const { data: q } = await supabase
      .from("payout_queue")
      .select("id, paiement_id, amount_cents")
      .lte("due_at", new Date().toISOString())
      .eq("status","pending")
      .order("due_at", { ascending: true })
      .limit(20);

    if (!q || q.length === 0) return new Response(JSON.stringify({ ok: true, processed: 0 }), { status: 200 });

    for (const item of q) {
      await supabase.from("payout_queue").update({ status: "processing", last_attempt_at: new Date().toISOString(), attempts: 1 })
        .eq("id", item.id).in("status", ["pending","failed"]);

      // Charger les infos paiement
      const { data: p } = await supabase.from("paiements").select(`
        id, amount_total, fee_total, platform_fee_amount, transferred_total_cents,
        charge_id, trace_id, destination_account_id, devise
      `).eq("id", item.paiement_id).maybeSingle();

      if (!p?.destination_account_id || !p?.charge_id) {
        await supabase.from("payout_queue").update({ status: "failed", error: "missing destination or charge" }).eq("id", item.id);
        continue;
      }

      const already = p.transferred_total_cents ?? 0;
      const maxNet = Math.max(0, (p.amount_total ?? 0) - (p.platform_fee_amount ?? 0) - (p.fee_total ?? 0) - already);
      const toTransfer = Math.min(item.amount_cents, maxNet);

      if (toTransfer <= 0) {
        await supabase.from("payout_queue").update({ status: "done" }).eq("id", item.id);
        continue;
      }

      try {
        const tr = await stripe.transfers.create({
          amount: toTransfer,
          currency: (p.devise || "eur") as any,
          destination: p.destination_account_id,
          source_transaction: p.charge_id,               // lie aux fonds collectés
          transfer_group: p.trace_id ? `grp_${p.trace_id}` : undefined,
        });

        // Journal + update cumul
        await supabase.from("paiement_transferts").insert({
          paiement_id: p.id, amount_cents: toTransfer, transfer_id: tr.id, status: "succeeded"
        });
        const newTotal = already + toTransfer;
        await supabase.from("paiements").update({
          transferred_total_cents: newTotal,
          last_transfer_at: new Date().toISOString(),
          reversement_effectue: newTotal >= ((p.amount_total ?? 0) - (p.platform_fee_amount ?? 0) - (p.fee_total ?? 0))
        }).eq("id", p.id);

        await supabase.from("payout_queue").update({ status: "done" }).eq("id", item.id);
      } catch (e: any) {
        await supabase.from("payout_queue").update({ status: "failed", error: e?.message ?? String(e) }).eq("id", item.id);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: q.length }), { status: 200 });
  } catch (e: any) {
    console.error("transfer-worker error:", e?.message ?? e);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500 });
  }
});

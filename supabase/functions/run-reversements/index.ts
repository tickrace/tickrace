import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function cors(h = new Headers()) {
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "content-type, authorization, apikey, x-client-info");
  h.set("content-type", "application/json; charset=utf-8");
  return h;
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors() });

const STRIPE_API = "https://api.stripe.com/v1";
async function stripePost(path: string, params: Record<string, string>) {
  const resp = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const txt = await resp.text();
  let parsed: any = null;
  try { parsed = JSON.parse(txt); } catch {}
  if (!resp.ok) {
    console.error("STRIPE_POST_ERROR", path, resp.status, txt);
    throw new Error(`Stripe POST failed: ${path}`);
  }
  return parsed;
}

async function computeNetTotalForPaiement(paiementId: string): Promise<number> {
  const { data, error } = await supabase
    .from("organisateur_ledger")
    .select("net_org_cents")
    .eq("source_table", "paiements")
    .eq("source_id", paiementId)
    .eq("status", "confirmed")
    .limit(1000);

  if (error) throw error;
  return (data || []).reduce((s, r) => s + Number(r.net_org_cents || 0), 0);
}

async function getTranche1PaidAmount(paiementId: string): Promise<number> {
  const { data, error } = await supabase
    .from("organisateur_reversements")
    .select("amount_cents, status")
    .eq("paiement_id", paiementId)
    .eq("tranche", 1)
    .maybeSingle();
  if (error) throw error;
  if (data?.status === "paid") return Number(data.amount_cents || 0);
  return 0;
}

async function markStatus(id: string, patch: any) {
  const { error } = await supabase
    .from("organisateur_reversements")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

serve(async (req) => {
  const headers = cors();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    // 1) Prendre un lot de reversements dus
    const nowIso = new Date().toISOString();

    const { data: due, error: dueErr } = await supabase
      .from("organisateur_reversements")
      .select("id, organisateur_id, course_id, paiement_id, tranche, due_at, currency, status")
      .eq("status", "scheduled")
      .lte("due_at", nowIso)
      .order("due_at", { ascending: true })
      .limit(30);

    if (dueErr) throw dueErr;
    if (!due?.length) return json({ ok: true, processed: 0 });

    let processed = 0;

    for (const r of due) {
      // 2) lock logique: passer en processing uniquement si encore scheduled
      const { data: locked, error: lockErr } = await supabase
        .from("organisateur_reversements")
        .update({ status: "processing", updated_at: nowIso })
        .eq("id", r.id)
        .eq("status", "scheduled")
        .select("id")
        .maybeSingle();

      if (lockErr) {
        console.error("LOCK_ERROR", r.id, lockErr);
        continue;
      }
      if (!locked?.id) continue; // déjà pris par un autre run

      try {
        // 3) stripe account de l’orga + garde-fous
        const { data: prof, error: pErr } = await supabase
          .from("profils_utilisateurs")
          .select("stripe_account_id, stripe_payouts_enabled")
          .eq("user_id", r.organisateur_id)
          .maybeSingle();
        if (pErr) throw pErr;

        const dest = prof?.stripe_account_id || null;
        const payoutsEnabled = !!prof?.stripe_payouts_enabled;
        if (!dest || !payoutsEnabled) {
          await markStatus(r.id, {
            status: "blocked",
            error: !dest ? "stripe_account_id manquant" : "stripe_payouts_enabled=false",
          });
          continue;
        }

        // 4) net total réel via ledger
        const netTotal = await computeNetTotalForPaiement(r.paiement_id);

        // 5) split
        const tranche1Target = Math.floor(netTotal * 0.5);
        let amount = 0;

        if (Number(r.tranche) === 1) {
          amount = Math.max(0, tranche1Target);
        } else {
          const tranche1Paid = await getTranche1PaidAmount(r.paiement_id);
          amount = Math.max(0, netTotal - tranche1Paid);
        }

        // rien à verser
        if (amount <= 0) {
          await markStatus(r.id, {
            status: "skipped",
            amount_cents: 0,
            executed_at: new Date().toISOString(),
            error: netTotal <= 0 ? "net_total<=0" : "reste=0",
          });
          continue;
        }

        // 6) Stripe Transfer -> compte Express
        const tr = await stripePost("/transfers", {
          amount: String(amount),
          currency: (r.currency || "eur").toLowerCase(),
          destination: dest,
          description: `TickRace reversement (tranche ${r.tranche})`,
          "metadata[organisateur_id]": String(r.organisateur_id),
          "metadata[course_id]": String(r.course_id),
          "metadata[paiement_id]": String(r.paiement_id),
          "metadata[tranche]": String(r.tranche),
          transfer_group: `tickrace_course_${r.course_id}`,
        });

        const transferId = tr?.id as string | undefined;
        if (!transferId) throw new Error("Stripe transfer sans id");

        // 7) DB update
        await markStatus(r.id, {
          status: "paid",
          amount_cents: amount,
          stripe_transfer_id: transferId,
          executed_at: new Date().toISOString(),
          error: null,
        });

        // 8) ledger: reversement (net_org_cents positif pour orga)
        await supabase.from("organisateur_ledger").insert({
          organisateur_id: r.organisateur_id,
          course_id: r.course_id,
          source_table: "organisateur_reversements",
          source_id: r.id,
          source_event: "transfer_created",
          source_key: `reversements:${r.id}:transfer_created:${transferId}`,
          occurred_at: new Date().toISOString(),
          gross_cents: 0,
          tickrace_fee_cents: 0,
          stripe_fee_cents: 0,
          net_org_cents: amount,
          currency: (r.currency || "eur").toLowerCase(),
          status: "confirmed",
          label: `Reversement tranche ${r.tranche}`,
          metadata: { transfer_id: transferId, paiement_id: r.paiement_id },
        });

        processed++;
      } catch (e: any) {
        console.error("RUN_REVERSEMENTS_ONE_FAILED", r.id, e);
        await markStatus(r.id, {
          status: "failed",
          error: String(e?.message ?? e),
        });
      }
    }

    return json({ ok: true, processed }, 200);
  } catch (e: any) {
    console.error("RUN_REVERSEMENTS_FATAL", e);
    return json({ error: "failed", details: String(e?.message ?? e) }, 500);
  }
});

// supabase/functions/run-reversements/index.ts
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

/* ------------------------------ ENV ------------------------------ */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

// ✅ Resend
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "TickRace <support@tickrace.com>";
const TICKRACE_BASE_URL = Deno.env.get("TICKRACE_BASE_URL") || "https://www.tickrace.com";

/* --------------------------- Clients ----------------------------- */
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/* ------------------------------ CORS ----------------------------- */
function cors(h = new Headers()) {
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "content-type, authorization, apikey, x-client-info");
  h.set("content-type", "application/json; charset=utf-8");
  return h;
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors() });

/* ----------------------------- Stripe ---------------------------- */
const STRIPE_API = "https://api.stripe.com/v1";
async function stripePost(
  path: string,
  params: Record<string, string>,
  opts?: { idempotencyKey?: string },
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (opts?.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  const resp = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers,
    body: new URLSearchParams(params),
  });

  const txt = await resp.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(txt);
  } catch {
    // ignore
  }

  if (!resp.ok) {
    console.error("STRIPE_POST_ERROR", path, resp.status, txt);
    throw new Error(`Stripe POST failed: ${path}`);
  }
  return parsed;
}

/* ---------------------------- Helpers ---------------------------- */
function eurFromCents(c: number) {
  const v = Number(c || 0) / 100;
  return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

async function computeNetTotalForPaiement(paiementId: string): Promise<number> {
  const { data, error } = await supabase
    .from("organisateur_ledger")
    .select("net_org_cents")
    .eq("source_table", "paiements")
    .eq("source_id", paiementId)
    .eq("status", "confirmed")
    .limit(2000);

  if (error) throw error;
  return (data || []).reduce((s, r) => s + Number((r as any).net_org_cents || 0), 0);
}

/**
 * ✅ Option B blindée :
 * déjàVersé = somme de tous les reversements "paid" pour ce paiement
 * (inclut les reversements manuels tranche=0)
 */
async function computeAlreadyPaidForPaiement(paiementId: string): Promise<number> {
  const { data, error } = await supabase
    .from("organisateur_reversements")
    .select("amount_cents")
    .eq("paiement_id", paiementId)
    .eq("status", "paid")
    .limit(2000);

  if (error) throw error;
  return (data || []).reduce((s, r) => s + Number((r as any).amount_cents || 0), 0);
}

async function markStatus(id: string, patch: any) {
  const { error } = await supabase
    .from("organisateur_reversements")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/* ---------------------------- Resend ----------------------------- */
async function resendSendEmail(payload: { to: string; subject: string; text: string; html?: string }) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY manquant");
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    }),
  });

  const out = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error("RESEND_ERROR", resp.status, out);
    throw new Error((out as any)?.message || "Resend send failed");
  }
  return out; // { id: "..." }
}

/**
 * Anti-doublon email : lock dans organisateur_ledger via source_key unique.
 */
async function sendPayoutEmailOnce(params: {
  organisateur_id: string;
  course_id: string | null;
  reversement_id: string;
  tranche: number;
  amount_cents: number;
  stripe_transfer_id: string;
  paiement_id: string;
}) {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY missing => email skipped");
    return { skipped: true, reason: "missing_resend_key" };
  }

  const lockKey = `reversements:${params.reversement_id}:payout_email`;

  const { error: lockErr } = await supabase.from("organisateur_ledger").insert({
    organisateur_id: params.organisateur_id,
    course_id: params.course_id,
    source_table: "organisateur_reversements",
    source_id: params.reversement_id,
    source_event: "payout_email",
    source_key: lockKey,
    occurred_at: new Date().toISOString(),
    gross_cents: 0,
    tickrace_fee_cents: 0,
    stripe_fee_cents: 0,
    net_org_cents: 0,
    currency: "eur",
    status: "pending",
    label: `Email reversement tranche ${params.tranche}`,
    metadata: {
      paiement_id: params.paiement_id,
      transfer_id: params.stripe_transfer_id,
      tranche: params.tranche,
      amount_cents: params.amount_cents,
      email_status: "pending",
    },
  });

  if (lockErr) {
    const code = (lockErr as any)?.code || "";
    if (code === "23505") return { skipped: true, reason: "already_sent" };
    console.error("EMAIL_LOCK_INSERT_ERROR", lockErr);
    return { skipped: true, reason: "lock_insert_failed" };
  }

  const [{ data: prof }, { data: course }] = await Promise.all([
    supabase
      .from("profils_utilisateurs")
      .select("email, orga_email_facturation, organisation_nom, prenom, nom")
      .eq("user_id", params.organisateur_id)
      .maybeSingle(),
    params.course_id
      ? supabase.from("courses").select("nom").eq("id", params.course_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
  ]);

  const to = (prof as any)?.orga_email_facturation || (prof as any)?.email || null;

  if (!to) {
    await supabase
      .from("organisateur_ledger")
      .update({
        status: "void",
        metadata: {
          paiement_id: params.paiement_id,
          transfer_id: params.stripe_transfer_id,
          tranche: params.tranche,
          amount_cents: params.amount_cents,
          email_status: "failed",
          error: "no_recipient_email",
        },
      })
      .eq("source_key", lockKey);

    return { skipped: true, reason: "no_recipient_email" };
  }

  const orgName =
    (prof as any)?.organisation_nom ||
    [((prof as any)?.prenom || "").trim(), ((prof as any)?.nom || "").trim()].filter(Boolean).join(" ") ||
    "Organisateur";

  const courseName = (course as any)?.nom || "—";
  const amountTxt = eurFromCents(params.amount_cents);
  const comptaUrl = `${TICKRACE_BASE_URL}/organisateur/compta`;

  const subject = `TickRace — Reversement effectué : ${amountTxt}`;
  const text = [
    `Bonjour ${orgName},`,
    "",
    `Un reversement vient d’être effectué sur votre compte Stripe.`,
    "",
    `• Course : ${courseName}`,
    `• Tranche : ${params.tranche}`,
    `• Montant : ${amountTxt}`,
    `• Transfer Stripe : ${params.stripe_transfer_id}`,
    "",
    `Historique & solde à venir : ${comptaUrl}`,
    "",
    `— TickRace`,
  ].join("\n");

  const html = `
    <div style="font-family: ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial; line-height:1.5">
      <p>Bonjour <b>${orgName}</b>,</p>
      <p>Un reversement vient d’être effectué sur votre compte Stripe.</p>
      <ul>
        <li><b>Course</b> : ${courseName}</li>
        <li><b>Tranche</b> : ${params.tranche}</li>
        <li><b>Montant</b> : ${amountTxt}</li>
        <li><b>Transfer Stripe</b> : <code>${params.stripe_transfer_id}</code></li>
      </ul>
      <p>
        <a href="${comptaUrl}" target="_blank" rel="noopener noreferrer">
          Voir l’historique des reversements & le solde à venir
        </a>
      </p>
      <p style="color:#666">— TickRace</p>
    </div>
  `;

  try {
    const out = await resendSendEmail({ to, subject, text, html });

    await supabase
      .from("organisateur_ledger")
      .update({
        status: "confirmed",
        metadata: {
          paiement_id: params.paiement_id,
          transfer_id: params.stripe_transfer_id,
          tranche: params.tranche,
          amount_cents: params.amount_cents,
          email_status: "sent",
          resend_id: (out as any)?.id || null,
          sent_to: to,
          sent_at: new Date().toISOString(),
        },
      })
      .eq("source_key", lockKey);

    return { ok: true, to, resend_id: (out as any)?.id || null };
  } catch (e: any) {
    console.error("RESEND_SEND_FAILED", e);

    await supabase
      .from("organisateur_ledger")
      .update({
        status: "void",
        metadata: {
          paiement_id: params.paiement_id,
          transfer_id: params.stripe_transfer_id,
          tranche: params.tranche,
          amount_cents: params.amount_cents,
          email_status: "failed",
          error: String(e?.message ?? e),
        },
      })
      .eq("source_key", lockKey);

    return { ok: false, error: String(e?.message ?? e) };
  }
}

/* ------------------------------ Handler -------------------------- */
serve(async (req) => {
  const headers = cors();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const now = new Date();
    const nowIso = now.toISOString();

    // ✅ requeue des reversements bloqués en processing depuis 30min
    {
      const cutoff = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
      const { error: requeueErr } = await supabase
        .from("organisateur_reversements")
        .update({
          status: "scheduled",
          error: "processing_timeout_requeued",
          updated_at: nowIso,
        })
        .eq("status", "processing")
        .lte("updated_at", cutoff);

      if (requeueErr) console.warn("REQUEUE_PROCESSING_TIMEOUT_WARN", requeueErr);
    }

    // 1) lot de reversements dus
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
      // 2) lock scheduled -> processing
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
      if (!locked?.id) continue;

      try {
        // 3) garde-fous Stripe orga
        const { data: prof, error: pErr } = await supabase
          .from("profils_utilisateurs")
          .select("stripe_account_id, stripe_payouts_enabled")
          .eq("user_id", r.organisateur_id)
          .maybeSingle();
        if (pErr) throw pErr;

        const dest = (prof as any)?.stripe_account_id || null;
        const payoutsEnabled = !!(prof as any)?.stripe_payouts_enabled;

        if (!dest || !payoutsEnabled) {
          await markStatus(r.id, {
            status: "blocked",
            error: !dest ? "stripe_account_id manquant" : "stripe_payouts_enabled=false",
          });
          continue;
        }

        // 4) net réel via ledger
        const netTotal = await computeNetTotalForPaiement(r.paiement_id);

        if (netTotal <= 0) {
          await markStatus(r.id, {
            status: "skipped",
            amount_cents: 0,
            executed_at: new Date().toISOString(),
            error: "net_total<=0",
          });
          continue;
        }

        // ✅ Option B : déjà payé = somme(reversements paid) (inclut manuel)
        const alreadyPaid = await computeAlreadyPaidForPaiement(r.paiement_id);

        // 5) cibles
        const tranche1Target = Math.floor(netTotal * 0.5);
        const target = Number(r.tranche) === 1 ? tranche1Target : netTotal;

        // montant = cible - déjàVersé
        const amount = Math.max(0, target - alreadyPaid);

        if (amount <= 0) {
          await markStatus(r.id, {
            status: "skipped",
            amount_cents: 0,
            executed_at: new Date().toISOString(),
            error: "reste=0",
          });
          continue;
        }

        // 6) Stripe Transfer (idempotent par reversement_id)
        const tr = await stripePost(
          "/transfers",
          {
            amount: String(amount),
            currency: (r.currency || "eur").toLowerCase(),
            destination: dest,
            description: `TickRace reversement (tranche ${r.tranche})`,
            "metadata[organisateur_id]": String(r.organisateur_id),
            "metadata[course_id]": String(r.course_id),
            "metadata[paiement_id]": String(r.paiement_id),
            "metadata[tranche]": String(r.tranche),
            transfer_group: `tickrace_course_${r.course_id}`,
          },
          { idempotencyKey: `tickrace_reversement_${r.id}` },
        );

        const transferId = (tr as any)?.id as string | undefined;
        if (!transferId) throw new Error("Stripe transfer sans id");

        // 7) reversement paid
        await markStatus(r.id, {
          status: "paid",
          amount_cents: amount,
          stripe_transfer_id: transferId,
          executed_at: new Date().toISOString(),
          error: null,
        });

        // 8) ledger (idempotent via source_key unique)
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
          net_org_cents: -amount,
          currency: "eur",
          status: "confirmed",
          label: `Reversement tranche ${r.tranche}`,
          metadata: { transfer_id: transferId, paiement_id: r.paiement_id },
        });

        // 9) email (non bloquant)
        try {
          await sendPayoutEmailOnce({
            organisateur_id: r.organisateur_id,
            course_id: r.course_id ?? null,
            reversement_id: r.id,
            tranche: Number(r.tranche || 0),
            amount_cents: amount,
            stripe_transfer_id: transferId,
            paiement_id: r.paiement_id,
          });
        } catch (e: any) {
          console.error("PAYOUT_EMAIL_NON_BLOCKING_ERROR", r.id, e?.message ?? e);
        }

        processed++;
      } catch (e: any) {
        console.error("RUN_REVERSEMENTS_ONE_FAILED", r.id, e);
        await markStatus(r.id, { status: "failed", error: String(e?.message ?? e) });
      }
    }

    return json({ ok: true, processed }, 200);
  } catch (e: any) {
    console.error("RUN_REVERSEMENTS_FATAL", e);
    return json({ error: "failed", details: String(e?.message ?? e) }, 500);
  }
});

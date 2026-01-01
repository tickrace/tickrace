// supabase/functions/stripe-webhook/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

/* ------------------------------ ENV ------------------------------ */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SEND_INSCRIPTION_EMAIL_URL = Deno.env.get("SEND_INSCRIPTION_EMAIL_URL") || "";

/* --------------------------- Clients ----------------------------- */
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/* ------------------------------ CORS ----------------------------- */
function cors(h = new Headers()) {
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "content-type, stripe-signature");
  h.set("content-type", "application/json; charset=utf-8");
  return h;
}

const STRIPE_API = "https://api.stripe.com/v1";
const SYNC_STRIPE_FEES_FN = "sync-stripe-fees";

async function stripeGet(path: string) {
  const resp = await fetch(`${STRIPE_API}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const txt = await resp.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(txt);
  } catch {
    // ignore
  }

  if (!resp.ok) {
    console.error("STRIPE_GET_ERROR", path, resp.status, txt);
    throw new Error(`Stripe GET failed: ${path}`);
  }
  return parsed;
}

/* -------------------------- Email helper ------------------------- */
async function callSendInscriptionEmail(inscriptionId: string) {
  if (!SEND_INSCRIPTION_EMAIL_URL) {
    console.warn("SEND_INSCRIPTION_EMAIL_URL non défini, email non envoyé pour", inscriptionId);
    return;
  }

  const resp = await fetch(SEND_INSCRIPTION_EMAIL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ inscription_id: inscriptionId }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    console.error("SEND_INSCRIPTION_EMAIL_FAILED", inscriptionId, resp.status, txt);
  } else {
    console.log("SEND_INSCRIPTION_EMAIL_OK", inscriptionId);
  }
}

/* -------------------------- Refund handler ------------------------ */
async function processRefund(refund: any) {
  const refundId = refund?.id as string; // re_...
  const piId = (refund?.payment_intent as string | null) ?? null;
  const amount = Number(refund?.amount || 0); // cents
  const status = (refund?.status as string) || "unknown";

  console.log("PROCESS_REFUND", refundId, "pi", piId, "amount", amount, "status", status);

  // 1) retrouver paiement
  let paiement: any = null;
  if (piId) {
    const { data: pay, error: payErr } = await supabase
      .from("paiements")
      .select("*")
      .or(`stripe_payment_intent.eq.${piId},stripe_payment_intent_id.eq.${piId}`)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (payErr) console.error("REFUND_PAYMENT_LOOKUP_ERROR", payErr);
    paiement = pay || null;
  }

  // 2) MAJ paiements (refunded_total + statut)
  if (paiement) {
    const prevRefunded = Number(paiement.refunded_total_cents || 0);
    const newRefundTotal = prevRefunded + amount;

    const total = Number(paiement.total_amount_cents || 0);
    let newStatus = "rembourse";
    if (total > 0 && newRefundTotal < total) newStatus = "partiellement_rembourse";

    const { error: upPayErr } = await supabase
      .from("paiements")
      .update({
        refunded_total_cents: newRefundTotal,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paiement.id);

    if (upPayErr) console.error("REFUND_PAYMENT_UPDATE_ERROR", upPayErr);
  }

  // 3) Upsert remboursements : 1 ligne par refund re_...
  const { data: existing, error: exErr } = await supabase
    .from("remboursements")
    .select("id")
    .eq("stripe_refund_id", refundId)
    .maybeSingle();

  if (exErr) console.error("REFUND_EXISTING_LOOKUP_ERROR", exErr);

  const processedAt = status === "succeeded" ? new Date().toISOString() : null;

  if (!paiement) {
    console.warn("NO_PAIEMENT_FOR_REFUND", refundId);
    return;
  }

  // ✅ IMPORTANT (équipe) : on prend une ancre si inscription_ids vide
  const firstInsId =
    Array.isArray(paiement.inscription_ids) && paiement.inscription_ids.length ? paiement.inscription_ids[0] : null;
  const anchorInsId = (paiement.anchor_inscription_id as string | null) ?? null;
  const inscription_id = firstInsId || anchorInsId || null;

  // user_id : priorite au coureur_id de l'inscription si possible
  let user_id = paiement.user_id ?? null;
  if (inscription_id) {
    const { data: ins, error: insErr } = await supabase
      .from("inscriptions")
      .select("coureur_id")
      .eq("id", inscription_id)
      .maybeSingle();
    if (insErr) console.error("REFUND_INS_LOOKUP_ERROR", insErr);
    if (ins?.coureur_id) user_id = ins.coureur_id;
  }

  const payload = {
    paiement_id: paiement.id,
    inscription_id,
    user_id,
    policy_tier: "stripe_refund",
    percent: 100,
    amount_total_cents: paiement.total_amount_cents || amount || 0,
    base_cents: amount || 0,
    refund_cents: amount || 0,
    non_refundable_cents: 0,
    stripe_refund_id: refundId,
    status,
    processed_at: processedAt,
    reason: "Remboursement Stripe",
    effective_refund: status === "succeeded",
    requested_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error: upErr } = await supabase.from("remboursements").update(payload).eq("id", existing.id);
    if (upErr) console.error("REFUND_REMBOURSEMENT_UPDATE_ERROR", upErr);
    else console.log("REFUND_REMBOURSEMENT_UPDATE_OK", existing.id);
  } else {
    const { error: insErr } = await supabase.from("remboursements").insert(payload);
    if (insErr) console.error("REFUND_REMBOURSEMENT_INSERT_ERROR", insErr);
    else console.log("REFUND_REMBOURSEMENT_INSERT_OK", refundId);
  }
}

/* ------------------ CALL sync-stripe-fees (NO SECRET) ------------------ */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callSyncStripeFees(params: {
  stripe_payment_intent_id?: string | null;
  stripe_session_id?: string | null;
  paiement_id?: string | null;
  sync_options?: boolean;
}) {
  const url = `${SUPABASE_URL}/functions/v1/${SYNC_STRIPE_FEES_FN}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // ✅ pas de secret custom : on utilise le service role (server-to-server)
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      paiement_id: params.paiement_id ?? undefined,
      stripe_session_id: params.stripe_session_id ?? undefined,
      stripe_payment_intent_id: params.stripe_payment_intent_id ?? undefined,
      sync_options: params.sync_options ?? true,
    }),
  });

  const txt = await resp.text();
  let data: any = null;
  try {
    data = JSON.parse(txt);
  } catch {}

  if (!resp.ok) {
    console.error("CALL_SYNC_STRIPE_FEES_FAILED", resp.status, txt);
    return { ok: false, status: resp.status, data };
  }

  console.log("CALL_SYNC_STRIPE_FEES_OK", {
    paiement_id: data?.paiement_id,
    fee_total: data?.fee_total,
    synced_options: data?.synced_options_count,
  });

  return { ok: true, data };
}

/* ------------------------------ Handler -------------------------- */
serve(async (req) => {
  const headers = cors();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  console.log("STRIPE-WEBHOOK v9 (anchor_inscription_id + refunds fallback)");

  let event: any;
  try {
    event = await req.json();
  } catch (err) {
    console.error("WEBHOOK_PARSE_ERROR", err);
    return new Response(JSON.stringify({ error: "invalid_payload" }), { status: 400, headers });
  }

  try {
    console.log("WEBHOOK_EVENT_TYPE", event?.type);

    /* ====================================================================== */
    /* 1) checkout.session.completed                                          */
    /* ====================================================================== */
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const sessionId = session.id as string;

      console.log("CHECKOUT_COMPLETED_SESSION_ID", sessionId);

      const paymentIntentId =
        typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null;

      const meta = (session.metadata || {}) as Record<string, string>;
      let inscriptionIds: string[] = [];
      let groupIds: string[] = [];

      if (meta.inscription_id) {
        inscriptionIds = [meta.inscription_id];
      } else if (meta.groups) {
        groupIds = meta.groups
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);

        if (groupIds.length) {
          const inscs = await supabase.from("inscriptions").select("id").in("member_of_group_id", groupIds);

          if (!inscs.error && inscs.data) {
            inscriptionIds = inscs.data.map((r: any) => r.id);
          } else if (inscs.error) {
            console.error("INSCRIPTIONS_FROM_GROUPS_ERROR", inscs.error);
          }
        }
      }

      const montant_total_cents = session.amount_total ?? null;
      const devise = session.currency || null;

      const payRes = await supabase
        .from("paiements")
        .select("id, inscription_ids, anchor_inscription_id")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();

      if (payRes.error) console.error("PAYMENT_LOOKUP_ERROR", payRes.error);

      const existingInsIds = (payRes.data?.inscription_ids as string[] | null) || [];
      const finalInscriptionIds = inscriptionIds.length > 0 ? inscriptionIds : existingInsIds;

      // ✅ IMPORTANT (équipe) : on fixe toujours une inscription "ancre" si possible
      const anchorInscriptionId =
        (finalInscriptionIds && finalInscriptionIds.length ? finalInscriptionIds[0] : null) ||
        (payRes.data?.anchor_inscription_id as string | null) ||
        null;

      const upd = await supabase
        .from("paiements")
        .update({
          status: "paye",
          stripe_payment_intent_id: paymentIntentId,
          stripe_payment_intent: paymentIntentId,
          montant_total: montant_total_cents ? montant_total_cents / 100 : null,
          devise,
          amount_total: montant_total_cents,
          amount_subtotal: session.amount_subtotal ?? null,
          total_amount_cents: montant_total_cents,
          inscription_ids: finalInscriptionIds.length ? finalInscriptionIds : null,
          anchor_inscription_id: anchorInscriptionId,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_session_id", sessionId)
        .select("id")
        .maybeSingle();

      if (upd.error) console.error("PAYMENT_UPDATE_ERROR_CHECKOUT", upd.error);
      else console.log("PAYMENT_UPDATE_OK_CHECKOUT", upd.data?.id);

      if (finalInscriptionIds.length) {
        const u1 = await supabase.from("inscriptions").update({ statut: "paye" }).in("id", finalInscriptionIds);
        if (u1.error) console.error("INSCRIPTIONS_UPDATE_ERROR", u1.error);
        else console.log("INSCRIPTIONS_UPDATE_OK", finalInscriptionIds.length);

        // ✅ backfill prix_total_coureur si manquant
        const { data: bfCount, error: bfErr } = await supabase.rpc("backfill_prix_total_coureur", {
          ins_ids: finalInscriptionIds,
        });
        if (bfErr) console.error("BACKFILL_PRIX_TOTAL_COUREUR_ERROR", bfErr);
        else console.log("BACKFILL_PRIX_TOTAL_COUREUR_OK", bfCount);

        const u2 = await supabase
          .from("inscriptions_options")
          .update({ status: "confirmed" })
          .in("inscription_id", finalInscriptionIds);
        if (u2.error) console.error("OPTIONS_CONFIRM_ERROR", u2.error);

        const grpIdsRes = await supabase.from("inscriptions").select("member_of_group_id").in("id", finalInscriptionIds);
        const grpIdsUnique = [...new Set((grpIdsRes.data || []).map((r: any) => r.member_of_group_id).filter(Boolean))];

        if (grpIdsUnique.length) {
          const u3 = await supabase.from("inscriptions_groupes").update({ statut: "paye" }).in("id", grpIdsUnique);
          if (u3.error) console.error("GROUPS_UPDATE_ERROR", u3.error);
        }

        for (const insId of finalInscriptionIds) {
          try {
            await callSendInscriptionEmail(insId);
          } catch (err) {
            console.error("CALL_SEND_INSCRIPTION_EMAIL_ERROR", insId, err);
          }
        }
      }

      // ✅ Déclenche sync-stripe-fees (fees + options) : 2 tentatives (balance tx parfois en retard)
      if (paymentIntentId) {
        await callSyncStripeFees({
          stripe_payment_intent_id: paymentIntentId,
          stripe_session_id: sessionId,
          paiement_id: upd.data?.id ?? null,
          sync_options: true,
        });

        await sleep(1200);

        await callSyncStripeFees({
          stripe_payment_intent_id: paymentIntentId,
          stripe_session_id: sessionId,
          paiement_id: upd.data?.id ?? null,
          sync_options: true,
        });
      }
    }

    /* ====================================================================== */
    /* 2) charge.succeeded → fallback déclenchement sync-stripe-fees           */
    /* ====================================================================== */
    if (event.type === "charge.succeeded") {
      const ch = event.data.object as any;
      const paymentIntentId = typeof ch?.payment_intent === "string" ? ch.payment_intent : null;

      console.log("CHARGE_SUCCEEDED", ch?.id, "pi", paymentIntentId);

      if (paymentIntentId) {
        await callSyncStripeFees({ stripe_payment_intent_id: paymentIntentId, sync_options: true });
        await sleep(1200);
        await callSyncStripeFees({ stripe_payment_intent_id: paymentIntentId, sync_options: true });
      } else {
        console.warn("CHARGE_WITHOUT_PI", ch?.id);
      }
    }

    /* ====================================================================== */
    /* 3) Refunds                                                             */
    /* ====================================================================== */
    if (event.type === "refund.created" || event.type === "refund.updated") {
      await processRefund(event.data.object);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e: any) {
    console.error("WEBHOOK_FATAL", e);
    return new Response(JSON.stringify({ error: "webhook_failed", details: String(e?.message ?? e) }), {
      status: 500,
      headers,
    });
  }
});

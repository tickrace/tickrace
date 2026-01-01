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

/* ------------------------------ Utils ----------------------------- */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

/* -------------------------- Internal calls ------------------------ */
function getFnUrl(fnName: string) {
  return `${SUPABASE_URL}/functions/v1/${fnName}`;
}

function srHeaders() {
  // 🔥 important: gateway Supabase aime bien avoir Authorization + apikey
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    apikey: SUPABASE_SERVICE_ROLE_KEY,
  };
}

/* -------------------------- Email helper ------------------------- */
async function callSendInscriptionEmail(inscriptionId: string) {
  // Fallback: si env non défini, on call direct la function standard
  const url = SEND_INSCRIPTION_EMAIL_URL || getFnUrl("send-inscription-email");

  const resp = await fetch(url, {
    method: "POST",
    headers: srHeaders(),
    body: JSON.stringify({ inscription_id: inscriptionId }),
  });

  const txt = await resp.text().catch(() => "");
  if (!resp.ok) {
    console.error("SEND_INSCRIPTION_EMAIL_FAILED", inscriptionId, resp.status, txt);
  } else {
    console.log("SEND_INSCRIPTION_EMAIL_OK", inscriptionId);
  }
}

/* ------------------ CALL sync-stripe-fees ------------------ */
async function callSyncStripeFees(params: {
  stripe_payment_intent_id?: string | null;
  stripe_session_id?: string | null;
  paiement_id?: string | null;
  sync_options?: boolean;
}) {
  const url = getFnUrl(SYNC_STRIPE_FEES_FN);

  const resp = await fetch(url, {
    method: "POST",
    headers: srHeaders(),
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

/* ------------------------- Helpers refund ------------------------ */
async function resolveAnchorInscriptionId(args: {
  paiement: any;
  groupe_id?: string | null;
}): Promise<string | null> {
  const p = args.paiement;

  const direct =
    (p?.anchor_inscription_id as string | null) ||
    (p?.inscription_id as string | null) ||
    (Array.isArray(p?.inscription_ids) && p.inscription_ids.length ? (p.inscription_ids[0] as string) : null) ||
    null;

  if (direct) return direct;

  const gid = args.groupe_id || null;
  if (gid) {
    const { data: firstIns, error } = await supabase
      .from("inscriptions")
      .select("id")
      .or(`groupe_id.eq.${gid},member_of_group_id.eq.${gid}`)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) console.error("ANCHOR_FROM_GROUP_INS_ERROR", error);
    return (firstIns?.id as string) || null;
  }

  return null;
}

async function resolveUserIdForRefund(args: {
  paiement: any;
  inscription_id?: string | null;
  groupe_id?: string | null;
}): Promise<string | null> {
  const { paiement, inscription_id, groupe_id } = args;

  // 1) inscription.coureur_id
  if (inscription_id) {
    const { data: ins, error } = await supabase
      .from("inscriptions")
      .select("coureur_id")
      .eq("id", inscription_id)
      .maybeSingle();
    if (error) console.error("REFUND_USER_FROM_INS_ERROR", error);
    if (ins?.coureur_id) return String(ins.coureur_id);
  }

  // 2) groupe.capitaine_user_id
  if (groupe_id) {
    const { data: grp, error } = await supabase
      .from("inscriptions_groupes")
      .select("capitaine_user_id")
      .eq("id", groupe_id)
      .maybeSingle();
    if (error) console.error("REFUND_USER_FROM_GROUP_ERROR", error);
    if (grp?.capitaine_user_id) return String(grp.capitaine_user_id);
  }

  // 3) paiement.user_id
  if (paiement?.user_id) return String(paiement.user_id);

  // 4) fallback: premier membre du groupe
  if (groupe_id) {
    const { data: mem, error } = await supabase
      .from("inscriptions")
      .select("coureur_id")
      .or(`groupe_id.eq.${groupe_id},member_of_group_id.eq.${groupe_id}`)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) console.error("REFUND_USER_FROM_FIRST_MEMBER_ERROR", error);
    if (mem?.coureur_id) return String(mem.coureur_id);
  }

  return null;
}

async function resolveGroupeIdForRefund(args: { refund: any; paiement: any }): Promise<string | null> {
  const meta = (args.refund?.metadata || {}) as Record<string, string>;
  const fromMeta = meta.groupe_id ? String(meta.groupe_id) : null;
  if (fromMeta) return fromMeta;

  const { data: grp, error } = await supabase
    .from("inscriptions_groupes")
    .select("id")
    .eq("paiement_id", args.paiement.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) console.error("REFUND_GROUP_BY_PAIEMENT_ERROR", error);
  return (grp?.id as string) || null;
}

/* -------------------------- Refund handler ------------------------ */
async function processRefund(refund: any) {
  const refundId = refund?.id as string; // re_...
  const piId = (refund?.payment_intent as string | null) ?? null;
  const amount = Number(refund?.amount || 0); // cents
  const status = (refund?.status as string) || "unknown";
  const effective = status === "succeeded";

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

  if (!paiement) {
    console.warn("NO_PAIEMENT_FOR_REFUND", refundId);
    return;
  }

  // 2) MAJ paiements (refunded_total + statut)
  {
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

  // 3) groupe_id + inscription_id(anchor) + user_id
  const meta = (refund?.metadata || {}) as Record<string, string>;
  const groupe_id = await resolveGroupeIdForRefund({ refund, paiement });

  const anchorFromMeta = meta.anchor_inscription_id ? String(meta.anchor_inscription_id) : null;
  const inscription_id = anchorFromMeta || (await resolveAnchorInscriptionId({ paiement, groupe_id })) || null;

  const user_id = await resolveUserIdForRefund({ paiement, inscription_id, groupe_id });

  if (!user_id) {
    console.error("REFUND_NO_USER_ID_ABORT", {
      refundId,
      paiement_id: paiement.id,
      groupe_id,
      inscription_id,
      paiement_user_id: paiement.user_id ?? null,
    });
    return;
  }

  if (!inscription_id && !groupe_id) {
    console.error("REFUND_NO_INSCRIPTION_NOR_GROUP_ABORT", { refundId, paiement_id: paiement.id });
    return;
  }

  if (inscription_id && !paiement.anchor_inscription_id) {
    const { error } = await supabase
      .from("paiements")
      .update({ anchor_inscription_id: inscription_id })
      .eq("id", paiement.id);
    if (error) console.error("BACKFILL_PAIEMENT_ANCHOR_ERROR", error);
  }

  // 4) Upsert remboursements : 1 ligne par refund re_...
  const { data: existing, error: exErr } = await supabase
    .from("remboursements")
    .select("id, requested_at")
    .eq("stripe_refund_id", refundId)
    .maybeSingle();

  if (exErr) console.error("REFUND_EXISTING_LOOKUP_ERROR", exErr);

  const processedAt = effective ? new Date().toISOString() : null;

  const payload: any = {
    paiement_id: paiement.id,
    inscription_id: inscription_id || null,
    groupe_id: groupe_id || null,
    user_id,
    policy_tier: "stripe_refund",
    percent: 100,
    amount_total_cents: (paiement.total_amount_cents ?? amount ?? 0) || 0,
    base_cents: amount || 0,
    refund_cents: amount || 0,
    non_refundable_cents: 0,
    stripe_refund_id: refundId,
    status,
    processed_at: processedAt,
    reason: "Remboursement Stripe",
    effective_refund: effective,
    // si row existe, on garde requested_at initial
    requested_at: existing?.requested_at ?? new Date().toISOString(),
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

/* ------------------------------ Handler -------------------------- */
serve(async (req) => {
  const headers = cors();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  console.log("STRIPE-WEBHOOK v10 (fix headers apikey + upsert paiement + refunds strict) ");

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

      // 1) lookup paiement
      const payRes = await supabase
        .from("paiements")
        .select("id, inscription_ids, anchor_inscription_id")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();

      if (payRes.error) console.error("PAYMENT_LOOKUP_ERROR", payRes.error);

      const existingInsIds = (payRes.data?.inscription_ids as string[] | null) || [];
      const finalInscriptionIds = inscriptionIds.length > 0 ? inscriptionIds : existingInsIds;

      const anchor_inscription_id =
        (payRes.data?.anchor_inscription_id as string | null) || (finalInscriptionIds.length ? finalInscriptionIds[0] : null);

      // 2) update si existe, sinon insert
      let paiement_id: string | null = null;

      if (payRes.data?.id) {
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
            anchor_inscription_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payRes.data.id)
          .select("id")
          .maybeSingle();

        if (upd.error) console.error("PAYMENT_UPDATE_ERROR_CHECKOUT", upd.error);
        else {
          paiement_id = upd.data?.id ?? null;
          console.log("PAYMENT_UPDATE_OK_CHECKOUT", paiement_id);
        }
      } else {
        const ins = await supabase
          .from("paiements")
          .insert({
            stripe_session_id: sessionId,
            status: "paye",
            stripe_payment_intent_id: paymentIntentId,
            stripe_payment_intent: paymentIntentId,
            montant_total: montant_total_cents ? montant_total_cents / 100 : null,
            devise,
            amount_total: montant_total_cents,
            amount_subtotal: session.amount_subtotal ?? null,
            total_amount_cents: montant_total_cents,
            inscription_ids: finalInscriptionIds.length ? finalInscriptionIds : null,
            anchor_inscription_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .maybeSingle();

        if (ins.error) console.error("PAYMENT_INSERT_ERROR_CHECKOUT", ins.error);
        else {
          paiement_id = ins.data?.id ?? null;
          console.log("PAYMENT_INSERT_OK_CHECKOUT", paiement_id);
        }
      }

      // 3) statuts + options + emails
      if (finalInscriptionIds.length) {
        const u1 = await supabase.from("inscriptions").update({ statut: "paye" }).in("id", finalInscriptionIds);
        if (u1.error) console.error("INSCRIPTIONS_UPDATE_ERROR", u1.error);
        else console.log("INSCRIPTIONS_UPDATE_OK", finalInscriptionIds.length);

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

      // 4) sync fees + options (2 passes)
      if (paymentIntentId) {
        await callSyncStripeFees({
          stripe_payment_intent_id: paymentIntentId,
          stripe_session_id: sessionId,
          paiement_id,
          sync_options: true,
        });

        await sleep(1200);

        await callSyncStripeFees({
          stripe_payment_intent_id: paymentIntentId,
          stripe_session_id: sessionId,
          paiement_id,
          sync_options: true,
        });
      }
    }

    /* ====================================================================== */
    /* 2) charge.succeeded → fallback sync-stripe-fees                         */
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
    /* 3) Refunds                                                              */
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

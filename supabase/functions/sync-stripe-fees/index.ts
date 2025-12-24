// supabase/functions/sync-stripe-fees/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { z } from "https://esm.sh/zod@3.23.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function cors(h = new Headers()) {
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "authorization, content-type, apikey, x-client-info");
  h.set("content-type", "application/json; charset=utf-8");
  return h;
}

const STRIPE_API = "https://api.stripe.com/v1";

async function stripeGet(path: string) {
  const resp = await fetch(`${STRIPE_API}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const txt = await resp.text();
  let data: any = null;
  try {
    data = JSON.parse(txt);
  } catch {
    // ignore
  }

  if (!resp.ok) {
    console.error("STRIPE_GET_ERROR", { path, status: resp.status, txt });
    throw new Error(`Stripe GET failed: ${path}`);
  }
  return data;
}

const Body = z
  .object({
    paiement_id: z.string().uuid().optional(),
    stripe_session_id: z.string().optional(),
    stripe_payment_intent_id: z.string().optional(),
    sync_options: z.boolean().optional().default(true),
  })
  .strip();

async function isAdmin(userId: string) {
  const { data } = await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  return !!data?.user_id;
}

async function organiserOwnsPaiement(userId: string, paiement: any) {
  const insId = (paiement?.inscription_ids?.[0] as string | null) ?? null;
  if (!insId) return false;

  const { data: ins } = await supabase.from("inscriptions").select("course_id").eq("id", insId).maybeSingle();
  const courseId = ins?.course_id;
  if (!courseId) return false;

  const { data: c } = await supabase.from("courses").select("organisateur_id").eq("id", courseId).maybeSingle();
  return c?.organisateur_id === userId;
}

function ok(body: any, headers: Headers, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

serve(async (req) => {
  const headers = cors();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return ok({ error: "method_not_allowed" }, headers, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return ok({ error: "unauthorized" }, headers, 401);

    const token = authHeader.replace("Bearer ", "").trim();
    const isServiceCall = token === SUPABASE_SERVICE_ROLE_KEY;

    const body = Body.parse(await req.json().catch(() => ({})));
    if (!body.paiement_id && !body.stripe_session_id && !body.stripe_payment_intent_id) {
      return ok({ error: "missing_identifier" }, headers, 400);
    }

    // Caller (2 modes)
    let callerId: string | null = null;
    if (!isServiceCall) {
      const { data: u, error: uErr } = await supabase.auth.getUser(token);
      if (uErr || !u?.user?.id) return ok({ error: "unauthorized" }, headers, 401);
      callerId = u.user.id;
    }

    // 1) Charger paiement
    let payQuery = supabase.from("paiements").select("*").limit(1);

    if (body.paiement_id) payQuery = payQuery.eq("id", body.paiement_id);
    else if (body.stripe_session_id) payQuery = payQuery.eq("stripe_session_id", body.stripe_session_id);
    else {
      payQuery = payQuery.or(
        `stripe_payment_intent_id.eq.${body.stripe_payment_intent_id},stripe_payment_intent.eq.${body.stripe_payment_intent_id}`,
      );
    }

    const { data: paiement, error: pe } = await payQuery.maybeSingle();
    if (pe || !paiement) return ok({ error: "paiement_not_found", details: pe?.message }, headers, 404);

    // Sécurité : si appel USER, admin ou owner. Si SERVICE, autorisé (webhook/server)
    if (!isServiceCall) {
      const okAdmin = callerId ? await isAdmin(callerId) : false;
      if (!okAdmin) {
        const okOwner = callerId ? await organiserOwnsPaiement(callerId, paiement) : false;
        if (!okOwner) return ok({ error: "forbidden" }, headers, 403);
      }
    }

    const piId =
      paiement.stripe_payment_intent_id ||
      paiement.stripe_payment_intent ||
      body.stripe_payment_intent_id ||
      null;

    if (!piId) return ok({ error: "missing_payment_intent_on_paiement" }, headers, 400);

    // 2) Charger PI + latest_charge (fees)
    const pi = await stripeGet(`/payment_intents/${encodeURIComponent(piId)}?expand[]=latest_charge`);
    const ch = pi?.latest_charge || null;

    const chargeId = typeof ch?.id === "string" ? ch.id : null;
    const receiptUrl = (ch?.receipt_url as string | null) ?? null;
    const balanceTxId = typeof ch?.balance_transaction === "string" ? ch.balance_transaction : null;

    let feeTotal: number | null = null; // cents
    if (balanceTxId) {
      const bt = await stripeGet(`/balance_transactions/${encodeURIComponent(balanceTxId)}`);
      feeTotal = typeof bt?.fee === "number" ? bt.fee : null;
    }

    // 3) Retrouver session checkout pour line_items
    let sessionId: string | null = paiement.stripe_session_id || body.stripe_session_id || null;
    if (!sessionId) {
      const sessList = await stripeGet(
        `/checkout/sessions?payment_intent=${encodeURIComponent(piId)}&limit=1`,
      );
      sessionId = sessList?.data?.[0]?.id ?? null;
    }

    // 4) Sync options depuis line_items (STRICT: product.metadata.kind === "option" + option_id)
    const syncedOptions: Array<{
      option_id: string;
      option_label?: string | null;
      quantity: number;
      unit_amount: number;
      total: number;
    }> = [];

    if (body.sync_options && sessionId) {
      const li = await stripeGet(
        `/checkout/sessions/${encodeURIComponent(sessionId)}/line_items?limit=100&expand[]=data.price.product`,
      );

      const anchorInscriptionId = (paiement?.inscription_ids?.[0] as string | null) ?? null;

      if (anchorInscriptionId && Array.isArray(li?.data) && li.data.length > 0) {
        // existing inscriptions_options (1 seule fois)
        const { data: existing } = await supabase
          .from("inscriptions_options")
          .select("id, option_id")
          .eq("inscription_id", anchorInscriptionId);

        const existingMap = new Map<string, string>(); // option_id -> row id
        for (const r of existing || []) {
          if (r?.option_id && r?.id) existingMap.set(String(r.option_id).toLowerCase(), r.id);
        }

        // collect option ids depuis Stripe (strict)
        const optionIds: string[] = [];
        const extracted: Array<{ optId: string; qty: number; unit: number; total: number }> = [];

        for (const item of li.data) {
          const md = item?.price?.product?.metadata || {};
          const kind = (md?.kind || md?.KIND || "").toString().toLowerCase();
          if (kind !== "option") continue;

          const mdOpt = (md?.option_id || md?.OPTION_ID || "").toString().trim();
          const optId = /^[0-9a-f-]{36}$/i.test(mdOpt) ? mdOpt.toLowerCase() : null;
          if (!optId) continue;

          const qty = Number(item?.quantity || 0) || 0;
          if (qty <= 0) continue;

          const unit = Number(item?.price?.unit_amount ?? 0) || 0; // cents
          const total = Number(item?.amount_total ?? unit * qty) || 0;

          optionIds.push(optId);
          extracted.push({ optId, qty, unit, total });
        }

        // labels depuis DB (ne jamais dépendre de Stripe pour le libellé)
        const labelMap = new Map<string, string>();
        if (optionIds.length > 0) {
          const { data: oc, error: oce } = await supabase
            .from("options_catalogue")
            .select("id, label")
            .in("id", optionIds);

          if (oce) console.error("OPTIONS_CATALOGUE_LOOKUP_ERROR", oce);
          for (const o of oc || []) {
            if (o?.id) labelMap.set(String(o.id).toLowerCase(), String(o.label || ""));
          }
        }

        // upsert
        for (const x of extracted) {
          const rowId = existingMap.get(x.optId);

          if (rowId) {
            const { error: uo } = await supabase
              .from("inscriptions_options")
              .update({
                quantity: x.qty,
                prix_unitaire_cents: x.unit,
                status: "confirmed",
              })
              .eq("id", rowId);

            if (uo) console.error("OPTIONS_UPDATE_ERROR", { optId: x.optId, uo });
          } else {
            const { error: io } = await supabase.from("inscriptions_options").insert({
              inscription_id: anchorInscriptionId,
              option_id: x.optId,
              quantity: x.qty,
              prix_unitaire_cents: x.unit,
              status: "confirmed",
            });

            if (io) console.error("OPTIONS_INSERT_ERROR", { optId: x.optId, io });
            else existingMap.set(x.optId, "inserted");
          }

          syncedOptions.push({
            option_id: x.optId,
            option_label: labelMap.get(x.optId) ?? null,
            quantity: x.qty,
            unit_amount: x.unit,
            total: x.total,
          });
        }
      }
    }

    // 5) Update paiement (fees + receipt etc.) + pi
    const { error: ue } = await supabase
      .from("paiements")
      .update({
        stripe_payment_intent_id: piId,
        stripe_payment_intent: piId,
        charge_id: chargeId,
        stripe_charge_id: chargeId,
        receipt_url: receiptUrl,
        balance_transaction_id: balanceTxId,
        fee_total: feeTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paiement.id);

    if (ue) return ok({ error: "update_failed", details: ue.message }, headers, 500);

    return ok(
      {
        ok: true,
        service_call: isServiceCall,
        paiement_id: paiement.id,
        stripe_payment_intent_id: piId,
        stripe_session_id: sessionId,
        charge_id: chargeId,
        balance_transaction_id: balanceTxId,
        fee_total: feeTotal,
        receipt_url: receiptUrl,
        synced_options_count: syncedOptions.length,
        synced_options: syncedOptions,
      },
      headers,
      200,
    );
  } catch (e: any) {
    console.error("SYNC_STRIPE_FEES_FATAL", e);
    return ok({ error: "sync_failed", details: String(e?.message ?? e) }, cors(), 500);
  }
});

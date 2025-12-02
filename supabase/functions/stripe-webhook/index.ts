// supabase/functions/stripe-webhook/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@16.6.0?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "Tickrace <no-reply@tickrace.com>";
const TICKRACE_BASE_URL = Deno.env.get("TICKRACE_BASE_URL") || "https://www.tickrace.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });

function cors(h = new Headers()) {
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "content-type, stripe-signature");
  h.set("content-type", "application/json; charset=utf-8");
  return h;
}

async function sendResendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !to) return { ok: false, reason: "no_api_key_or_recipient" };
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
  });
  const j = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error("RESEND_ERROR", resp.status, j);
    return { ok: false, reason: j?.message || "resend_failed" };
  }
  return { ok: true };
}

serve(async (req) => {
  const headers = cors();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  const rawBody = await req.arrayBuffer();
  const sig = req.headers.get("stripe-signature") || "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("WEBHOOK_SIGNATURE_ERROR", err);
    return new Response(JSON.stringify({ error: "invalid_signature" }), { status: 400, headers });
  }

  try {
    /* ---------------------------------------------------------------------- */
    /* 1) Paiements (checkout.session.completed / payment_intent.succeeded)   */
    /* ---------------------------------------------------------------------- */
    if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
      // Normaliser: récupérer la session si on ne l'a pas directement
      let session: Stripe.Checkout.Session | null = null;

      if (event.type === "checkout.session.completed") {
        const s = event.data.object as Stripe.Checkout.Session;
        session = await stripe.checkout.sessions.retrieve(s.id, {
          expand: [
            "payment_intent.charges.data.balance_transaction",
            "customer",
            "customer_details",
          ],
        });
      } else {
        // payment_intent.succeeded → retrouver la session associée
        const pi = event.data.object as Stripe.PaymentIntent;
        const sessList = await stripe.checkout.sessions.list({ payment_intent: pi.id, limit: 1 });
        if (sessList.data?.[0]) {
          session = await stripe.checkout.sessions.retrieve(sessList.data[0].id, {
            expand: [
              "payment_intent.charges.data.balance_transaction",
              "customer",
              "customer_details",
            ],
          });
        }
      }

      if (!session) {
        console.error("NO_SESSION_RESOLVED");
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      }

      const sessionId = session.id;

      // Normalisation du PaymentIntent (string ou objet) + re-fetch si besoin
      const rawPi = session.payment_intent as string | Stripe.PaymentIntent | null;
      let paymentIntent: Stripe.PaymentIntent | null = null;

      if (typeof rawPi === "string") {
        paymentIntent = await stripe.paymentIntents.retrieve(rawPi, {
          expand: ["charges.data.balance_transaction"],
        });
      } else if (rawPi && typeof rawPi === "object") {
        paymentIntent = rawPi as Stripe.PaymentIntent;
      }

      const charge = paymentIntent?.charges?.data?.[0] as Stripe.Charge | undefined;

      // 1) Retrouver / compléter le paiement côté DB
      let payRes = await supabase
        .from("paiements")
        .select("id, inscription_ids")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();

      if (payRes.error) {
        console.error("PAYMENT_LOOKUP_ERROR", payRes.error);
      }

      const meta = (session.metadata || {}) as Record<string, string>;
      let inscriptionIds: string[] = payRes.data?.inscription_ids || [];
      let groupIds: string[] = [];

      // Fallback si pas d'inscription_ids déjà enregistrés
      if (!inscriptionIds?.length) {
        if (meta.inscription_id) {
          inscriptionIds = [meta.inscription_id];
        } else if (meta.groups) {
          groupIds = meta.groups.split(",").map((x) => x.trim()).filter(Boolean);
          if (groupIds.length) {
            const inscs = await supabase
              .from("inscriptions")
              .select("id")
              .in("member_of_group_id", groupIds);
            if (!inscs.error) inscriptionIds = (inscs.data || []).map((r: any) => r.id);
          }
        }
      }

      // ------------------- Extraction des montants / frais -------------------
      const currency =
        session.currency ||
        paymentIntent?.currency ||
        charge?.currency ||
        null;

      const amountTotalCents =
        typeof session.amount_total === "number"
          ? session.amount_total
          : (typeof paymentIntent?.amount_received === "number"
              ? paymentIntent.amount_received
              : null);

      const amountSubtotalCents =
        typeof session.amount_subtotal === "number"
          ? session.amount_subtotal
          : amountTotalCents;

      // Balance transaction (frais Stripe, net, etc.)
      const balanceTxRaw = charge?.balance_transaction as
        | string
        | Stripe.BalanceTransaction
        | undefined;

      let feeTotalCents: number | null = null;
      let balanceTransactionId: string | null = null;

      if (balanceTxRaw && typeof balanceTxRaw === "object") {
        const bt = balanceTxRaw as Stripe.BalanceTransaction;
        feeTotalCents = typeof bt.fee === "number" ? bt.fee : null;
        balanceTransactionId = bt.id;
      } else if (typeof balanceTxRaw === "string") {
        balanceTransactionId = balanceTxRaw;
        try {
          const bt = await stripe.balanceTransactions.retrieve(balanceTxRaw);
          feeTotalCents = typeof bt.fee === "number" ? bt.fee : null;
        } catch (err) {
          console.error("BALANCE_TRANSACTION_FETCH_ERROR", err);
        }
      }

      // Frais / infos plateforme (Stripe Connect éventuel)
      const piAppFeeAmount = (paymentIntent as any)?.application_fee_amount as number | undefined;
      const chAppFeeAmount = (charge as any)?.application_fee_amount as number | undefined;
      const applicationFeeAmount =
        typeof piAppFeeAmount === "number"
          ? piAppFeeAmount
          : (typeof chAppFeeAmount === "number" ? chAppFeeAmount : null);

      const destinationAccountId =
        ((paymentIntent as any)?.transfer_data?.destination as string | undefined) ||
        ((charge as any)?.destination as string | undefined) ||
        null;

      const transferId = ((charge as any)?.transfer as string | undefined) || null;

      const platformFeeAmount = applicationFeeAmount ?? null;

      const paymentIntentId = paymentIntent?.id || (typeof rawPi === "string" ? rawPi : null);
      const receiptUrl = charge?.receipt_url || null;

      // ----------------------- Update de la ligne paiement -------------------
      const upd = await supabase
        .from("paiements")
        .update({
          status: "paye",
          stripe_payment_intent: paymentIntentId,
          stripe_payment_intent_id: paymentIntentId, // compat ancien champ
          stripe_charge_id: charge?.id || null,
          inscription_ids: inscriptionIds?.length
            ? inscriptionIds
            : payRes.data?.inscription_ids || null,
          // Montants en cents
          amount_total: amountTotalCents,
          amount_subtotal: amountSubtotalCents,
          fee_total: feeTotalCents,
          total_amount_cents:
            amountTotalCents !== null && typeof amountTotalCents === "number"
              ? amountTotalCents
              : payRes.data
                ? payRes.data.inscription_ids
                : null,
          // Montants en euros & devise
          montant_total:
            amountTotalCents !== null && typeof amountTotalCents === "number"
              ? amountTotalCents / 100
              : null,
          devise: currency,
          // Connect / plateforme
          application_fee_amount: applicationFeeAmount,
          platform_fee_amount: platformFeeAmount,
          destination_account_id: destinationAccountId,
          transfer_id: transferId,
          // Balance / reçu
          balance_transaction_id: balanceTransactionId,
          receipt_url: receiptUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_session_id", sessionId)
        .select("id")
        .maybeSingle();

      if (upd.error) {
        console.error("PAYMENT_UPDATE_ERROR", upd.error);
      }

      // 2) Mettre à jour les statuts FR
      if (inscriptionIds?.length) {
        const u1 = await supabase
          .from("inscriptions")
          .update({ statut: "paye" })
          .in("id", inscriptionIds);
        if (u1.error) console.error("INSCRIPTIONS_UPDATE_ERROR", u1.error);

        // Confirmer les options rattachées à ces inscriptions
        const u2 = await supabase
          .from("inscriptions_options")
          .update({ status: "confirmed" })
          .in("inscription_id", inscriptionIds);
        if (u2.error) console.error("OPTIONS_CONFIRM_ERROR", u2.error);

        // Remonter les groupes associés
        const grpIdsRes = await supabase
          .from("inscriptions")
          .select("member_of_group_id")
          .in("id", inscriptionIds);
        const grpIds = [
          ...new Set(
            (grpIdsRes.data || [])
              .map((r: any) => r.member_of_group_id)
              .filter(Boolean),
          ),
        ];

        if (grpIds.length) {
          const u3 = await supabase
            .from("inscriptions_groupes")
            .update({ statut: "paye" })
            .in("id", grpIds);
          if (u3.error) console.error("GROUPS_UPDATE_ERROR", u3.error);
        }
      }

      // 3) Email de confirmation (payeur)
      const payerEmail =
        session.customer_details?.email ||
        session.customer_email ||
        null;

      let inscriptions = [] as Array<{
        id: string;
        nom: string | null;
        prenom: string | null;
        team_name: string | null;
      }>;

      if (inscriptionIds?.length) {
        const inscs = await supabase
          .from("inscriptions")
          .select("id, nom, prenom, team_name")
          .in("id", inscriptionIds);
        if (!inscs.error) inscriptions = inscs.data || [];
      }

      const html = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
          <h2>Confirmation d’inscription</h2>
          <p>Votre paiement a été reçu. Voici le récapitulatif&nbsp;:</p>
          <ul>
            ${inscriptions
              .map(
                (i) =>
                  `<li>${(i.prenom || "").trim()} ${(i.nom || "").trim()}${
                    i.team_name ? ` — ${i.team_name}` : ""
                  }</li>`,
              )
              .join("")}
          </ul>
          <p>Vous pouvez consulter vos inscriptions ici : <a href="${TICKRACE_BASE_URL}/mes-inscriptions">Mes inscriptions</a></p>
          <p style="color:#667085;font-size:12px">Session Stripe : ${sessionId}</p>
        </div>
      `;

      if (payerEmail) {
        const r = await sendResendEmail(
          payerEmail,
          "Tickrace – Confirmation d’inscription",
          html,
        );
        if (!r.ok) console.error("CONFIRM_EMAIL_FAIL", r);
      } else if (inscriptionIds?.length) {
        const firstEmailRes = await supabase
          .from("inscriptions")
          .select("email")
          .in("id", inscriptionIds)
          .limit(1);
        const to = firstEmailRes.data?.[0]?.email;
        if (to) {
          const r = await sendResendEmail(
            to,
            "Tickrace – Confirmation d’inscription",
            html,
          );
          if (!r.ok) console.error("CONFIRM_EMAIL_FALLBACK_FAIL", r);
        }
      }
    }

    /* ---------------------------------------------------------------------- */
    /* 2) Refunds (charge.refunded / refund.created / refund.updated)         */
    /* ---------------------------------------------------------------------- */
    if (
      event.type === "charge.refunded" ||
      event.type === "refund.created" ||
      event.type === "refund.updated"
    ) {
      const refundObj = event.data.object as Stripe.Refund;
      const refundId = refundObj.id;
      const piId = refundObj.payment_intent as string | null;
      const amount = refundObj.amount || 0;

      // Chercher le paiement via payment_intent
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

      if (paiement) {
        // Mettre à jour le total remboursé
        const newRefundTotal =
          Number(paiement.refunded_total_cents || 0) + Number(amount || 0);
        let newStatus = "rembourse";
        const total = Number(paiement.total_amount_cents || 0);
        if (total > 0 && newRefundTotal < total) {
          newStatus = "partiellement_rembourse";
        }

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

      // Mettre à jour remboursements si on a déjà une ligne
      const { data: remb, error: rembErr } = await supabase
        .from("remboursements")
        .select("*")
        .eq("stripe_refund_id", refundId)
        .maybeSingle();

      if (!rembErr && remb) {
        const { error: upRembErr } = await supabase
          .from("remboursements")
          .update({
            processed_at: new Date().toISOString(),
            status: "processed",
          })
          .eq("id", remb.id);
        if (upRembErr) console.error("REFUND_REMBOURSEMENT_UPDATE_ERROR", upRembErr);
      }

      // Si aucun remboursement trouvé mais un paiement existe, on peut (optionnel) créer une ligne "manuelle"
      if (!remb && paiement && paiement.inscription_ids?.length) {
        const inscription_id = paiement.inscription_ids[0];
        const { data: ins, error: insErr } = await supabase
          .from("inscriptions")
          .select("coureur_id")
          .eq("id", inscription_id)
          .maybeSingle();
        if (insErr) console.error("REFUND_INS_LOOKUP_ERROR", insErr);

        const user_id = ins?.coureur_id || paiement.user_id;
        if (user_id) {
          const { error: insRembErr } = await supabase
            .from("remboursements")
            .insert({
              paiement_id: paiement.id,
              inscription_id,
              user_id,
              policy_tier: "manual_stripe",
              percent: 100,
              amount_total_cents: paiement.total_amount_cents || amount || 0,
              base_cents: amount || 0,
              refund_cents: amount || 0,
              non_refundable_cents: 0,
              stripe_refund_id: refundId,
              status: "processed",
              reason: "Remboursement manuel Stripe",
            });
          if (insRembErr) console.error("REFUND_INSERT_MANUAL_ERROR", insRembErr);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e) {
    console.error("WEBHOOK_FATAL", e);
    return new Response(
      JSON.stringify({
        error: "webhook_failed",
        details: String((e as any)?.message ?? e),
      }),
      {
        status: 500,
        headers,
      },
    );
  }
});

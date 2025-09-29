// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0&pin=v135";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0&pin=v135";
import { Resend } from "https://esm.sh/resend@3.2.0?target=deno&deno-std=0.192.0&pin=v135";

console.log("BUILD stripe-webhook 2025-09-29 (confirm options for group & individual)");

/* ----------------------------- Config & clients ---------------------------- */
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const TICKRACE_BASE_URL = Deno.env.get("TICKRACE_BASE_URL") || "https://www.tickrace.com";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || null;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const ALLOWLIST = [
  "https://www.tickrace.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

/* --------------------------------- Helpers -------------------------------- */
function cors(req: Request) {
  const origin = req.headers.get("origin");
  const allowOrigin = origin && ALLOWLIST.includes(origin) ? origin : ALLOWLIST[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature, prefer",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}

const isUUID = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v as string);

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ------------------------------ Main handler ------------------------------ */
serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers });
  }

  // Vérification de la signature Stripe
  let event: Stripe.Event;
  try {
    const sig = req.headers.get("stripe-signature") ?? "";
    const raw = await req.text();
    event = await stripe.webhooks.constructEventAsync(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch (e: any) {
    console.error("❌ Bad signature:", e?.message ?? e);
    return new Response(JSON.stringify({ error: "Bad signature" }), { status: 400, headers });
  }

  try {
    // On ne traite que les événements qui marquent un succès
    if (!["checkout.session.completed", "payment_intent.succeeded", "charge.succeeded"].includes(event.type)) {
      return new Response(JSON.stringify({ ok: true, ignored: event.type }), { status: 200, headers });
    }

    // Récupération des objets et metadata
    let session: Stripe.Checkout.Session | null = null;
    let pi: Stripe.PaymentIntent | null = null;
    let chargeId: string | null = null;
    let md: Record<string, string> = {};

    if (event.type === "checkout.session.completed") {
      session = event.data.object as Stripe.Checkout.Session;
      md = { ...(session.metadata || {}) };
    } else if (event.type === "payment_intent.succeeded") {
      pi = event.data.object as Stripe.PaymentIntent;
      md = { ...(pi.metadata || {}) };
    } else if (event.type === "charge.succeeded") {
      const ch = event.data.object as Stripe.Charge;
      chargeId = ch.id;
    }

    // Retrouver le PaymentIntent si besoin
    if (!pi) {
      const piId =
        (session?.payment_intent as string) ||
        (chargeId ? (event.data.object as any).payment_intent : undefined);
      if (piId) {
        pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge.balance_transaction"] });
      }
    }
    if (!pi) {
      return new Response(JSON.stringify({ error: "PaymentIntent introuvable" }), { status: 404, headers });
    }

    // Compléter chargeId
    if (!chargeId) {
      if (typeof pi.latest_charge === "string") chargeId = pi.latest_charge;
      else chargeId = (pi.latest_charge as any)?.id ?? null;
    }

    // Metadata consolidée (session + PI)
    md = { ...(md || {}), ...(pi.metadata || {}) };

    const inscription_id = md["inscription_id"];              // individuel
    const course_id = md["course_id"];
    const user_id = md["user_id"];
    const trace_id = md["trace_id"];
    const mode = md["mode"] || "individuel";                  // 'individuel' | 'groupe' | 'relais'
    const group_ids_csv = md["group_ids"] || "";              // groupe/relais
    const inscription_ids_csv = md["inscription_ids"] || "";  // groupe/relais

    // Garde-fous
    if (!isUUID(course_id) || !isUUID(user_id) || !isUUID(trace_id)) {
      return new Response(JSON.stringify({ error: "metadata invalide (course/user/trace)" }), { status: 400, headers });
    }
    if (mode === "individuel" && !isUUID(inscription_id)) {
      return new Response(JSON.stringify({ error: "metadata invalide (inscription_id)" }), { status: 400, headers });
    }

    // Montant total
    const amountTotalCents = (session?.amount_total ?? (pi.amount ?? 0)) ?? 0;

    // Frais Stripe & receipt
    let stripeFeeCents = 0, balanceTxId: string | null = null, receiptUrl: string | null = null;
    if (chargeId) {
      const charge: any = await stripe.charges.retrieve(chargeId, { expand: ["balance_transaction"] });
      receiptUrl = charge?.receipt_url ?? null;
      const bt = charge?.balance_transaction;
      if (bt && typeof bt === "object" && "fee" in bt) {
        stripeFeeCents = bt.fee ?? 0;
        balanceTxId = bt.id ?? null;
      } else if (typeof bt === "string") {
        const bt2 = await stripe.balanceTransactions.retrieve(bt);
        stripeFeeCents = bt2?.fee ?? 0;
        balanceTxId = bt2?.id ?? null;
      }
    }

    // Organisateur -> compte connecté
    const { data: course } = await supabase
      .from("courses")
      .select("organisateur_id")
      .eq("id", course_id)
      .single();

    const { data: profil } = await supabase
      .from("profils_utilisateurs")
      .select("stripe_account_id")
      .eq("user_id", course?.organisateur_id)
      .maybeSingle();

    const destinationAccount = profil?.stripe_account_id ?? null;

    // Commission plateforme (5% par défaut)
    const platformFeeCents = Math.round(amountTotalCents * 0.05);

    // Construire / upsert paiement
    const inscIdsArr = mode === "individuel"
      ? [inscription_id]
      : (inscription_ids_csv ? inscription_ids_csv.split(",").filter((x) => isUUID(x)) : []);

    const paiementRow: any = {
      inscription_id: mode === "individuel" ? inscription_id : null,
      montant_total: amountTotalCents / 100,
      devise: pi.currency ?? "eur",
      stripe_payment_intent_id: String(pi.id),
      status: pi.status ?? "succeeded",
      reversement_effectue: false,
      user_id,
      type: mode,
      inscription_ids: inscIdsArr,
      trace_id,
      receipt_url: receiptUrl,
      charge_id: chargeId,
      destination_account_id: destinationAccount,
      amount_subtotal: amountTotalCents,
      amount_total: amountTotalCents,
      fee_total: stripeFeeCents,
      platform_fee_amount: platformFeeCents,
      balance_transaction_id: balanceTxId,
    };

    const { data: preByPI } = await supabase
      .from("paiements")
      .select("id")
      .eq("stripe_payment_intent_id", paiementRow.stripe_payment_intent_id)
      .maybeSingle();

    let paiementId: string | null = null;

    if (preByPI?.id) {
      await supabase.from("paiements").update(paiementRow).eq("id", preByPI.id);
      paiementId = preByPI.id;
    } else {
      const { data: preByTrace } = await supabase
        .from("paiements")
        .select("id")
        .eq("trace_id", trace_id)
        .maybeSingle();
      if (preByTrace?.id) {
        await supabase.from("paiements").update(paiementRow).eq("id", preByTrace.id);
        paiementId = preByTrace.id;
      } else {
        const { data: inserted } = await supabase
          .from("paiements")
          .insert(paiementRow)
          .select("id")
          .single();
        paiementId = inserted?.id ?? null;
      }
    }

    /* --------------------------- Validation business --------------------------- */

    if (mode === "individuel") {
      // 1) Valider l'inscription
      await supabase
        .from("inscriptions")
        .update({ statut: "validé" })
        .eq("id", inscription_id);

      // 2) Confirmer les OPTIONS liées à cette inscription
      await supabase
        .from("inscriptions_options")
        .update({ status: "confirmed" })
        .eq("inscription_id", inscription_id)
        .eq("status", "pending");

      // 3) Email payeur (si renseigné)
      try {
        if (resend) {
          const { data: insc } = await supabase
            .from("inscriptions")
            .select("id, email, nom, prenom")
            .eq("id", inscription_id)
            .maybeSingle();

          if (insc?.email) {
            await resend.emails.send({
              from: "Tickrace <no-reply@tickrace.com>",
              to: insc.email,
              subject: "Confirmation d’inscription",
              html: `
                <div style="font-family:Arial,sans-serif;">
                  <h2>Votre inscription est confirmée ✅</h2>
                  <p>Bonjour ${escapeHtml(insc.prenom ?? "")} ${escapeHtml(insc.nom ?? "")},</p>
                  <p>Votre numéro d’inscription : <strong>${escapeHtml(insc.id)}</strong></p>
                  <p><a href="${escapeHtml(TICKRACE_BASE_URL)}/mon-inscription/${escapeHtml(insc.id)}">
                    Consulter mon inscription
                  </a></p>
                </div>
              `,
            });
          }
        }
      } catch (e) {
        console.error("Resend individuel error:", e);
      }
    } else {
      // GROUPE / RELAIS
      const groupIds = group_ids_csv ? group_ids_csv.split(",").filter((x) => isUUID(x)) : [];
      const inscIds = inscIdsArr;

      // 1) Valider groupes + inscriptions
      if (groupIds.length > 0) {
        await supabase
          .from("inscriptions_groupes")
          .update({ statut: "paye" })
          .in("id", groupIds);
      }
      if (inscIds.length > 0) {
        await supabase
          .from("inscriptions")
          .update({ statut: "validé" })
          .in("id", inscIds);
      }

      // 2) Lier le paiement aux groupes (sans écraser si déjà présent)
      if (paiementId && groupIds.length > 0) {
        await supabase
          .from("inscriptions_groupes")
          .update({ paiement_id: paiementId })
          .in("id", groupIds)
          .is("paiement_id", null);
      }

      // 3) Confirmer les OPTIONS pour toutes les inscriptions du lot
      if (inscIds.length > 0) {
        await supabase
          .from("inscriptions_options")
          .update({ status: "confirmed" })
          .in("inscription_id", inscIds)
          .eq("status", "pending");
      }

      // 4) Email à chaque membre qui a un email
      try {
        if (resend && inscIds.length > 0) {
          const { data: members } = await supabase
            .from("inscriptions")
            .select("id, email, nom, prenom")
            .in("id", inscIds);

          if (Array.isArray(members)) {
            for (const m of members) {
              if (m?.email) {
                try {
                  await resend.emails.send({
                    from: "Tickrace <no-reply@tickrace.com>",
                    to: m.email,
                    subject: "Confirmation d’inscription (équipe)",
                    html: `
                      <div style="font-family:Arial,sans-serif;">
                        <h2>Votre inscription est confirmée ✅</h2>
                        <p>Bonjour ${escapeHtml(m.prenom ?? "")} ${escapeHtml(m.nom ?? "")},</p>
                        <p>Votre numéro d’inscription : <strong>${escapeHtml(m.id)}</strong></p>
                        <p><a href="${escapeHtml(TICKRACE_BASE_URL)}/mon-inscription/${escapeHtml(m.id)}">
                          Consulter mon inscription
                        </a></p>
                      </div>
                    `,
                  });
                } catch (e) {
                  console.error("Resend member email error:", e);
                }
              }
            }
          }
        }
      } catch (e) {
        console.error("Resend batch error:", e);
      }
    }

    /* --------------------------- Reversement J+1 --------------------------- */
    const netToTransfer = Math.max(0, amountTotalCents - platformFeeCents - stripeFeeCents);
    if (paiementId && destinationAccount && netToTransfer > 0) {
      const { data: existsQ } = await supabase
        .from("payout_queue")
        .select("id")
        .eq("paiement_id", paiementId)
        .eq("status", "pending")
        .maybeSingle();

      if (!existsQ) {
        await supabase.from("payout_queue").insert({
          paiement_id: paiementId,
          due_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          amount_cents: netToTransfer,
          status: "pending",
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e: any) {
    console.error("stripe-webhook error:", e?.message ?? e, e?.stack);
    const debug = Deno.env.get("DEBUG") === "1";
    return new Response(
      JSON.stringify({ error: debug ? (e?.message ?? "Erreur serveur") : "Erreur serveur" }),
      { status: 500, headers },
    );
  }
});

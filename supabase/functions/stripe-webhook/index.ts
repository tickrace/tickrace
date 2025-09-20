// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0&pin=v135";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0&pin=v135";
import { Resend } from "https://esm.sh/resend@3.2.0?target=deno&deno-std=0.192.0&pin=v135";

console.log("BUILD stripe-webhook 2025-09-20T19:45Z");



const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const TICKRACE_BASE_URL = Deno.env.get("TICKRACE_BASE_URL") || "https://www.tickrace.com";
const resendApiKey = Deno.env.get("RESEND_API_KEY") || null;

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const ALLOWLIST = ["https://www.tickrace.com","http://localhost:5173","http://127.0.0.1:5173"];
const cors = (o: string | null) => ({
  "Access-Control-Allow-Origin": (o && ALLOWLIST.includes(o)) ? o : ALLOWLIST[0],
  "Vary": "Origin",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature, prefer",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
});
const isUUID = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v as string);

serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers });

  // ✅ Signature (ASYNC)
  let event: Stripe.Event;
  try {
    const sig = req.headers.get("stripe-signature") ?? "";
    const raw = await req.text(); // ne PAS relire le body ensuite
    event = await stripe.webhooks.constructEventAsync(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch (e: any) {
    console.error("❌ Bad signature (async):", e?.message ?? e);
    return new Response(JSON.stringify({ error: "Bad signature" }), { status: 400, headers });
  }

  try {
    if (!["checkout.session.completed", "payment_intent.succeeded", "charge.succeeded"].includes(event.type)) {
      return new Response(JSON.stringify({ ok: true, ignored: event.type }), { status: 200, headers });
    }

    // Récup objects + metadata
    let session: Stripe.Checkout.Session | null = null;
    let pi: Stripe.PaymentIntent | null = null;
    let chargeId: string | null = null;
    let md: Record<string,string> = {};

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

    // Retrouver PI si besoin
    if (!pi) {
      const piId = (session?.payment_intent as string) || (chargeId ? (event.data.object as any).payment_intent : undefined);
      if (piId) pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge.balance_transaction"] });
    }
    if (!pi) return new Response(JSON.stringify({ error: "PaymentIntent introuvable" }), { status: 404, headers });

    // Finaliser chargeId
    if (!chargeId) {
      if (typeof pi.latest_charge === "string") chargeId = pi.latest_charge;
      else chargeId = (pi.latest_charge as any)?.id ?? null;
    }

    // Metadata consolidée
    md = { ...(md || {}), ...(pi.metadata || {}) };
    const inscription_id = md["inscription_id"]; // présent en individuel
    const course_id = md["course_id"];
    const user_id = md["user_id"];
    const trace_id = md["trace_id"];
    const mode = md["mode"] || "individuel"; // 'individuel' | 'groupe' | 'relais'
    const group_ids_csv = md["group_ids"] || "";
    const inscription_ids_csv = md["inscription_ids"] || "";

    if (!isUUID(course_id) || !isUUID(user_id) || !isUUID(trace_id)) {
      return new Response(JSON.stringify({ error: "metadata invalide (course/user/trace)" }), { status: 400, headers });
    }
    if (mode === "individuel" && !isUUID(inscription_id)) {
      return new Response(JSON.stringify({ error: "metadata invalide (inscription_id)" }), { status: 400, headers });
    }

    // Montants
    const amountTotalCents = (session?.amount_total ?? (pi.amount ?? 0)) ?? 0;

    // Frais Stripe (plateforme, SCT)
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
    const { data: course } = await supabase.from("courses").select("organisateur_id").eq("id", course_id).single();
    const { data: profil } = await supabase.from("profils_utilisateurs").select("stripe_account_id").eq("user_id", course.organisateur_id).maybeSingle();
    const destinationAccount = profil?.stripe_account_id ?? null;

    // Commission plateforme
    const platformFeeCents = Math.round(amountTotalCents * 0.05);

    // Upsert paiements
    const row: any = {
      inscription_id: mode === "individuel" ? inscription_id : null,
      montant_total: amountTotalCents / 100,
      devise: pi.currency ?? "eur",
      stripe_payment_intent_id: String(pi.id),
      status: pi.status ?? "succeeded",
      reversement_effectue: false,
      user_id,
      type: mode,
      inscription_ids: mode === "individuel"
        ? [inscription_id]
        : (inscription_ids_csv ? inscription_ids_csv.split(",") : []),
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

    const { data: preByPI } = await supabase.from("paiements").select("id").eq("stripe_payment_intent_id", row.stripe_payment_intent_id).maybeSingle();
    if (preByPI?.id) await supabase.from("paiements").update(row).eq("id", preByPI.id);
    else {
      const { data: preByTrace } = await supabase.from("paiements").select("id").eq("trace_id", trace_id).maybeSingle();
      if (preByTrace?.id) await supabase.from("paiements").update(row).eq("id", preByTrace.id);
      else await supabase.from("paiements").insert(row);
    }

    // Valider inscriptions / groupes
    if (mode === "individuel") {
      await supabase.from("inscriptions").update({ statut: "validé" }).eq("id", inscription_id);
    } else {
      const groupIds = group_ids_csv ? group_ids_csv.split(",").filter((x) => isUUID(x)) : [];
      const inscIds = inscription_ids_csv ? inscription_ids_csv.split(",").filter((x) => isUUID(x)) : [];
      if (groupIds.length > 0) {
        await supabase.from("inscriptions_groupes").update({ statut: "paye" }).in("id", groupIds);
      }
      if (inscIds.length > 0) {
        await supabase.from("inscriptions").update({ statut: "validé" }).in("id", inscIds);
      }

      // ► Email individuel à chaque membre (si email présent)
      try {
        if (resend && inscIds.length > 0) {
          const { data: members } = await supabase
            .from("inscriptions")
            .select("id, email, nom, prenom")
            .in("id", inscIds);
          if (members && Array.isArray(members)) {
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
                        <p>Bonjour ${m.prenom ?? ""} ${m.nom ?? ""},</p>
                        <p>Votre numéro d’inscription : <strong>${m.id}</strong></p>
                        <p><a href="${TICKRACE_BASE_URL}/mon-inscription/${m.id}">
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

    // Enqueue reversement J+1
    const netToTransfer = Math.max(0, amountTotalCents - platformFeeCents - stripeFeeCents);
    const { data: payRow } = await supabase.from("paiements").select("id").eq("stripe_payment_intent_id", String(pi.id)).maybeSingle();
    if (payRow?.id && destinationAccount && netToTransfer > 0) {
      const { data: existsQ } = await supabase.from("payout_queue").select("id").eq("paiement_id", payRow.id).eq("status","pending").maybeSingle();
      if (!existsQ) {
        await supabase.from("payout_queue").insert({
          paiement_id: payRow.id,
          due_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          amount_cents: netToTransfer,
          status: "pending",
        });
      }
    }

    // Email payeur (individuel)
    try {
      if (resend && mode === "individuel") {
        const { data: insc } = await supabase.from("inscriptions").select("id, email, nom, prenom").eq("id", inscription_id).maybeSingle();
        if (insc?.email) {
          await resend.emails.send({
            from: "Tickrace <no-reply@tickrace.com>",
            to: insc.email,
            subject: "Confirmation d’inscription",
            html: `
              <div style="font-family:Arial,sans-serif;">
                <h2>Votre inscription est confirmée ✅</h2>
                <p>Bonjour ${insc.prenom ?? ""} ${insc.nom ?? ""},</p>
                <p>Votre numéro d’inscription : <strong>${insc.id}</strong></p>
                <p><a href="${TICKRACE_BASE_URL}/mon-inscription/${insc.id}">${TICKRACE_BASE_URL}/mon-inscription/${insc.id}</a></p>
              </div>
            `,
          });
        }
      }
    } catch (e) { console.error("Resend payer email error:", e); }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e: any) {
    console.error("stripe-webhook (SCT) error:", e?.message ?? e, e?.stack);
    const debug = Deno.env.get("DEBUG") === "1";
    return new Response(
      JSON.stringify({ error: debug ? (e?.message ?? "Erreur serveur") : "Erreur serveur" }),
      { status: 500, headers }
    );
  }
});

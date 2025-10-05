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
    if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
      // Normaliser: récupérer la session si on ne l'a pas directement
      let session: Stripe.Checkout.Session | null = null;

      if (event.type === "checkout.session.completed") {
        const s = event.data.object as Stripe.Checkout.Session;
        session = await stripe.checkout.sessions.retrieve(s.id, {
          expand: ["payment_intent.charges", "customer", "customer_details"],
        });
      } else {
        // payment_intent.succeeded → retrouver la session associée (parmi les dernières sessions du PI)
        const pi = event.data.object as Stripe.PaymentIntent;
        const sessList = await stripe.checkout.sessions.list({ payment_intent: pi.id, limit: 1 });
        if (sessList.data?.[0]) {
          session = await stripe.checkout.sessions.retrieve(sessList.data[0].id, {
            expand: ["payment_intent.charges", "customer", "customer_details"],
          });
        }
      }

      if (!session) {
        console.error("NO_SESSION_RESOLVED");
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      }

      const sessionId = session.id;
      const paymentIntent = session.payment_intent as Stripe.PaymentIntent | null;
      const charge = (paymentIntent?.charges?.data?.[0] as Stripe.Charge | undefined) || undefined;

      // 1) Retrouver / compléter le paiement côté DB
      let payRes = await supabase
        .from("paiements")
        .select("id, inscription_ids")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();

      if (payRes.error) {
        console.error("PAYMENT_LOOKUP_ERROR", payRes.error);
      }

      // Fallback si pas trouvé (peu probable) → essayer metadata
      const meta = (session.metadata || {}) as Record<string, string>;
      let inscriptionIds: string[] = payRes.data?.inscription_ids || [];
      let groupIds: string[] = [];
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

      // Upsert payment info
      const upd = await supabase
        .from("paiements")
        .update({
          status: "paye",
          stripe_payment_intent: paymentIntent?.id || null,
          stripe_charge_id: charge?.id || null,
          inscription_ids: inscriptionIds?.length ? inscriptionIds : payRes.data?.inscription_ids || null,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_session_id", sessionId)
        .select("id")
        .maybeSingle();

      if (upd.error) console.error("PAYMENT_UPDATE_ERROR", upd.error);

      // 2) Mettre à jour les statuts FR
      if (inscriptionIds?.length) {
        const u1 = await supabase
          .from("inscriptions")
          .update({ statut: "paye" }) // schéma FR
          .in("id", inscriptionIds);
        if (u1.error) console.error("INSCRIPTIONS_UPDATE_ERROR", u1.error);

        // Confirmer les options rattachées à ces inscriptions (une seule dans le modèle "ancre", mais safe si plusieurs)
        const u2 = await supabase
          .from("inscriptions_options")
          .update({ status: "confirmed" })
          .in("inscription_id", inscriptionIds);
        if (u2.error) console.error("OPTIONS_CONFIRM_ERROR", u2.error);

        // Remonter les groupes à partir des inscriptions
        const grpIdsRes = await supabase
          .from("inscriptions")
          .select("member_of_group_id")
          .in("id", inscriptionIds);
        const grpIds = [...new Set((grpIdsRes.data || []).map((r: any) => r.member_of_group_id).filter(Boolean))];

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

      // Compose un petit récap
      let inscriptions = [] as Array<{ id: string; nom: string | null; prenom: string | null; team_name: string | null }>;
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
            ${inscriptions.map(i => `<li>${(i.prenom||"").trim()} ${(i.nom||"").trim()} ${i.team_name ? `— ${i.team_name}` : ""}</li>`).join("")}
          </ul>
          <p>Vous pouvez consulter vos inscriptions ici : <a href="${TICKRACE_BASE_URL}/mes-inscriptions">Mes inscriptions</a></p>
          <p style="color:#667085;font-size:12px">Session Stripe : ${sessionId}</p>
        </div>
      `;

      if (payerEmail) {
        const r = await sendResendEmail(payerEmail, "Tickrace – Confirmation d’inscription", html);
        if (!r.ok) console.error("CONFIRM_EMAIL_FAIL", r);
      } else {
        // fallback : tenter le premier email d'inscription s'il existe
        const firstEmailRes = await supabase
          .from("inscriptions")
          .select("email")
          .in("id", inscriptionIds || [])
          .limit(1);
        const to = firstEmailRes.data?.[0]?.email;
        if (to) {
          const r = await sendResendEmail(to, "Tickrace – Confirmation d’inscription", html);
          if (!r.ok) console.error("CONFIRM_EMAIL_FALLBACK_FAIL", r);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e) {
    console.error("WEBHOOK_FATAL", e);
    return new Response(JSON.stringify({ error: "webhook_failed", details: String(e?.message ?? e) }), {
      status: 500,
      headers,
    });
  }
});

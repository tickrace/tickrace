// supabase/functions/stripe-webhook/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@16.6.0?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const BASE_URL = Deno.env.get("TICKRACE_BASE_URL") || "https://www.tickrace.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });

async function sendMail(to: string, subject: string, html: string) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Tickrace <noreply@tickrace.com>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!resp.ok) {
    console.error("Resend error:", await resp.text());
  }
}

serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed.", err);
    return new Response("invalid signature", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const sessionId = session.id;
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

      // Récupération du paiement attaché
      const { data: payRow } = await supabase
        .from("paiements")
        .select("id, inscription_ids")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();

      if (!payRow) {
        console.warn("paiement non trouvé pour session:", sessionId);
      } else {
        await supabase
          .from("paiements")
          .update({
            status: "paid",
            stripe_payment_intent: paymentIntentId ?? null,
          })
          .eq("id", payRow.id);

        const ids = payRow.inscription_ids ?? [];
        if (ids.length > 0) {
          // Confirmer inscriptions
          await supabase.from("inscriptions").update({ statut: "confirmed" }).in("id", ids);

          // Confirmer options attachées à ces inscriptions
          await supabase.from("inscriptions_options").update({ status: "confirmed" }).in("inscription_id", ids);

          // Confirmer groupe(s) éventuel(s)
          const { data: groups } = await supabase
            .from("inscriptions")
            .select("member_of_group_id")
            .in("id", ids)
            .not("member_of_group_id", "is", null);

          const groupIds = Array.from(
            new Set((groups ?? []).map((g: any) => g.member_of_group_id).filter(Boolean))
          );
          if (groupIds.length > 0) {
            await supabase.from("inscriptions_groupes").update({ statut: "confirmed" }).in("id", groupIds);
          }

          // Emails de confirmation
          const { data: inscs } = await supabase
            .from("inscriptions")
            .select("id, prenom, nom, email")
            .in("id", ids);

          for (const i of inscs ?? []) {
            const url = `${BASE_URL}/mon-inscription/${i.id}`;
            await sendMail(
              i.email,
              "Confirmation d’inscription — Tickrace",
              `<p>Bonjour ${i.prenom ?? ""} ${i.nom ?? ""},</p>
               <p>Votre inscription est <b>confirmée</b>.</p>
               <p>Consultez votre fiche : <a href="${url}">${url}</a></p>
               <p>À très bientôt sur la ligne de départ !</p>`
            );
          }
        }
      }
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("webhook error:", e);
    return new Response("error", { status: 500 });
  }
});

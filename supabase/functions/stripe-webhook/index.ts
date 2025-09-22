// supabase/functions/stripe-webhook/index.ts
// Webhook Stripe pour marquer payé, valider les options, etc.

import Stripe from "https://esm.sh/stripe@12?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";

Deno.serve(async (req) => {
  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
  const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as any });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const raw = await req.text();
    const sig = req.headers.get("stripe-signature") ?? "";
    const event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const metadata = session.metadata || {};
      const mode = (metadata.mode as "individuel" | "groupe" | "relais" | undefined) ?? "individuel";

      // ————————————————— INDIVIDUEL —————————————————
      if (mode === "individuel") {
        const inscription_id = metadata.inscription_id;
        if (inscription_id) {
          // 1) Marquer l’inscription comme payée
          const { error: upErr } = await supabase
            .from("inscriptions")
            .update({
              statut: "payé",
              paiement_stripe_session_id: session.id,
              paiement_stripe_payment_intent: session.payment_intent ?? null,
              paiement_effectue_le: new Date().toISOString(),
            })
            .eq("id", inscription_id);

          if (upErr) console.error("update inscription fail:", upErr);

          // 2) Valider les options (pending -> paid)
          const { error: optErr } = await supabase
            .from("inscriptions_options")
            .update({ status: "paid" })
            .eq("inscription_id", inscription_id)
            .eq("status", "pending");

          if (optErr) console.error("update options fail:", optErr);
        } else {
          console.warn("session completed sans inscription_id (individuel)");
        }
      }

      // ————————————————— GROUPE / RELAIS —————————————————
      if (mode === "groupe" || mode === "relais") {
        // Dans ta page actuelle, tu n’insères pas encore en avance des enregistrements
        // → on log le payload pour traitement back-office (ou on peut créer un “order” ici).
        const course_id = metadata.course_id || null;
        const format_id = metadata.format_id || null;
        const teams_json = metadata.teams_json || "[]";
        const options_total_eur = metadata.options_total_eur || "0";

        // Exemple: insérer un enregistrement “orders” si tu as une table dédiée
        // (Si tu n’as pas encore cette table, ignore ce bloc.)
        /*
        await supabase.from("group_orders").insert([{
          course_id,
          format_id,
          mode,
          teams_json,
          options_total_eur,
          stripe_session_id: session.id,
          payment_intent: session.payment_intent ?? null,
          status: "paid",
          created_at: new Date().toISOString(),
        }]);
        */

        console.log("GROUPE/RELAIS payé:", {
          course_id,
          format_id,
          mode,
          teams: teams_json,
          options_total_eur,
          stripe_session_id: session.id,
        });
      }
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("stripe webhook error:", e);
    return new Response("bad request", { status: 400 });
  }
});

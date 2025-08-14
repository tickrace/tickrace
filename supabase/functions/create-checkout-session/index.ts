// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

// ====== ENV ======
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TICKRACE_BASE_URL = Deno.env.get("TICKRACE_BASE_URL")!; // ex: https://www.tickrace.com

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ====== CORS ======
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const inscription_id: string = body?.inscription_id;

    if (!inscription_id) {
      return new Response(JSON.stringify({ error: "inscription_id manquant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Récupère l’inscription
    const { data: insc, error: errInsc } = await supabase
      .from("inscriptions")
      .select("id, email, nom, prenom, prix_total_repas, format_id, course_id")
      .eq("id", inscription_id)
      .single();

    if (errInsc || !insc) {
      return new Response(JSON.stringify({ error: "Inscription introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Format
    const { data: fmt, error: errFmt } = await supabase
      .from("formats")
      .select("id, nom, prix")
      .eq("id", insc.format_id)
      .single();

    if (errFmt || !fmt) {
      return new Response(JSON.stringify({ error: "Format introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Course + organisateur
    const { data: course, error: errCourse } = await supabase
      .from("courses")
      .select("id, nom, organisateur_id")
      .eq("id", insc.course_id)
      .single();

    if (errCourse || !course) {
      return new Response(JSON.stringify({ error: "Course introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: org, error: errOrg } = await supabase
      .from("profils_utilisateurs")
      .select("stripe_account_id")
      .eq("user_id", course.organisateur_id)
      .maybeSingle();

    const destinationAccount = org?.stripe_account_id ?? null;

    // 4) Montants
    const prixInscription = Number(fmt.prix || 0);
    const prixRepas = Number(insc.prix_total_repas || 0);
    const total = prixInscription + prixRepas;
    const totalCents = Math.round(total * 100);
    const appFeeCents = Math.round(totalCents * 0.05); // 5 %

    // 5) Line items
    const line_items: any[] = [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `${course.nom} — ${fmt.nom}`,
          },
          unit_amount: Math.round(prixInscription * 100),
        },
        quantity: 1,
      },
    ];
    if (prixRepas > 0) {
      line_items.push({
        price_data: {
          currency: "eur",
          product_data: { name: "Option repas" },
          unit_amount: Math.round(prixRepas * 100),
        },
        quantity: 1,
      });
    }

    // 6) Checkout Session
    const sessionParams: any = {
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
      success_url: `${TICKRACE_BASE_URL}/merci?inscription=${inscription_id}`,
      cancel_url: `${TICKRACE_BASE_URL}/inscription-annulee?inscription=${inscription_id}`,
      customer_email: insc.email ?? undefined,
      metadata: {
        type: "inscription",
        inscription_id,
        format_id: String(insc.format_id),
        course_id: String(insc.course_id),
        organiser_id: String(course.organisateur_id),
      },
      payment_intent_data: {
        metadata: {
          type: "inscription",
          inscription_id,
          format_id: String(insc.format_id),
          course_id: String(insc.course_id),
          organiser_id: String(course.organisateur_id),
        },
      },
    };

    // Destination charges si le compte connecté existe
    if (destinationAccount) {
      sessionParams.payment_intent_data.transfer_data = {
        destination: destinationAccount,
      };
      sessionParams.payment_intent_data.application_fee_amount = appFeeCents;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Erreur interne" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TICKRACE_BASE_URL = Deno.env.get("TICKRACE_BASE_URL") || "https://www.tickrace.com";

// ⚠️ Si ta colonne de lien dans `inscriptions` n'est pas `groupe_id`,
// change ici pour "group_id" / "inscriptions_groupe_id" selon ton schéma réel.
const GROUP_LINK_COLUMN = "groupe_id";

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" });
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ALLOWLIST = [
  "https://www.tickrace.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
function cors(req: Request) {
  const origin = req.headers.get("origin");
  const allowOrigin =
    origin && ALLOWLIST.includes(origin) ? origin : ALLOWLIST[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, stripe-signature, prefer",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}

const isUUID = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v as string,
  );

serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), {
      status: 405,
      headers,
    });
  }

  try {
    const body = await req.json();
    const {
      // commun
      user_id,
      course_id,
      format_id,
      email,
      successUrl,
      cancelUrl,
      options_total_eur = 0,

      // individuel
      inscription_id,
      trace_id,

      // groupe / relais
      mode, // "individuel" | "groupe" | "relais"
      team_name,
      team_size,
      category,
      members, // [{nom,prenom,genre,date_naissance,numero_licence,email?}]
      teams, // [{team_name,team_size,category,members:[]}]
    } = body ?? {};

    // Validations de base
    if (!isUUID(user_id) || !isUUID(course_id) || !isUUID(format_id)) {
      return new Response(JSON.stringify({ error: "Paramètres invalides (user_id/course_id/format_id)" }), { status: 400, headers });
    }
    if (!email) {
      return new Response(JSON.stringify({ error: "Email requis" }), { status: 400, headers });
    }
    const safeOptionsEur = Number(options_total_eur || 0);
    if (!Number.isFinite(safeOptionsEur) || safeOptionsEur < 0) {
      return new Response(JSON.stringify({ error: "options_total_eur invalide" }), { status: 400, headers });
    }

    // Récup format pour tarification
    const { data: fmt, error: fmtErr } = await admin
      .from("formats")
      .select("id, nom, prix, prix_equipe")
      .eq("id", format_id)
      .single();

    if (fmtErr || !fmt) {
      return new Response(JSON.stringify({ error: "Format introuvable" }), { status: 404, headers });
    }

    // Récup course -> organisateur (utile si on affiche le nom)
    const { data: course, error: courseErr } = await admin
      .from("courses")
      .select("id, nom, organisateur_id")
      .eq("id", course_id)
      .single();

    if (courseErr || !course) {
      return new Response(JSON.stringify({ error: "Course introuvable" }), { status: 404, headers });
    }

    // Construction line items Stripe
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    const optionsCents = Math.round(safeOptionsEur * 100);

    if (mode === "individuel" || !mode || mode === "individuel") {
      // ✅ INDIVIDUEL : l’inscription "en attente" est déjà créée côté UI
      if (!isUUID(inscription_id) || !isUUID(trace_id)) {
        return new Response(JSON.stringify({ error: "metadata invalide (inscription_id/trace_id)" }), { status: 400, headers });
      }

      const prixInscription = Math.round(Number(fmt.prix || 0) * 100);
      if (prixInscription > 0) {
        line_items.push({
          quantity: 1,
          price_data: {
            currency: "eur",
            product_data: {
              name: `Inscription — ${fmt.nom}`,
              metadata: { course_id, format_id },
            },
            unit_amount: prixInscription,
          },
        });
      }
      if (optionsCents > 0) {
        line_items.push({
          quantity: 1,
          price_data: {
            currency: "eur",
            product_data: {
              name: "Options payantes",
              metadata: { course_id, format_id },
            },
            unit_amount: optionsCents,
          },
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: email,
        line_items,
        allow_promotion_codes: true,
        success_url: successUrl || `${TICKRACE_BASE_URL}/merci`,
        cancel_url: cancelUrl || `${TICKRACE_BASE_URL}/paiement-annule`,
        metadata: {
          mode: "individuel",
          user_id,
          course_id,
          format_id,
          inscription_id,
          trace_id,
          options_total_eur: String(safeOptionsEur),
        },
      });

      return new Response(JSON.stringify({ url: session.url }), { status: 200, headers });
    }

    // ✅ GROUPE / RELAIS
    // Calcul du montant estimé (prix unitaire * membres + frais d’équipe)
    // + création des groupes & membres "en attente" (sans team_name dans `inscriptions`)
    const teamsList = Array.isArray(teams)
      ? teams
      : [{
          team_name,
          team_size,
          category: category || null,
          members: Array.isArray(members) ? members : [],
        }];

    // Validation rapide
    for (const t of teamsList) {
      if (!t?.team_name || !t?.team_size || !Array.isArray(t.members)) {
        return new Response(JSON.stringify({ error: "Payload équipe invalide" }), { status: 400, headers });
      }
      if (t.members.length !== Number(t.team_size)) {
        return new Response(JSON.stringify({ error: `Taille d’équipe incohérente pour ${t.team_name}` }), { status: 400, headers });
      }
    }

    // Pré-création groupes + membres (statut 'en attente')
    // On collecte les ids pour la metadata du PI (le webhook validera tout)
    const createdGroupIds: string[] = [];
    const createdInscriptionIds: string[] = [];

    for (const t of teamsList) {
      const { data: grp, error: grpErr } = await admin
        .from("inscriptions_groupes")
        .insert([{
          course_id,
          format_id,
          team_name: t.team_name,
          team_size: Number(t.team_size),
          category: t.category || null,
          statut: "en attente",
        }])
        .select("id")
        .single();

      if (grpErr || !grp?.id) {
        console.error("insert groupe error:", grpErr);
        return new Response(JSON.stringify({ error: "Erreur création groupe" }), { status: 500, headers });
      }

      createdGroupIds.push(grp.id);

      // Membres -> `inscriptions` (sans team_name; lien via GROUP_LINK_COLUMN)
      const rows = t.members.map((m: any) => ({
        course_id,
        format_id,
        nom: (m.nom || "").trim(),
        prenom: (m.prenom || "").trim(),
        genre: m.genre || null,
        date_naissance: m.date_naissance || null,
        numero_licence: (m.numero_licence || "").trim(),
        email: (m.email || null) || null,
        statut: "en attente",
        [GROUP_LINK_COLUMN]: grp.id,
      }));

      if (rows.length > 0) {
        const { data: inscs, error: insErr } = await admin
          .from("inscriptions")
          .insert(rows)
          .select("id");

        if (insErr) {
          console.error("insert inscriptions error:", insErr);
          return new Response(JSON.stringify({ error: "Erreur création membres" }), { status: 500, headers });
        }
        (inscs || []).forEach((r: any) => r?.id && createdInscriptionIds.push(r.id));
      }
    }

    // Montant Stripe
    const prixUnitaireCents = Math.round(Number(fmt.prix || 0) * 100);
    const prixEquipeCents = Math.round(Number(fmt.prix_equipe || 0) * 100);

    let totalInscriptionCents = 0;
    for (const t of teamsList) {
      totalInscriptionCents += prixUnitaireCents * Number(t.team_size || 0);
      totalInscriptionCents += prixEquipeCents;
    }

    if (totalInscriptionCents > 0) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency: "eur",
          product_data: {
            name: `Inscriptions ${mode === "relais" ? "relais" : "groupe"} — ${fmt.nom}`,
            metadata: { course_id, format_id },
          },
          unit_amount: totalInscriptionCents,
        },
      });
    }
    if (optionsCents > 0) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency: "eur",
          product_data: {
            name: "Options payantes",
            metadata: { course_id, format_id },
          },
          unit_amount: optionsCents,
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items,
      allow_promotion_codes: true,
      success_url: successUrl || `${TICKRACE_BASE_URL}/merci`,
      cancel_url: cancelUrl || `${TICKRACE_BASE_URL}/paiement-annule`,
      metadata: {
        mode: mode || "groupe",
        user_id,
        course_id,
        format_id,
        // On n’utilise pas inscription_id ici (multiple). On passe des CSV :
        group_ids: createdGroupIds.join(","),
        inscription_ids: createdInscriptionIds.join(","),
        options_total_eur: String(safeOptionsEur),
        // Pour corrélation côté webhook / paiements
        trace_id: crypto.randomUUID(),
      },
    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers });
  } catch (e: any) {
    console.error("create-checkout-session error:", e?.message ?? e, e?.stack);
    const debug = Deno.env.get("DEBUG") === "1";
    return new Response(
      JSON.stringify({ error: debug ? (e?.message ?? "Erreur serveur") : "Erreur serveur" }),
      { status: 500, headers },
    );
  }
});

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0&pin=v135";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0&pin=v135";

console.log("BUILD create-checkout-session 2025-09-29");

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const TICKRACE_BASE_URL = Deno.env.get("TICKRACE_BASE_URL") || "https://www.tickrace.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" });
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ALLOWLIST = ["https://www.tickrace.com","http://localhost:5173","http://127.0.0.1:5173"];
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

serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers });

  try {
    const body = await req.json();

    const mode = (body?.mode as string) || "individuel"; // 'individuel' | 'groupe' | 'relais'
    const user_id = body?.user_id as string;
    const course_id = body?.course_id as string;
    const email = (body?.email as string) || "";
    const successUrl = (body?.successUrl as string) || `${TICKRACE_BASE_URL}/merci`;
    const cancelUrl = (body?.cancelUrl as string) || `${TICKRACE_BASE_URL}/paiement-annule`;
    const options_total_eur = Number(body?.options_total_eur || 0);
    const selected_options = Array.isArray(body?.selected_options) ? body.selected_options as Array<{option_id:string, quantity:number, prix_unitaire_cents:number}> : [];

    if (!isUUID(user_id) || !isUUID(course_id) || !email) {
      return new Response(JSON.stringify({ error: "Paramètres invalides (user_id, course_id, email)." }), { status: 400, headers });
    }

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    const metadata: Record<string, string> = {
      mode,
      course_id,
      user_id,
      trace_id: body?.trace_id || body?.paiement_trace_id || crypto.randomUUID(),
    };

    // -------- INDIVIDUEL --------
    if (mode === "individuel") {
      const inscription_id = body?.inscription_id as string;
      if (!isUUID(inscription_id)) {
        return new Response(JSON.stringify({ error: "inscription_id manquant/invalid." }), { status: 400, headers });
      }

      // Récupérer l'inscription + format pour le montant
      const { data: insc, error: eInsc } = await admin
        .from("inscriptions")
        .select("id, format_id")
        .eq("id", inscription_id)
        .single();
      if (eInsc || !insc) {
        return new Response(JSON.stringify({ error: "Inscription introuvable." }), { status: 404, headers });
      }

      const { data: fmt, error: eFmt } = await admin
        .from("formats")
        .select("id, nom, prix")
        .eq("id", insc.format_id)
        .single();
      if (eFmt || !fmt) {
        return new Response(JSON.stringify({ error: "Format introuvable." }), { status: 404, headers });
      }

      const basePriceEUR = Number(fmt.prix || 0);

      // 1) Ligne inscription
      line_items.push({
        quantity: 1,
        price_data: {
          currency: "eur",
          product_data: { name: `Inscription – ${fmt.nom}` },
          unit_amount: Math.round(basePriceEUR * 100),
        },
      });

      // 2) Ligne options (agrégée) si > 0
      if (options_total_eur > 0) {
        line_items.push({
          quantity: 1,
          price_data: {
            currency: "eur",
            product_data: { name: "Options payantes" },
            unit_amount: Math.round(options_total_eur * 100),
          },
        });
      }

      metadata.inscription_id = inscription_id;

      // Crée la Session
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: email,
        success_url: successUrl,
        cancel_url: cancelUrl,
        line_items,
        payment_intent_data: { metadata },
        metadata,
      });

      return new Response(JSON.stringify({ url: session.url }), { status: 200, headers });
    }

    // -------- GROUPE / RELAIS --------
    // Requis : format_id et équipes (une ou plusieurs)
    const format_id = body?.format_id as string;
    if (!isUUID(format_id)) {
      return new Response(JSON.stringify({ error: "format_id manquant/invalid." }), { status: 400, headers });
    }

    // Récupère les infos format pour tarification
    const { data: fmt, error: eFmt2 } = await admin
      .from("formats")
      .select("id, nom, prix, prix_equipe")
      .eq("id", format_id)
      .single();
    if (eFmt2 || !fmt) {
      return new Response(JSON.stringify({ error: "Format introuvable." }), { status: 404, headers });
    }
    const prixUnitaireEUR = Number(fmt.prix || 0);
    const prixEquipeEUR = Number(fmt.prix_equipe || 0);

    type Member = {
      nom: string; prenom: string; genre?: string; date_naissance?: string;
      numero_licence?: string; email?: string;
    };
    type Team = { team_name: string; team_size: number; category?: string | null; members: Member[] };

    const teams: Team[] = Array.isArray(body?.teams)
      ? (body.teams as Team[])
      : [{
          team_name: body?.team_name as string,
          team_size: Number(body?.team_size || 0),
          category: (body?.category as string) ?? null,
          members: Array.isArray(body?.members) ? (body.members as Member[]) : [],
        }];

    // Validation soft des équipes
    if (!teams.length || !teams[0]?.team_name) {
      return new Response(JSON.stringify({ error: "Aucune équipe valide reçue." }), { status: 400, headers });
    }

    // Créer les inscriptions “en attente”
    const inscriptionIds: string[] = [];
    for (const team of teams) {
      const size = Number(team.team_size || (team.members?.length || 0) || 0);
      if (size <= 0 || !Array.isArray(team.members) || team.members.length !== size) {
        return new Response(JSON.stringify({ error: `Équipe "${team.team_name}" invalide (taille/membres).` }), { status: 400, headers });
      }

      const rows = team.members.map((m) => ({
        course_id,
        format_id,
        statut: "en attente",
        nom: (m.nom || "").trim(),
        prenom: (m.prenom || "").trim(),
        genre: m.genre || null,
        date_naissance: m.date_naissance || null,
        numero_licence: (m.numero_licence || "").trim(),
        email: (m.email || "").trim() || null,
        team_name: team.team_name,           // si la colonne existe, sinon ignoré par Supabase
        type_inscription: mode,              // idem (si colonne existe)
      }));

      const { data: inserted, error: eIns } = await admin
        .from("inscriptions")
        .insert(rows)
        .select("id");
      if (eIns) {
        console.error("insert inscriptions (team):", eIns);
        return new Response(JSON.stringify({ error: "Insertion des membres échouée." }), { status: 500, headers });
      }
      (inserted || []).forEach((r: any) => inscriptionIds.push(r.id));
    }

    // Répliquer les options sélectionnées en 'pending' pour CHAQUE inscription membre
    if (selected_options?.length && inscriptionIds.length) {
      const toInsert: any[] = [];
      for (const inscId of inscriptionIds) {
        for (const opt of selected_options) {
          const qty = Number(opt?.quantity || 0);
          const unit = Number(opt?.prix_unitaire_cents || 0);
          if (!isUUID(opt?.option_id) || qty <= 0 || unit < 0) continue;
          toInsert.push({
            inscription_id: inscId,
            option_id: opt.option_id,
            quantity: Math.min(qty, 10), // borne comme l’UI
            prix_unitaire_cents: unit,
            status: "pending",
          });
        }
      }
      if (toInsert.length) {
        const { error: eOpt } = await admin.from("inscriptions_options").insert(toInsert);
        if (eOpt) console.error("insert inscriptions_options (team):", eOpt);
      }
    }

    // Montant total: (Σ équipes (taille * prixUnitaire + prixEquipe)) + options * nbParticipants
    const participants = teams.reduce((acc, t) => acc + Number(t.team_size || 0), 0);
    const baseTotalEUR = teams.reduce((acc, t) => acc + (Number(t.team_size || 0) * prixUnitaireEUR) + prixEquipeEUR, 0);
    const optsTotalEUR = (selected_options?.length
      ? selected_options.reduce((s, o) => s + (Number(o.prix_unitaire_cents || 0) * Number(o.quantity || 0)) / 100, 0)
      : Number(options_total_eur || 0)) * (participants || 1);

    const grandTotalEUR = baseTotalEUR + optsTotalEUR;

    // Lignes Stripe (2 lignes : base + options si >0)
    line_items.push({
      quantity: 1,
      price_data: {
        currency: "eur",
        product_data: { name: `Inscriptions – ${fmt.nom} (${participants} part.)` },
        unit_amount: Math.max(0, Math.round(baseTotalEUR * 100)),
      },
    });
    if (optsTotalEUR > 0) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency: "eur",
          product_data: { name: "Options payantes (équipes)" },
          unit_amount: Math.max(0, Math.round(optsTotalEUR * 100)),
        },
      });
    }

    metadata.format_id = format_id;
    metadata.inscription_ids = inscriptionIds.join(",");
    metadata.mode = mode;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items,
      payment_intent_data: { metadata },
      metadata,
    });

    return new Response(JSON.stringify({ url: session.url, total_eur: grandTotalEUR }), { status: 200, headers });
  } catch (e: any) {
    console.error("create-checkout-session error:", e?.message ?? e, e?.stack);
    const debug = Deno.env.get("DEBUG") === "1";
    return new Response(JSON.stringify({ error: debug ? (e?.message ?? "Erreur serveur") : "Erreur serveur" }), { status: 500, headers });
  }
});

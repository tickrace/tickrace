// supabase/functions/create-checkout-session/index.ts
// Deno Deploy / Supabase Edge Functions (TypeScript)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@16.6.0?target=deno";
import { z } from "https://esm.sh/zod@3.23.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const BASE_URL = Deno.env.get("TICKRACE_BASE_URL") || "https://www.tickrace.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });

// ---- Schemas
const OptionSchema = z.object({
  option_id: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
  prix_unitaire_cents: z.number().int().nonnegative(), // on reçoit le prix pour tracer
});

const RunnerSchema = z.object({
  prenom: z.string().min(1),
  nom: z.string().min(1),
  email: z.string().email(),
  genre: z.string().optional(),
  date_naissance: z.string().optional(),
  nationalite: z.string().optional(),
  licence: z.string().optional(),
  pps_url: z.string().url().optional(),
  telephone: z.string().optional(),
  adresse: z.string().optional(),
  // options individuelles pour ce coureur
  selected_options: z.array(OptionSchema).optional().default([]),
});

const PayloadSchema = z.object({
  mode: z.string(), // FR ou EN accepté, on normalise plus bas
  format_id: z.string().uuid(),
  // Individuel
  runner: RunnerSchema.optional(),
  selected_options: z.array(OptionSchema).optional().default([]), // options au niveau "individuel simple"

  // Groupe / relais
  team: z
    .object({
      team_name: z.string().min(1),
      category: z.string().optional(),
      members: z.array(RunnerSchema).min(2),
    })
    .optional(),
});

// ---- Helpers
function normMode(modeRaw: string): "individual" | "team" | "relay" {
  const m = modeRaw.toLowerCase();
  if (["individuel", "individual"].includes(m)) return "individual";
  if (["groupe", "team"].includes(m)) return "team";
  if (["relais", "relay"].includes(m)) return "relay";
  throw new Error(`mode invalide: ${modeRaw}`);
}

function cors(headers: Headers) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "content-type, authorization");
  return headers;
}

serve(async (req) => {
  const headers = cors(new Headers({ "content-type": "application/json; charset=utf-8" }));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  try {
    const body = await req.json();
    const parsed = PayloadSchema.parse(body);
    const mode = normMode(parsed.mode);

    // Vérifier format + récupérer prix (en cents)
    const { data: format, error: fe } = await supabase
      .from("formats")
      .select("id, nom, prix")
      .eq("id", parsed.format_id)
      .single();

    if (fe || !format) {
      return new Response(JSON.stringify({ error: "format introuvable" }), { status: 400, headers });
    }
    const formatPriceCents = Math.round((format.prix ?? 0) * 100);

    // Construire inscriptions à créer
    let groupId: string | null = null;
    const inscriptionsToInsert: any[] = [];
    const optionsToInsert: any[] = [];
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    if (mode === "individual") {
      if (!parsed.runner) {
        return new Response(JSON.stringify({ error: "runner requis pour mode individuel" }), {
          status: 400,
          headers,
        });
      }
      const r = parsed.runner;

      inscriptionsToInsert.push({
        format_id: parsed.format_id,
        prenom: r.prenom,
        nom: r.nom,
        email: r.email,
        team_name: null,
        member_of_group_id: null,
        statut: "pending",
      });

      // Lignes Stripe: inscription
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: formatPriceCents,
          product_data: { name: `Inscription — ${format.nom}` },
        },
      });

      // Options du runner (ou globales individuelles)
      const runnerOptions = (r.selected_options ?? []).concat(parsed.selected_options ?? []);
      for (const opt of runnerOptions) {
        optionsToInsert.push({
          // inscription_id sera ajouté après l'insert des inscriptions
          option_id: opt.option_id,
          quantity: opt.quantity,
          prix_unitaire_cents: opt.prix_unitaire_cents,
          status: "pending",
        });
        lineItems.push({
          quantity: opt.quantity,
          price_data: {
            currency: "eur",
            unit_amount: opt.prix_unitaire_cents,
            product_data: { name: `Option — ${opt.option_id}` }, // si tu as un nom d’option, remplace ici
          },
        });
      }
    } else {
      // TEAM / RELAY
      if (!parsed.team) {
        return new Response(JSON.stringify({ error: "team requis pour mode groupe/relais" }), {
          status: 400,
          headers,
        });
      }
      const team = parsed.team;

      // Créer le groupe
      const { data: g, error: ge } = await supabase
        .from("inscriptions_groupes")
        .insert({
          team_name: team.team_name,
          team_size: team.members.length,
          category: team.category ?? null,
          statut: "pending",
        })
        .select("id")
        .single();
      if (ge || !g) throw new Error("Création groupe impossible");
      groupId = g.id;

      for (const m of team.members) {
        inscriptionsToInsert.push({
          format_id: parsed.format_id,
          prenom: m.prenom,
          nom: m.nom,
          email: m.email,
          team_name: team.team_name,
          member_of_group_id: groupId,
          statut: "pending",
        });

        // ligne Stripe inscription par membre
        lineItems.push({
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: formatPriceCents,
            product_data: { name: `Inscription — ${format.nom} — ${m.prenom} ${m.nom}` },
          },
        });

        for (const opt of m.selected_options ?? []) {
          optionsToInsert.push({
            option_id: opt.option_id,
            quantity: opt.quantity,
            prix_unitaire_cents: opt.prix_unitaire_cents,
            status: "pending",
          });
          lineItems.push({
            quantity: opt.quantity,
            price_data: {
              currency: "eur",
              unit_amount: opt.prix_unitaire_cents,
              product_data: { name: `Option — ${opt.option_id} — ${m.prenom} ${m.nom}` },
            },
          });
        }
      }
    }

    // Insert inscriptions (bulk)
    const { data: inscRows, error: ie } = await supabase
      .from("inscriptions")
      .insert(inscriptionsToInsert)
      .select("id, member_of_group_id, email");
    if (ie || !inscRows) throw new Error("Insertion inscriptions échouée");

    // Relier options aux inscriptions (pour individuel: 1 inscription; pour groupe: duplique à chacun s’il y en avait)
    const firstInscriptionId = inscRows[0]?.id;
    const expandedOptions: any[] = [];

    if (mode === "individual") {
      for (const o of optionsToInsert) {
        expandedOptions.push({ ...o, inscription_id: firstInscriptionId });
      }
    } else {
      // pour le groupe: optionsToInsert sont déjà par membre; si tu veux des options "globales d’équipe", tu peux les dupliquer sur chaque membre ici
      let cursor = 0;
      // Hypothèse: optionsToInsert est déjà aligné par membre via la boucle précédente
      for (const row of inscRows) {
        // on prend toutes les options dans l'ordre où on les a ajoutées par membre
        // si tu veux un mapping plus strict, envoie memberId côté payload
        // Ici: rien à faire, car déjà push par membre dans la boucle plus haut
      }
      // réconciliation triviale: si optionsToInsert existe mais sans inscription_id, on les applique au premier membre
      if (optionsToInsert.length && !optionsToInsert[0].inscription_id) {
        for (const o of optionsToInsert) expandedOptions.push({ ...o, inscription_id: inscRows[cursor % inscRows.length].id });
        cursor++;
      }
    }

    if (expandedOptions.length > 0) {
      const { error: ioe } = await supabase.from("inscriptions_options").insert(expandedOptions);
      if (ioe) throw new Error(`Insertion options échouée: ${ioe.message}`);
    }

    // Calcul total (à partir des line_items déjà construits)
    const totalAmountCents = lineItems.reduce((sum, li) => {
      const unit = (li.price_data?.unit_amount ?? 0);
      const qty = li.quantity ?? 1;
      return sum + unit * qty;
    }, 0);

    // Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${BASE_URL}/mes-inscriptions?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/mes-inscriptions?canceled=1`,
      metadata: {
        mode,
        format_id: parsed.format_id,
        group_id: groupId ?? "",
      },
    });

    // Persister paiement pending
    const inscriptionIds = inscRows.map((r: any) => r.id);
    const { error: pe } = await supabase.from("paiements").insert({
      stripe_session_id: session.id,
      status: "pending",
      total_amount_cents: totalAmountCents,
      inscription_ids: inscriptionIds,
    });
    if (pe) {
      // pas bloquant pour l’utilisateur, mais on log
      console.error("paiements insert error:", pe);
    }

    // Lier paiement au groupe (si groupe)
    if (groupId) {
      await supabase
        .from("inscriptions_groupes")
        .update({ paiement_id: (await supabase.from("paiements").select("id").eq("stripe_session_id", session.id).maybeSingle()).data?.id ?? null })
        .eq("id", groupId);
    }

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "payload invalide", details: String(e?.message ?? e) }), {
      status: 400,
      headers,
    });
  }
});

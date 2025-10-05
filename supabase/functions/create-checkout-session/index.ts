// supabase/functions/create-checkout-session/index.ts
// Edge Function (Supabase / Deno)

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

/* --------------------------------- Helpers --------------------------------- */

function normMode(raw?: string): "individual" | "team" | "relay" {
  const m = (raw || "").toLowerCase();
  if (!raw) return "individual";
  if (["individuel", "individual"].includes(m)) return "individual";
  if (["groupe", "team"].includes(m)) return "team";
  if (["relais", "relay"].includes(m)) return "relay";
  return "team";
}

function toTeamCategory(cat?: string | null): "open" | "male" | "female" | "mixed" | "masters" {
  const v = (cat || "").toLowerCase().trim();
  if (["male", "homme", "masculine", "m"].includes(v)) return "male";
  if (["female", "femme", "feminine", "f"].includes(v)) return "female";
  if (["mixed", "mixte"].includes(v)) return "mixed";
  if (["masters", "master"].includes(v)) return "masters";
  return "open";
}

function ensureSuccessUrl(u?: string) {
  if (!u || u.trim() === "") return `${BASE_URL}/mes-inscriptions?session_id={CHECKOUT_SESSION_ID}`;
  if (u.includes("{CHECKOUT_SESSION_ID}")) return u;
  const sep = u.includes("?") ? "&" : "?";
  return `${u}${sep}session_id={CHECKOUT_SESSION_ID}`;
}
function ensureCancelUrl(u?: string) {
  if (!u || u.trim() === "") return `${BASE_URL}/mes-inscriptions?canceled=1`;
  return u;
}

/* ----------------------------------- Zod ----------------------------------- */

const OptionSchema = z.object({
  option_id: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  prix_unitaire_cents: z.coerce.number().int().nonnegative(),
});

const MemberSchema = z.object({
  nom: z.string().min(1),
  prenom: z.string().min(1),
  genre: z.string().optional(),
  date_naissance: z.string().optional(), // 'YYYY-MM-DD' accepté
  numero_licence: z.string().optional(),
  // accepte "" -> undefined
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().email().optional()
  ),
}).strip();

const TeamSchemaLoose = z.object({
  team_name: z.string().min(1),
  team_size: z.coerce.number().int().positive(),
  category: z.string().nullable().optional(), // front: masculine|feminine|mixte...
  members: z.array(MemberSchema).min(1),
}).strip();

const BodyIndividualSchema = z.object({
  inscription_id: z.string().uuid(),
  email: z.string().email().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  options_total_eur: z.number().optional(),
  trace_id: z.string().optional(),
}).strip();

const BodyGroupRelayBase = z.object({
  mode: z.string(), // FR/EN
  format_id: z.string().uuid(),
  course_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().email().optional()
  ),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  options_total_eur: z.number().optional(),
  selected_options: z.array(OptionSchema).optional().default([]),
}).strip();

const BodyGroupRelaySchema = z.union([
  BodyGroupRelayBase.extend({ teams: z.array(TeamSchemaLoose).min(1) }),
  BodyGroupRelayBase.extend({
    team_name: z.string().min(1),
    team_size: z.coerce.number().int().positive(),
    category: z.string().nullable().optional(),
    members: z.array(MemberSchema).min(1),
  }),
]);

/* --------------------------------- Handler --------------------------------- */

serve(async (req) => {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization",
  });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  try {
    const body = await req.json();

    /* -------------------------- A) INDIVIDUEL via ID -------------------------- */
    const tryInd = BodyIndividualSchema.safeParse(body);
    if (tryInd.success) {
      const { inscription_id, email, successUrl, cancelUrl, trace_id } = tryInd.data;

      // Inscription + format
      const { data: insc, error: ie } = await supabase
        .from("inscriptions")
        .select("id, format_id, email, nombre_repas")
        .eq("id", inscription_id)
        .single();
      if (ie || !insc) throw new Error("inscription introuvable");

      const { data: format, error: fe } = await supabase
        .from("formats")
        .select("id, nom, prix, prix_repas")
        .eq("id", insc.format_id)
        .single();
      if (fe || !format) throw new Error("format introuvable");

      const formatPriceCents = Math.round((Number(format.prix) || 0) * 100);
      const repasUnitCents   = Math.round((Number(format.prix_repas) || 0) * 100);
      const repasQty         = Math.max(0, Number(insc.nombre_repas || 0));

      // Options pending existantes
      const { data: opts } = await supabase
        .from("inscriptions_options")
        .select("option_id, quantity, prix_unitaire_cents")
        .eq("inscription_id", insc.id)
        .eq("status", "pending");

      const items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: formatPriceCents,
            product_data: { name: `Inscription — ${format.nom}` },
          },
        },
      ];
      if (repasQty > 0 && repasUnitCents > 0) {
        items.push({
          quantity: repasQty,
          price_data: {
            currency: "eur",
            unit_amount: repasUnitCents,
            product_data: { name: "Repas" },
          },
        });
      }
      for (const o of opts ?? []) {
        if (!o?.prix_unitaire_cents || !o?.quantity) continue;
        items.push({
          quantity: o.quantity,
          price_data: {
            currency: "eur",
            unit_amount: o.prix_unitaire_cents,
            product_data: { name: `Option — ${o.option_id}` },
          },
        });
      }

      const payerEmail = email || insc.email || undefined;
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: items,
        customer_email: payerEmail,                                    // pré-rempli
        payment_intent_data: payerEmail ? { receipt_email: payerEmail } : undefined,
        success_url: ensureSuccessUrl(successUrl),
        cancel_url: ensureCancelUrl(cancelUrl),
        metadata: {
          mode: "individual",
          format_id: String(insc.format_id || ""),
          inscription_id: insc.id,
          trace_id: trace_id || "",
        },
      });

      const total = items.reduce((s, li) => s + (li.price_data?.unit_amount || 0) * (li.quantity || 1), 0);
      await supabase.from("paiements").insert({
        stripe_session_id: session.id,
        status: "pending",
        total_amount_cents: total,
        inscription_ids: [insc.id],
      });

      return new Response(JSON.stringify({ url: session.url }), { status: 200, headers });
    }

    /* ------------------------- B) GROUPE / RELAIS (DB réelle) ------------------------- */
    const tryGrp = BodyGroupRelaySchema.safeParse(body);
    if (!tryGrp.success) {
      console.error("ZOD_GROUP_FAIL:", JSON.stringify(tryGrp.error.issues, null, 2));
      return new Response(
        JSON.stringify({ error: "payload invalide", details: tryGrp.error.issues }),
        { status: 400, headers },
      );
    }

    const payload = tryGrp.data as any;
    const mode = normMode(payload.mode); // 'team' ou 'relay'

    // Normaliser teams
    const teams = Array.isArray(payload.teams)
      ? payload.teams
      : [{
          team_name: payload.team_name,
          team_size: Number(payload.team_size),
          category: payload.category ?? null, // masculine|feminine|mixte...
          members: payload.members ?? [],
        }];

    // Récup format / tarifs
    const { data: format, error: fe2 } = await supabase
      .from("formats")
      .select("id, nom, prix, prix_equipe")
      .eq("id", payload.format_id)
      .single();
    if (fe2 || !format) throw new Error("format introuvable");

    const formatPriceCents = Math.round((Number(format.prix) || 0) * 100);
    const teamFeeCents     = Math.round((Number(format.prix_equipe) || 0) * 100);

    const allInscriptionIds: string[] = [];
    const createdGroupIds: string[]   = [];
    const items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    for (const t of teams) {
      const teamName = String(t.team_name || "").trim();
      const teamSize = Math.max(1, Number(t.team_size || 0));
      const members  = Array.isArray(t.members) ? t.members : [];

      // Insert GROUPE conforme à ton schéma
      const groupPayload = {
        format_id: payload.format_id,              // NOT NULL
        nom_groupe: teamName,
        team_size: teamSize,                       // NOT NULL
        statut: "en_attente",                      // CHECK (en_attente|paye|annule)
        team_name: teamName,
        team_name_public: teamName,
        category: t.category ?? null,              // libre
        team_category: toTeamCategory(t.category), // CHECK (male|female|mixed|open|masters)
        members_count: teamSize,
        capitaine_user_id: payload.user_id ?? null,
      };

      const { data: g, error: ge } = await supabase
        .from("inscriptions_groupes")
        .insert(groupPayload)
        .select("id")
        .single();

      if (ge || !g) {
        console.error("GROUP_INSERT_ERROR", { groupPayload, ge });
        throw new Error(`création groupe impossible (${teamName})`);
      }
      createdGroupIds.push(g.id);

      // Frais d’équipe si définis
      if (teamFeeCents > 0) {
        items.push({
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: teamFeeCents,
            product_data: { name: `Frais d’équipe — ${teamName}` },
          },
        });
      }

      // Inscriptions MEMBRES (statut 'en attente', coureur_id=null pour éviter défaut FK)
      const rows = members.map((m: any) => ({
        course_id: payload.course_id ?? null,
        format_id: payload.format_id,
        coureur_id: null,                  // <-- crucial pour éviter DEFAULT gen_random_uuid() -> FK
        nom: m.nom,
        prenom: m.prenom,
        email: m.email ?? null,
        genre: m.genre ?? null,
        date_naissance: m.date_naissance ?? null,
        numero_licence: m.numero_licence ?? null,
        team_name: teamName,
        member_of_group_id: g.id,
        statut: "en attente",
      }));

      const { data: inscs, error: ie2 } = await supabase
        .from("inscriptions")
        .insert(rows)
        .select("id, prenom, nom");
      if (ie2 || !inscs) {
        console.error("INSCRIPTIONS_INSERT_ERROR", { rows, ie2 });
        throw new Error("insertion inscriptions échouée");
      }

      const ids = inscs.map((r: any) => r.id);
      allInscriptionIds.push(...ids);

      // Lignes Stripe par membre (inscription de base)
      for (const r of inscs) {
        items.push({
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: formatPriceCents,
            product_data: { name: `Inscription — ${format.nom} — ${r.prenom ?? ""} ${r.nom ?? ""}`.trim() },
          },
        });
      }
    }

    // ---------- OPTIONS : une seule fois pour toute la commande ----------
    const orderOptions = payload.selected_options ?? [];
    if (orderOptions.length > 0 && allInscriptionIds.length > 0) {
      const anchorInscriptionId = allInscriptionIds[0]; // rattacher à la 1ère inscription
      const optionsRows: any[] = [];

      for (const o of orderOptions) {
        const qty  = Math.max(1, Number(o.quantity || 1));
        const unit = Math.max(0, Number(o.prix_unitaire_cents || 0));

        optionsRows.push({
          inscription_id: anchorInscriptionId,
          option_id: o.option_id,
          quantity: qty,
          prix_unitaire_cents: unit,
          status: "pending",
        });

        items.push({
          quantity: qty,
          price_data: {
            currency: "eur",
            unit_amount: unit,
            product_data: { name: `Option — ${o.option_id}` },
          },
        });
      }

      const { error: ioe } = await supabase.from("inscriptions_options").insert(optionsRows);
      if (ioe) {
        console.error("OPTIONS_INSERT_ERROR", { optionsRows, ioe });
        throw new Error(`insert options échouée: ${ioe.message}`);
      }
    }

    // ---------- Stripe Checkout ----------
    const payerEmail = payload.email || undefined;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: items,
      customer_email: payerEmail,                                              // pré-rempli
      payment_intent_data: payerEmail ? { receipt_email: payerEmail } : undefined, // reçu Stripe
      success_url: ensureSuccessUrl(payload.successUrl),
      cancel_url: ensureCancelUrl(payload.cancelUrl),
      metadata: {
        mode,
        format_id: payload.format_id,
        groups: createdGroupIds.join(","),
      },
    });

    const total = items.reduce((s, li) => s + (li.price_data?.unit_amount || 0) * (li.quantity || 1), 0);
    const { data: pay, error: pe } = await supabase
      .from("paiements")
      .insert({
        stripe_session_id: session.id,
        status: "pending",
        total_amount_cents: total,
        inscription_ids: allInscriptionIds,
      })
      .select("id")
      .single();

    if (!pe && pay?.id && createdGroupIds.length > 0) {
      const { error: upg } = await supabase
        .from("inscriptions_groupes")
        .update({ paiement_id: pay.id })
        .in("id", createdGroupIds);
      if (upg) console.error("GROUPS_UPDATE_PAYMENT_ERROR", upg);
    } else if (pe) {
      console.error("PAIEMENTS_INSERT_ERROR", pe);
    }

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers });
  } catch (e) {
    console.error("CREATE_CHECKOUT_SESSION_FATAL:", e);
    return new Response(
      JSON.stringify({ error: "payload invalide", details: String(e?.message ?? e) }),
      { status: 400, headers },
    );
  }
});

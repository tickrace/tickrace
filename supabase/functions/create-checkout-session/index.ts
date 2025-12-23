// supabase/functions/create-checkout-session/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@16.6.0?target=deno";
import { z } from "https://esm.sh/zod@3.23.8";

/* ------------------------------ ENV ------------------------------ */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const BASE_URL = Deno.env.get("TICKRACE_BASE_URL") || "https://www.tickrace.com";

/* --------------------------- Clients ----------------------------- */
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });

/* ------------------------------ CORS ----------------------------- */
function corsHeaders() {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "authorization, content-type, apikey, x-client-info");
  h.set("Access-Control-Max-Age", "86400");
  h.set("content-type", "application/json; charset=utf-8");
  return h;
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders() });

/* ----------------------------- Helpers --------------------------- */
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
  if (!u || u.trim() === "") return `${BASE_URL}/merci?session_id={CHECKOUT_SESSION_ID}`;
  if (u.includes("{CHECKOUT_SESSION_ID}")) return u;
  const sep = u.includes("?") ? "&" : "?";
  return `${u}${sep}session_id={CHECKOUT_SESSION_ID}`;
}
function ensureCancelUrl(u?: string) {
  if (!u || u.trim() === "") return `${BASE_URL}/paiement-annule`;
  return u;
}

function centsToEur(cents: number | null | undefined) {
  if (typeof cents !== "number") return null;
  return Math.round(cents) / 100;
}

/** UPSERT paiements robuste (idempotent, logs d’erreur) */
async function upsertPaiement(params: {
  stripe_session_id: string;
  type: "individuel" | "groupe";
  inscription_ids: string[];
  total_cents: number;
  devise?: string | null;
  trace_id?: string | null;
}) {
  const payload: any = {
    stripe_session_id: params.stripe_session_id,
    status: "pending",
    devise: params.devise || "eur",
    type: params.type,
    inscription_ids: params.inscription_ids,
    total_amount_cents: params.total_cents,
    amount_total: params.total_cents,
    amount_subtotal: params.total_cents,
    montant_total: centsToEur(params.total_cents),
    trace_id: params.trace_id || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("paiements")
    .upsert(payload, { onConflict: "stripe_session_id" })
    .select("id")
    .single();

  if (error) {
    console.error("PAIEMENTS_UPSERT_ERROR", { payload }, error);
    throw new Error(`paiements upsert échoué: ${error.message}`);
  }
  console.log("PAIEMENTS_UPSERT_OK", data?.id);
  return data?.id as string;
}

/* ------------------------------- Zod ----------------------------- */
const OptionSchema = z.object({
  option_id: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  prix_unitaire_cents: z.coerce.number().int().nonnegative(),
});

const MemberSchema = z.object({
  nom: z.string().min(1),
  prenom: z.string().min(1),
  genre: z.string().optional(),
  date_naissance: z.string().optional(),
  numero_licence: z.string().optional(),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().email().optional(),
  ),
}).strip();

const TeamSchemaLoose = z.object({
  team_name: z.string().min(1),
  team_size: z.coerce.number().int().positive(),
  category: z.string().nullable().optional(),
  members: z.array(MemberSchema).min(1),
}).strip();

const BodyIndividualSchema = z.object({
  inscription_id: z.string().uuid(),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().email().optional(),
  ),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  options_total_eur: z.number().optional(),
  trace_id: z.string().optional(),
}).strip();

const BodyGroupRelayBase = z.object({
  mode: z.string(),
  format_id: z.string().uuid(),
  course_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().email().optional(),
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

/* ------------------------------ Handler -------------------------- */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json();

    /* --------------------- A) INDIVIDUEL via inscription_id --------------------- */
    const tryInd = BodyIndividualSchema.safeParse(body);
    if (tryInd.success) {
      const { inscription_id, email, successUrl, cancelUrl, trace_id } = tryInd.data;

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
      const repasUnitCents = Math.round((Number(format.prix_repas) || 0) * 100);
      const repasQty = Math.max(0, Number(insc.nombre_repas || 0));

      const { data: opts, error: oe } = await supabase
        .from("inscriptions_options")
        .select("option_id, quantity, prix_unitaire_cents")
        .eq("inscription_id", insc.id)
        .eq("status", "pending");
      if (oe) console.error("OPTIONS_LOOKUP_ERROR", oe);

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
        customer_email: payerEmail,
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

      const total = items.reduce(
        (s, li) => s + (li.price_data?.unit_amount || 0) * (li.quantity || 1),
        0,
      );

      // ✅ CRUCIAL : créer/mettre à jour la ligne paiements quoi qu’il arrive
      await upsertPaiement({
        stripe_session_id: session.id,
        type: "individuel",
        inscription_ids: [insc.id],
        total_cents: total,
        devise: session.currency || "eur",
        trace_id: trace_id || null,
      });

      return json({ url: session.url }, 200);
    }

    /* ---------------------- B) GROUPE / RELAIS ---------------------- */
    const tryGrp = BodyGroupRelaySchema.safeParse(body);
    if (!tryGrp.success) {
      console.error("ZOD_GROUP_FAIL:", JSON.stringify(tryGrp.error.issues, null, 2));
      return json({ error: "payload invalide", details: tryGrp.error.issues }, 400);
    }

    const payload = tryGrp.data as any;
    const mode = normMode(payload.mode); // team|relay

    const teams = Array.isArray(payload.teams)
      ? payload.teams
      : [{
          team_name: payload.team_name,
          team_size: Number(payload.team_size),
          category: payload.category ?? null,
          members: payload.members ?? [],
        }];

    const { data: format, error: fe2 } = await supabase
      .from("formats")
      .select("id, nom, prix, prix_equipe")
      .eq("id", payload.format_id)
      .single();
    if (fe2 || !format) throw new Error("format introuvable");

    const formatPriceCents = Math.round((Number(format.prix) || 0) * 100);
    const teamFeeCents = Math.round((Number(format.prix_equipe) || 0) * 100);

    const allInscriptionIds: string[] = [];
    const createdGroupIds: string[] = [];
    const items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    for (const t of teams) {
      const teamName = String(t.team_name || "").trim();
      const teamSize = Math.max(1, Number(t.team_size || 0));
      const members = Array.isArray(t.members) ? t.members : [];

      const groupPayload = {
        format_id: payload.format_id,
        nom_groupe: teamName,
        team_size: teamSize,
        statut: "en_attente",
        team_name: teamName,
        team_name_public: teamName,
        category: t.category ?? null,
        team_category: toTeamCategory(t.category),
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
        return json({ error: "payload invalide", details: `création groupe impossible (${teamName})` }, 400);
      }
      createdGroupIds.push(g.id);

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

      const rows = members.map((m: any) => ({
        course_id: payload.course_id ?? null,
        format_id: payload.format_id,
        coureur_id: null,
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
        return json({ error: "payload invalide", details: "insertion inscriptions échouée" }, 400);
      }

      const ids = inscs.map((r: any) => r.id);
      allInscriptionIds.push(...ids);

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

    const orderOptions = payload.selected_options ?? [];
    if (orderOptions.length > 0 && allInscriptionIds.length > 0) {
      const anchorInscriptionId = allInscriptionIds[0];
      const optionsRows: any[] = [];

      for (const o of orderOptions) {
        const qty = Math.max(1, Number(o.quantity || 1));
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
        return json({ error: "payload invalide", details: `insert options échouée: ${ioe.message}` }, 400);
      }
    }

    const payerEmail = payload.email || undefined;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: items,
      customer_email: payerEmail,
      payment_intent_data: payerEmail ? { receipt_email: payerEmail } : undefined,
      success_url: ensureSuccessUrl(payload.successUrl),
      cancel_url: ensureCancelUrl(payload.cancelUrl),
      metadata: {
        mode,
        format_id: payload.format_id,
        groups: createdGroupIds.join(","),
      },
    });

    const total = items.reduce((s, li) => s + (li.price_data?.unit_amount || 0) * (li.quantity || 1), 0);

    // ✅ CRUCIAL : créer/mettre à jour la ligne paiements
    const paiementId = await upsertPaiement({
      stripe_session_id: session.id,
      type: "groupe",
      inscription_ids: allInscriptionIds,
      total_cents: total,
      devise: session.currency || "eur",
      trace_id: null,
    });

    if (paiementId && createdGroupIds.length > 0) {
      const { error: upg } = await supabase
        .from("inscriptions_groupes")
        .update({ paiement_id: paiementId })
        .in("id", createdGroupIds);
      if (upg) console.error("GROUPS_UPDATE_PAYMENT_ERROR", upg);
    }

    return json({ url: session.url }, 200);
  } catch (e: any) {
    console.error("CREATE_CHECKOUT_SESSION_FATAL:", e);
    return json({ error: "payload invalide", details: String(e?.message ?? e) }, 400);
  }
});

// Deno / Supabase Edge Function
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

/* ----------------------------- Schemas / Helpers ---------------------------- */

const OptionSchema = z.object({
  option_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  prix_unitaire_cents: z.number().int().nonnegative(),
});

const MemberSchema = z.object({
  nom: z.string().min(1),
  prenom: z.string().min(1),
  genre: z.string().min(1),
  date_naissance: z.string().min(1),
  numero_licence: z.string().optional(),
  email: z.string().email().optional(),
});

const TeamSchema = z.object({
  team_name: z.string().min(1),
  team_size: z.number().int().positive(),
  category: z.string().nullable().optional(),
  members: z.array(MemberSchema).min(1),
});

const IndividualByIdSchema = z.object({
  inscription_id: z.string().uuid(),
  email: z.string().email().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  options_total_eur: z.number().optional(),
});

const GroupRelaySchemaBase = z.object({
  mode: z.string(), // FR/EN
  format_id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
  course_id: z.string().uuid().optional(),
  email: z.string().email().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  options_total_eur: z.number().optional(),
  selected_options: z.array(OptionSchema).optional().default([]),
});

const GroupRelaySchema = z.union([
  GroupRelaySchemaBase.extend({ teams: z.array(TeamSchema).min(1) }),
  GroupRelaySchemaBase.extend({
    team_name: z.string().min(1),
    team_size: z.number().int().positive(),
    category: z.string().nullable().optional(),
    members: z.array(MemberSchema).min(1),
  }),
]);

const BodySchema = z.union([IndividualByIdSchema, GroupRelaySchema]);

function normMode(raw: string): "individual" | "team" | "relay" {
  const m = (raw || "").toLowerCase();
  if (!raw) return "individual";
  if (["individuel", "individual"].includes(m)) return "individual";
  if (["groupe", "team"].includes(m)) return "team";
  if (["relais", "relay"].includes(m)) return "relay";
  // Par défaut si inconnu, considérer "team" si fourni, sinon individual
  return m ? "team" : "individual";
}

function cors(headers: Headers) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "content-type, authorization");
  return headers;
}

/* --------------------------------- Serving --------------------------------- */

serve(async (req) => {
  const headers = cors(new Headers({ "content-type": "application/json; charset=utf-8" }));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  try {
    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "payload invalide", details: parsed.error.issues }),
        { status: 400, headers },
      );
    }

    // --------------- CAS A : INDIVIDUEL via inscription_id (aligné à InscriptionCourse.jsx)
    if ("inscription_id" in parsed.data) {
      const { inscription_id, email, successUrl, cancelUrl } = parsed.data;

      // Récupérer inscription + format
      const { data: insc, error: ie } = await supabase
        .from("inscriptions")
        .select("id, format_id, prenom, nom, email, nombre_repas, prix_total_repas")
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

      // Options pending existantes
      const { data: opts } = await supabase
        .from("inscriptions_options")
        .select("option_id, quantity, prix_unitaire_cents")
        .eq("inscription_id", insc.id)
        .eq("status", "pending");

      // Construire line_items
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

      // Inscription de base
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: formatPriceCents,
          product_data: { name: `Inscription — ${format.nom}` },
        },
      });

      // Repas si présents
      if (repasQty > 0 && repasUnitCents > 0) {
        lineItems.push({
          quantity: repasQty,
          price_data: {
            currency: "eur",
            unit_amount: repasUnitCents,
            product_data: { name: "Repas" },
          },
        });
      }

      // Options sélectionnées (déjà persistées)
      for (const o of opts ?? []) {
        if (!o || !o.prix_unitaire_cents || !o.quantity) continue;
        lineItems.push({
          quantity: o.quantity,
          price_data: {
            currency: "eur",
            unit_amount: o.prix_unitaire_cents,
            product_data: { name: `Option — ${o.option_id}` },
          },
        });
      }

      // Créer session Stripe
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: lineItems,
        success_url: successUrl || `${BASE_URL}/mes-inscriptions?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${BASE_URL}/mes-inscriptions?canceled=1`,
        metadata: {
          mode: "individual",
          format_id: String(insc.format_id || ""),
          inscription_id: insc.id,
        },
      });

      // Paiement pending
      const totalAmountCents = lineItems.reduce((s, li) => s + (li.price_data?.unit_amount || 0) * (li.quantity || 1), 0);
      await supabase.from("paiements").insert({
        stripe_session_id: session.id,
        status: "pending",
        total_amount_cents: totalAmountCents,
        inscription_ids: [insc.id],
      });

      return new Response(JSON.stringify({ url: session.url }), { status: 200, headers });
    }

    // --------------- CAS B : GROUPE / RELAIS (teams ou team unique)
    const payload = parsed.data;
    const mode = normMode(payload.mode);
    if (mode === "individual") {
      // fallback si jamais "individuel" est envoyé à tort dans ce bloc
      return new Response(
        JSON.stringify({ error: "Pour le mode individuel, envoyer `inscription_id` (déjà créé côté front)." }),
        { status: 400, headers },
      );
    }

    // Normaliser teams
    const teams: z.infer<typeof TeamSchema>[] = "teams" in payload
      ? payload.teams
      : [{
          team_name: payload.team_name!,
          team_size: payload.team_size!,
          category: (payload as any).category ?? null,
          members: (payload as any).members ?? [],
        }];

    // Récup format / tarifs
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
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    for (const t of teams) {
      // créer groupe
      const { data: g, error: ge } = await supabase
        .from("inscriptions_groupes")
        .insert({
          team_name: t.team_name,
          team_size: t.team_size,
          category: t.category ?? null,
          statut: "pending",
        })
        .select("id")
        .single();
      if (ge || !g) throw new Error(`création groupe impossible (${t.team_name})`);
      createdGroupIds.push(g.id);

      // fraIS d’équipe (si > 0)
      if (teamFeeCents > 0) {
        lineItems.push({
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: teamFeeCents,
            product_data: { name: `Frais d’équipe — ${t.team_name}` },
          },
        });
      }

      // créer inscriptions membres
      const rows = t.members.map((m) => ({
        format_id: payload.format_id,
        prenom: m.prenom,
        nom: m.nom,
        email: m.email ?? null,
        genre: m.genre ?? null,
        date_naissance: m.date_naissance ?? null,
        numero_licence: m.numero_licence ?? null,
        team_name: t.team_name,
        member_of_group_id: g.id,
        statut: "pending",
      }));

      const { data: inscs, error: ie2 } = await supabase
        .from("inscriptions")
        .insert(rows)
        .select("id, prenom, nom");
      if (ie2 || !inscs) throw new Error("insertion inscriptions échouée");

      const ids = inscs.map((r: any) => r.id);
      allInscriptionIds.push(...ids);

      // line_items: inscription de base pour chaque membre
      for (const r of inscs) {
        lineItems.push({
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: formatPriceCents,
            product_data: { name: `Inscription — ${format.nom} — ${r.prenom ?? ""} ${r.nom ?? ""}`.trim() },
          },
        });
      }

      // options dupliquées sur chaque inscription (si envoyées)
      const teamOptions = payload.selected_options ?? [];
      if (teamOptions.length > 0) {
        const optionsRows: any[] = [];
        for (const inscId of ids) {
          for (const o of teamOptions) {
            optionsRows.push({
              inscription_id: inscId,
              option_id: o.option_id,
              quantity: o.quantity,
              prix_unitaire_cents: o.prix_unitaire_cents,
              status: "pending",
            });
            // et ligne Stripe
            lineItems.push({
              quantity: o.quantity,
              price_data: {
                currency: "eur",
                unit_amount: o.prix_unitaire_cents,
                product_data: { name: `Option — ${o.option_id} — ${t.team_name}` },
              },
            });
          }
        }
        if (optionsRows.length > 0) {
          const { error: ioe } = await supabase.from("inscriptions_options").insert(optionsRows);
          if (ioe) throw new Error(`insert options échouée: ${ioe.message}`);
        }
      }
    }

    // Créer session Stripe
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: payload.successUrl || `${BASE_URL}/mes-inscriptions?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: payload.cancelUrl || `${BASE_URL}/mes-inscriptions?canceled=1`,
      metadata: {
        mode,
        format_id: payload.format_id,
        groups: createdGroupIds.join(","),
      },
    });

    // Paiement pending
    const totalAmountCents = lineItems.reduce((s, li) => s + (li.price_data?.unit_amount || 0) * (li.quantity || 1), 0);
    const { data: pay, error: pe } = await supabase.from("paiements").insert({
      stripe_session_id: session.id,
      status: "pending",
      total_amount_cents: totalAmountCents,
      inscription_ids: allInscriptionIds,
    }).select("id").single();
    if (pe) {
      console.error("paiements insert error:", pe);
    } else if (createdGroupIds.length > 0 && pay?.id) {
      // Lier le paiement aux groupes
      await supabase.from("inscriptions_groupes")
        .update({ paiement_id: pay.id })
        .in("id", createdGroupIds);
    }

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers });
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: "payload invalide", details: String(e?.message ?? e) }),
      { status: 400, headers },
    );
  }
});

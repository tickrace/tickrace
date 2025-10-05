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
  trace_id: z.string().optional(), // 👈 ajouté pour pouvoir renvoyer un param alternatif si tu veux
});

const GroupRelaySchemaBase = z.object({
  mode: z.string(), // FR/EN
  format_id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
  course_id: z.string().uuid().optional(),
  email: z.string().email().optional(), // email payeur (pré-remplissage Checkout)
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
  return m ? "team" : "individual";
}

// Ajoute automatiquement ?session_id={CHECKOUT_SESSION_ID} si absent
function ensureSuccessUrl(u?: string, traceId?: string) {
  if (!u || u.trim() === "") return `${BASE_URL}/mes-inscriptions?session_id={CHECKOUT_SESSION_ID}`;
  if (u.includes("{CHECKOUT_SESSION_ID}")) return u;
  const sep = u.includes("?") ? "&" : "?";
  // On privilégie session_id (ta page merci accepte session_id OU trace_id)
  return `${u}${sep}session_id={CHECKOUT_SESSION_ID}`;
}
function ensureCancelUrl(u?: string) {
  if (!u || u.trim() === "") return `${BASE_URL}/mes-inscriptions?canceled=1`;
  return u;
}

/* --------------------------------- Serving --------------------------------- */

serve(async (req) => {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "content-type, authorization");
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

    // -------- A) INDIVIDUEL via inscription_id (aligné avec InscriptionCourse.jsx)
    if ("inscription_id" in parsed.data) {
      const { inscription_id, email, successUrl, cancelUrl, trace_id } = parsed.data;

      // Récupérer inscription + format
      const { data: insc, error: ie } = await supabase
        .from("inscriptions")
        .select("id, format_id, prenom, nom, email, nombre_repas")
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
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: formatPriceCents,
          product_data: { name: `Inscription — ${format.nom}` },
        },
      });
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

      const payerEmail = email || insc.email || undefined;
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: lineItems,
        customer_email: payerEmail,                            // 👈 pré-remplir l’email
        payment_intent_data: payerEmail ? { receipt_email: payerEmail } : undefined, // 👈 reçu Stripe
        success_url: ensureSuccessUrl(successUrl, trace_id),   // 👈 garantit ?session_id=...
        cancel_url: ensureCancelUrl(cancelUrl),
        metadata: {
          mode: "individual",
          format_id: String(insc.format_id || ""),
          inscription_id: insc.id,
          trace_id: trace_id || "",
        },
      });

      const totalAmountCents = lineItems.reduce((s, li) => s + (li.price_data?.unit_amount || 0) * (li.quantity || 1), 0);
      await supabase.from("paiements").insert({
        stripe_session_id: session.id,
        status: "pending",
        total_amount_cents: totalAmountCents,
        inscription_ids: [insc.id],
      });

      return new Response(JSON.stringify({ url: session.url }), { status: 200, headers });
    }

    // -------- B) GROUPE / RELAIS
    const payload = parsed.data;
    const mode = normMode((payload as any).mode);
    if (mode === "individual") {
      return new Response(
        JSON.stringify({ error: "Pour le mode individuel, envoyer `inscription_id` (déjà créé côté front)." }),
        { status: 400, headers },
      );
    }

    const teams: z.infer<typeof TeamSchema>[] = "teams" in payload
      ? (payload as any).teams
      : [{
          team_name: (payload as any).team_name!,
          team_size: (payload as any).team_size!,
          category: (payload as any).category ?? null,
          members: (payload as any).members ?? [],
        }];

    const { data: format, error: fe2 } = await supabase
      .from("formats")
      .select("id, nom, prix, prix_equipe")
      .eq("id", (payload as any).format_id)
      .single();
    if (fe2 || !format) throw new Error("format introuvable");

    const formatPriceCents = Math.round((Number(format.prix) || 0) * 100);
    const teamFeeCents = Math.round((Number(format.prix_equipe) || 0) * 100);

    const allInscriptionIds: string[] = [];
    const createdGroupIds: string[] = [];
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    for (const t of teams) {
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

      const rows = t.members.map((m) => ({
        format_id: (payload as any).format_id,
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

      const teamOptions = (payload as any).selected_options ?? [];
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

    const payerEmail = (payload as any).email || undefined;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: payerEmail,                                              // 👈 pré-remplir l’email
      payment_intent_data: payerEmail ? { receipt_email: payerEmail } : undefined, // 👈 reçu Stripe
      success_url: ensureSuccessUrl((payload as any).successUrl),
      cancel_url: ensureCancelUrl((payload as any).cancelUrl),
      metadata: {
        mode,
        format_id: (payload as any).format_id,
        groups: createdGroupIds.join(","),
      },
    });

    const totalAmountCents = lineItems.reduce((s, li) => s + (li.price_data?.unit_amount || 0) * (li.quantity || 1), 0);
    const { data: pay, error: pe } = await supabase.from("paiements").insert({
      stripe_session_id: session.id,
      status: "pending",
      total_amount_cents: totalAmountCents,
      inscription_ids: allInscriptionIds,
    }).select("id").single();
    if (!pe && pay?.id && createdGroupIds.length > 0) {
      await supabase
        .from("inscriptions_groupes")
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

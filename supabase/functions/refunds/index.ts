// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0&pin=v135";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0&pin=v135";

console.log("BUILD refunds 2025-09-22T22:10Z");

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const ALLOWLIST = ["https://www.tickrace.com","http://localhost:5173","http://127.0.0.1:5173"];

function buildCorsHeaders(req: Request) {
  const origin = req.headers.get("origin");
  const allowOrigin = origin && ALLOWLIST.includes(origin) ? origin : ALLOWLIST[0];
  const reqMethod = req.headers.get("access-control-request-method") || "POST";
  const reqHeaders =
    req.headers.get("access-control-request-headers") ||
    "authorization, x-client-info, apikey, content-type, prefer";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": `${reqMethod}, OPTIONS`,
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}

const isUUID = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v as string);

type QuoteResult = {
  amount_total_cents: number;
  non_refundable_cents: number;
  base_cents: number;
  percent: number;
  refund_cents: number;
  days_before: number | null;
  mode: "individuel" | "groupe" | "relais";
  context?: "member_share" | "full";
};

function daysBetweenTodayAnd(dateISO?: string | null): number | null {
  if (!dateISO) return null;
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function tierPercent(days: number | null): number {
  if (days === null) return 0;
  if (days > 30) return 90;
  if (days >= 15) return 50;
  if (days >= 7) return 25;
  return 0;
}

function clampCents(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

serve(async (req) => {
  const headers = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers });

  try {
    const body = await req.json();
    const { action } = body || {};
    if (!action || !["quote", "confirm"].includes(action)) {
      return new Response(JSON.stringify({ error: "action requis: 'quote' ou 'confirm'" }), { status: 400, headers });
    }

    // Entrées possibles
    const inscription_id: string | undefined = body?.inscription_id;
    const modeIn: "individuel" | "groupe" | "relais" | undefined = body?.mode;
    const inscription_ids: string[] | undefined = body?.inscription_ids;
    const reason: string | undefined = body?.reason || undefined;

    if (!isUUID(inscription_id)) {
      return new Response(JSON.stringify({ error: "inscription_id invalide" }), { status: 400, headers });
    }

    // 1) Récupérer l'inscription et le format (pour la date de l'épreuve)
    const { data: insc, error: insErr } = await supabase
      .from("inscriptions")
      .select("id, format_id, groupe_id, statut")
      .eq("id", inscription_id)
      .single();

    if (insErr || !insc) {
      return new Response(JSON.stringify({ error: "Inscription introuvable" }), { status: 404, headers });
    }

    const { data: fmt } = await supabase
      .from("formats")
      .select("id, date")
      .eq("id", insc.format_id)
      .maybeSingle();

    const days = daysBetweenTodayAnd(fmt?.date ?? null);
    const percent = tierPercent(days);

    // 2) Retrouver le paiement lié
    //    - individuel: paiement avec inscription_id = this
    //    - équipe/relais: paiement où inscription_ids contient this + type groupe|relais
    let paiement: any | null = null;
    let mode: "individuel" | "groupe" | "relais" = "individuel";

    // Essai individuel
    let { data: payInd } = await supabase
      .from("paiements")
      .select("id, type, amount_total, amount_subtotal, stripe_payment_intent_id, fee_total, platform_fee_amount, inscription_id, inscription_ids, options_total_eur")
      .eq("inscription_id", inscription_id)
      .maybeSingle();

    if (payInd?.id) {
      paiement = payInd;
      mode = "individuel";
    } else {
      // Essai équipe
      const { data: payTeam } = await supabase
        .from("paiements")
        .select("id, type, amount_total, amount_subtotal, stripe_payment_intent_id, fee_total, platform_fee_amount, inscription_id, inscription_ids, options_total_eur")
        .contains("inscription_ids", [inscription_id])
        .maybeSingle();

      if (payTeam?.id && (payTeam.type === "groupe" || payTeam.type === "relais")) {
        paiement = payTeam;
        mode = payTeam.type;
      }
    }

    if (!paiement?.id) {
      return new Response(JSON.stringify({ error: "Paiement introuvable pour cette inscription" }), { status: 404, headers });
    }

    const amount_total_cents = clampCents(paiement.amount_total ?? paiement.amount_subtotal ?? 0);
    const stripeFees_cents   = clampCents(paiement.fee_total ?? 0);
    const platformFees_cents = clampCents(paiement.platform_fee_amount ?? 0);
    const non_refundable_total_cents = clampCents(stripeFees_cents + platformFees_cents);

    let base_cents = 0;
    let refund_cents = 0;
    let context: QuoteResult["context"] = "full";

    if (mode === "individuel") {
      // Individuel : on applique entièrement les frais non remboursables
      base_cents = clampCents(amount_total_cents - non_refundable_total_cents);
      refund_cents = clampCents(base_cents * (percent / 100));
    } else {
      // Équipe/Relais : on calcule la PART du membre
      const ids: string[] = Array.isArray(paiement.inscription_ids) ? paiement.inscription_ids : [];
      const membersCount = Math.max(1, ids.length);

      // Options d'équipe éventuelles (si colonne présente)
      const options_total_eur = Number(paiement.options_total_eur || 0);
      const options_total_cents = clampCents(options_total_eur * 100);

      // Part du "montant payé hors options d'équipe"
      const team_base_cents = clampCents(amount_total_cents - options_total_cents);
      const member_gross_cents = Math.floor(team_base_cents / membersCount);

      // Répartition proportionnelle des frais non remboursables
      const ratio = team_base_cents > 0 ? (member_gross_cents / team_base_cents) : 0;
      const member_non_ref_cents = clampCents(non_refundable_total_cents * ratio);

      base_cents = clampCents(member_gross_cents - member_non_ref_cents);
      refund_cents = clampCents(base_cents * (percent / 100));
      context = "member_share";
    }

    const quote: QuoteResult = {
      amount_total_cents,
      non_refundable_cents: (mode === "individuel") ? non_refundable_total_cents : clampCents(non_refundable_total_cents * (base_cents > 0 ? ( (base_cents / (percent ? (refund_cents / (percent/100)) : base_cents)) ) : 0 )), // info indicative
      base_cents,
      percent,
      refund_cents,
      days_before: days,
      mode,
      context,
    };

    if (action === "quote") {
      return new Response(JSON.stringify({ ok: true, quote }), { status: 200, headers });
    }

    // action === "confirm"
    if (refund_cents <= 0) {
      return new Response(JSON.stringify({ error: "Aucun remboursement dû selon le barème" }), { status: 400, headers });
    }

    // Récupération du PI pour rembourser
    const piId = String(paiement.stripe_payment_intent_id || "");
    if (!piId) {
      return new Response(JSON.stringify({ error: "PaymentIntent introuvable pour ce paiement" }), { status: 404, headers });
    }

    // IMPORTANT : éviter multi-remboursements — on peut vérifier l'historique Stripe
    try {
      // Création du remboursement (partiel si équipe, total/partiel si individuel)
      const refund = await stripe.refunds.create({
        payment_intent: piId,
        amount: refund_cents,
        reason: (reason ? "requested_by_customer" : undefined) as any,
        metadata: {
          inscription_id,
          mode,
          percent: String(percent),
          base_cents: String(base_cents),
          computed_refund_cents: String(refund_cents),
          reason_note: reason || "",
        },
      });

      // Mettre l’inscription à annulé(e)
      await supabase
        .from("inscriptions")
        .update({ statut: "annulé" })
        .eq("id", inscription_id);

      // Optionnel : journaliser (si une table existe). Ici on tente une table 'refunds_log' si elle existe.
      try {
        await supabase.from("refunds_log").insert({
          inscription_id,
          paiement_id: paiement.id,
          stripe_refund_id: refund.id,
          refund_amount_cents: refund_cents,
          percent_applied: percent,
          mode,
          created_at: new Date().toISOString(),
          reason: reason || null,
        });
      } catch (_e) { /* table optionnelle */ }

      return new Response(JSON.stringify({
        ok: true,
        refund_id: refund.id,
        refund_cents,
        quote,
      }), { status: 200, headers });

    } catch (e: any) {
      console.error("Stripe refund error:", e?.message ?? e);
      return new Response(JSON.stringify({ error: e?.message ?? "Erreur Stripe lors du remboursement" }), { status: 500, headers });
    }

  } catch (e: any) {
    console.error("refunds error:", e?.message ?? e, e?.stack);
    const debug = Deno.env.get("DEBUG") === "1";
    return new Response(JSON.stringify({ error: debug ? (e?.message ?? "Erreur serveur") : "Erreur serveur" }), { status: 500, headers });
  }
});

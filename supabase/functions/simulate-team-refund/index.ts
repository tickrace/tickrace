// supabase/functions/simulate-team-refund/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TICKRACE_BASE_URL =
  Deno.env.get("TICKRACE_BASE_URL") || "https://www.tickrace.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/* --------------------------- CORS helper --------------------------- */
function cors(h = new Headers()) {
  h.set("Access-Control-Allow-Origin", "*"); // tu peux restreindre à https://www.tickrace.com si tu veux
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set(
    "Access-Control-Allow-Headers",
    "authorization, apikey, content-type, x-client-info, x-client-authorization, x-supabase-authorization",
  );
  h.set("content-type", "application/json; charset=utf-8");
  h.set("Vary", "Origin");
  return h;
}

/* --------------------- Politique de remboursement ------------------ */

function computeDaysBefore(eventDate: Date | null): number | null {
  if (!eventDate) return null;
  const now = new Date();
  const diffMs = eventDate.getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Politique simplifiée pour la simulation, à aligner avec calculer_credit_annulation
 */
function getPolicyForDays(daysBefore: number | null) {
  if (daysBefore === null) {
    return { policy_tier: "inconnue", percent: 0 };
  }
  if (daysBefore >= 30) {
    return { policy_tier: "J-30+", percent: 90 };
  }
  if (daysBefore >= 15) {
    return { policy_tier: "J-15-29", percent: 70 };
  }
  if (daysBefore >= 7) {
    return { policy_tier: "J-7-14", percent: 50 };
  }
  if (daysBefore >= 3) {
    return { policy_tier: "J-3-6", percent: 30 };
  }
  if (daysBefore >= 1) {
    return { policy_tier: "J-1-2", percent: 10 };
  }
  return { policy_tier: "Jour J", percent: 0 };
}

/* ---------------------------- Handler ------------------------------ */

serve(async (req) => {
  const headers = cors();

  // Préflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers,
    });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.groupe_id) {
      return new Response(
        JSON.stringify({
          error: "missing_groupe_id",
          message: "Paramètre groupe_id requis.",
        }),
        { status: 400, headers },
      );
    }

    const groupeId = String(body.groupe_id);

    // 1) Charger le groupe
    const { data: group, error: groupError } = await supabase
      .from("inscriptions_groupes")
      .select("*")
      .eq("id", groupeId)
      .maybeSingle();

    if (groupError) {
      console.error("SIM_TEAM_REFUND_GROUP_ERROR", groupError);
      return new Response(
        JSON.stringify({ error: "group_fetch_failed", details: groupError.message }),
        { status: 500, headers },
      );
    }

    if (!group) {
      return new Response(
        JSON.stringify({
          error: "group_not_found",
          message: "Aucun groupe trouvé pour cet id.",
        }),
        { status: 404, headers },
      );
    }

    // 2) Charger le format + course (pour la date de l’épreuve)
    const { data: format, error: formatError } = await supabase
      .from("formats")
      .select(
        `
        id,
        date,
        prix,
        prix_equipe,
        course:course_id (
          id,
          nom,
          lieu
        )
      `,
      )
      .eq("id", group.format_id)
      .maybeSingle();

    if (formatError) {
      console.error("SIM_TEAM_REFUND_FORMAT_ERROR", formatError);
    }

    const eventDateStr = format?.date ?? null;
    const eventDate = eventDateStr ? new Date(eventDateStr) : null;
    const daysBefore = computeDaysBefore(eventDate);
    const { policy_tier, percent } = getPolicyForDays(daysBefore);

    // 3) Charger les inscriptions membres du groupe
    const { data: members, error: membersError } = await supabase
      .from("inscriptions")
      .select(
        "id, statut, prix_total_coureur, prix_total_repas, format_id, course_id",
      )
      .or(`groupe_id.eq.${groupeId},member_of_group_id.eq.${groupeId}`);

    if (membersError) {
      console.error("SIM_TEAM_REFUND_MEMBERS_ERROR", membersError);
    }

    const membersCount = (members ?? []).length;

    // 4) Charger le paiement lié au groupe si présent
    let paiement: any = null;
    if (group.paiement_id) {
      const { data: pay, error: payError } = await supabase
        .from("paiements")
        .select("*")
        .eq("id", group.paiement_id)
        .maybeSingle();

      if (payError) {
        console.error("SIM_TEAM_REFUND_PAYMENT_ERROR", payError);
      } else {
        paiement = pay;
      }
    }

    // 5) Charger les options liées aux inscriptions membres
    let options: any[] = [];
    if (members && members.length > 0) {
      const memberIds = members.map((m) => m.id);
      const { data: opts, error: optsError } = await supabase
        .from("inscriptions_options")
        .select("*")
        .in("inscription_id", memberIds);

      if (optsError) {
        console.error("SIM_TEAM_REFUND_OPTIONS_ERROR", optsError);
      } else {
        options = opts || [];
      }
    }

    // 6) Déterminer le montant total de base (en cents)
    let base_cents = 0;

    if (paiement) {
      // 🔥 ICI : on utilise en priorité total_amount_cents (ton cas),
      // puis fallback sur amount_total_cents / montant_total_cents
      const baseFromPayment = Number(
        paiement.total_amount_cents ??
          paiement.amount_total_cents ??
          paiement.montant_total_cents ??
          0,
      );
      base_cents = Number.isFinite(baseFromPayment) ? baseFromPayment : 0;
    } else {
      // Fallback : on estime à partir du format + membres + options
      const prixIndiv = Number(format?.prix ?? 0) * 100; // si stocké en €
      const prixEquipe = Number(format?.prix_equipe ?? 0) * 100;
      const nbMembres = membersCount;

      // Base = prix d’équipe + N * prix individuel
      base_cents = prixEquipe + nbMembres * prixIndiv;

      // Ajout des options
      const optionsTotal = options.reduce((acc: number, o: any) => {
        const q = Number(o.quantity ?? 0);
        const pu = Number(o.prix_unitaire_cents ?? 0);
        return acc + q * pu;
      }, 0);

      base_cents += optionsTotal;
    }

    if (!Number.isFinite(base_cents) || base_cents < 0) {
      base_cents = 0;
    }

    // 7) Simulation du remboursement selon la politique
    const refund_cents = Math.round((base_cents * percent) / 100);
    const non_refundable_cents = base_cents - refund_cents;

    const responsePayload = {
      ok: true,
      groupe_id: groupeId,
      policy: {
        policy_tier,
        percent,
        days_before: daysBefore,
      },
      amounts: {
        amount_total_cents: base_cents,
        base_cents,
        refund_cents,
        non_refundable_cents,
      },
      group: {
        id: group.id,
        format_id: group.format_id,
        nom_groupe: group.nom_groupe,
        team_name: group.team_name,
        team_size: group.team_size,
        statut: group.statut,
        capitaine_user_id: group.capitaine_user_id,
        created_at: group.created_at,
        updated_at: group.updated_at,
        team_category: group.team_category,
        members_count: group.members_count,
      },
      format: format
        ? {
            id: format.id,
            date: format.date,
            prix: format.prix,
            prix_equipe: format.prix_equipe,
            course: format.course || null,
          }
        : null,
      paiement: paiement
        ? {
            id: paiement.id,
            status: paiement.status ?? null,
            total_amount_cents:
              paiement.total_amount_cents ??
              paiement.amount_total_cents ??
              paiement.montant_total_cents ??
              null,
          }
        : null,
      members: members || [],
      options,
      meta: {
        base_url: TICKRACE_BASE_URL,
      },
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error("SIM_TEAM_REFUND_FATAL", e);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: e instanceof Error ? e.message : String(e),
      }),
      {
        status: 500,
        headers,
      },
    );
  }
});

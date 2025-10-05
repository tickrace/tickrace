// supabase/functions/payment-summary/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// CORS helper — autorise authorization + autres headers fréquents
function corsHeaders() {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  h.set("Access-Control-Allow-Headers", "authorization, content-type, x-client-info, apikey");
  h.set("Access-Control-Max-Age", "86400");
  h.set("content-type", "application/json; charset=utf-8");
  return h;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders() });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    // Répond au préflight avec les bons headers
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "GET") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id") || "";

    if (!sessionId) {
      return json({ error: "missing_session_id" }, 400);
    }

    // Paiement par session_id
    const pay = await supabase
      .from("paiements")
      .select("id, stripe_session_id, total_amount_cents, status, inscription_ids, created_at")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (pay.error) {
      console.error("PAYMENT_LOOKUP_ERROR", pay.error);
      return json({ error: "lookup_failed" }, 500);
    }
    if (!pay.data) {
      return json({ error: "not_found" }, 404);
    }

    const inscriptionIds: string[] = pay.data.inscription_ids || [];

    // Inscriptions
    let inscriptions: any[] = [];
    if (inscriptionIds.length) {
      const insRes = await supabase
        .from("inscriptions")
        .select("id, nom, prenom, email, team_name, statut, member_of_group_id")
        .in("id", inscriptionIds);
      if (insRes.error) {
        console.error("INSCRIPTIONS_QUERY_ERROR", insRes.error);
      } else {
        inscriptions = insRes.data || [];
      }
    }

    // Groupes liés
    const groupIds = [...new Set(inscriptions.map((i) => i.member_of_group_id).filter(Boolean))] as string[];
    let groupes: any[] = [];
    if (groupIds.length) {
      const gr = await supabase
        .from("inscriptions_groupes")
        .select("id, nom_groupe, team_name, team_name_public, statut, team_category, members_count")
        .in("id", groupIds);
      if (gr.error) {
        console.error("GROUPS_QUERY_ERROR", gr.error);
      } else {
        groupes = gr.data || [];
      }
    }

    return json({
      payment: {
        session_id: pay.data.stripe_session_id,
        total_amount_cents: pay.data.total_amount_cents,
        status: pay.data.status,
        created_at: pay.data.created_at,
      },
      inscriptions,
      groupes,
    });
  } catch (e) {
    console.error("PAYMENT_SUMMARY_FATAL", e);
    return json({ error: "failed", details: String(e?.message ?? e) }, 500);
  }
});

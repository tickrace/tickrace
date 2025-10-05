// supabase/functions/payment-summary/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function cors(h = new Headers()) {
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  h.set("Access-Control-Allow-Headers", "content-type");
  h.set("content-type", "application/json; charset=utf-8");
  return h;
}

serve(async (req) => {
  const headers = cors();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id") || "";

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "missing_session_id" }), { status: 400, headers });
    }

    // Paiement
    const pay = await supabase
      .from("paiements")
      .select("id, stripe_session_id, total_amount_cents, status, inscription_ids, created_at")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (pay.error || !pay.data) {
      return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers });
    }

    const inscriptionIds: string[] = pay.data.inscription_ids || [];

    // Inscriptions
    let inscriptions: any[] = [];
    if (inscriptionIds.length) {
      const insRes = await supabase
        .from("inscriptions")
        .select("id, nom, prenom, email, team_name, statut, member_of_group_id")
        .in("id", inscriptionIds);
      if (!insRes.error) inscriptions = insRes.data || [];
    }

    // Groupes (s'il y en a)
    const groupIds = [...new Set(inscriptions.map((i) => i.member_of_group_id).filter(Boolean))] as string[];
    let groupes: any[] = [];
    if (groupIds.length) {
      const gr = await supabase
        .from("inscriptions_groupes")
        .select("id, nom_groupe, team_name, team_name_public, statut, team_category, members_count")
        .in("id", groupIds);
      if (!gr.error) groupes = gr.data || [];
    }

    return new Response(JSON.stringify({
      payment: {
        session_id: pay.data.stripe_session_id,
        total_amount_cents: pay.data.total_amount_cents,
        status: pay.data.status,
        created_at: pay.data.created_at,
      },
      inscriptions,
      groupes,
    }), { status: 200, headers });
  } catch (e) {
    console.error("PAYMENT_SUMMARY_FATAL", e);
    return new Response(JSON.stringify({ error: "failed", details: String(e?.message ?? e) }), {
      status: 500,
      headers,
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*", // ou remplace * par "https://www.tickrace.com"
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const { id } = await req.json();

    if (!id) {
      return new Response(JSON.stringify({ error: "Missing inscription ID" }), {
        status: 400,
        headers,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: inscription, error: fetchError } = await supabase
      .from("inscriptions")
      .select("id, statut")
      .eq("id", id)
      .single();

    if (fetchError || !inscription) {
      return new Response(JSON.stringify({ error: "Inscription introuvable" }), {
        status: 404,
        headers,
      });
    }

    if (inscription.statut === "annulé") {
      return new Response(JSON.stringify({ error: "Déjà annulé" }), {
        status: 400,
        headers,
      });
    }

    const { error: funcError } = await supabase.rpc(
      "calculer_credit_annulation",
      { p_inscription_id: id }
    );

    if (funcError) {
      console.error(funcError);
      return new Response(JSON.stringify({ error: "Erreur fonction SQL" }), {
        status: 500,
        headers,
      });
    }

    const { error: updateError } = await supabase
      .from("inscriptions")
      .update({ statut: "annulé" })
      .eq("id", id);

    if (updateError) {
      console.error(updateError);
      return new Response(JSON.stringify({ error: "Erreur mise à jour" }), {
        status: 500,
        headers,
      });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Erreur inattendue" }), {
      status: 500,
      headers,
    });
  }
});

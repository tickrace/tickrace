// supabase/functions/annuler_inscription/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Réponse aux requêtes OPTIONS (prévol CORS)
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
      },
    });
  }

  try {
    const { inscription_id } = await req.json();

    if (!inscription_id) {
      return new Response(JSON.stringify({ error: "Paramètre inscription_id manquant." }), {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: {
            Authorization: req.headers.get("Authorization") ?? "",
            "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
            "x-client-info": req.headers.get("x-client-info") ?? "",
          },
        },
      }
    );

    const { error } = await supabase.rpc("calculer_credit_annulation", {
      p_inscription_id: inscription_id,
    });

    if (error) {
      return new Response(JSON.stringify({ error: "Erreur RPC Supabase : " + error.message }), {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return new Response(
      JSON.stringify({ message: "Annulation traitée avec succès." }),
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur serveur : " + e.message }), {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});

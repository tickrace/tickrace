// supabase/functions/annuler_inscription/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
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
    console.log("🔁 Requête reçue dans annuler_inscription");
    const { inscription_id } = await req.json();
    console.log("📦 Données reçues :", inscription_id);

    if (!inscription_id) {
      return new Response(JSON.stringify({
        error: "Paramètre inscription_id manquant.",
      }), {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    console.log("🔧 Client Supabase initialisé");

    const { data: credit_id, error: creditError } = await supabase.rpc("calculer_credit_annulation", {
      p_inscription_id: inscription_id,
    });

    if (creditError || !credit_id) {
      console.error("❌ Erreur RPC calcul_credit_annulation :", creditError?.message);
      return new Response(JSON.stringify({
        error: "Erreur RPC Supabase : " + (creditError?.message ?? "credit_id nul"),
      }), {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    console.log("✅ RPC exécuté avec succès, credit_id =", credit_id);

    const refundResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/rembourser_credit_annulation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
        },
        body: JSON.stringify({ credit_id }),
      }
    );

    console.log("🔁 Appel refund effectué");

    if (!refundResponse.ok) {
      const refundErrorText = await refundResponse.text();
      console.error("❌ Erreur remboursement :", refundErrorText);
      return new Response(JSON.stringify({
        error: "Erreur remboursement Stripe : " + refundErrorText,
      }), {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    console.log("✅ Remboursement terminé");

    return new Response(JSON.stringify({
      message: "Annulation et remboursement OK.",
    }), {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    const errMessage = typeof e === "object" && e !== null && "message" in e ? e.message : String(e);
    console.error("💥 Erreur générale :", errMessage);
    return new Response(JSON.stringify({
      error: "Erreur serveur : " + errMessage,
    }), {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});

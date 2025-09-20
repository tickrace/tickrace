// supabase/functions/refund-inscription/index.ts
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const ALLOWLIST = ["https://www.tickrace.com","http://localhost:5173","http://127.0.0.1:5173"];
function cors(origin: string | null) {
  const allowed = origin && ALLOWLIST.includes(origin) ? origin : ALLOWLIST[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}

serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "MÃ©thode non autorisÃ©e" }), { status: 405, headers });

  try {
    const { inscription_id } = await req.json();
    if (!inscription_id) return new Response(JSON.stringify({ error: "inscription_id manquant" }), { status: 400, headers });

    // 1) RÃ©cupÃ©rer la charge Stripe liÃ©e Ã  lâ€™inscription
    const { data: pay } = await supabase
      .from("paiements")
      .select("id, charge_id")
      .eq("inscription_id", inscription_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!pay?.charge_id) {
      return new Response(JSON.stringify({ error: "Aucun paiement Stripe (charge_id) pour cette inscription." }), { status: 404, headers });
    }

    // 2) Calcul du montant Ã  rembourser (95 % sur la part orga)
    //    -> si tu as dÃ©jÃ  ta fonction SQL, on lâ€™appelle, sinon on reconstruit ici.
    // Ici on suppose que tu as ta fonction SQL calculer_credit_annulation(uuid)
    const { data: creditRow, error: creditErr } = await supabase
      .rpc("calculer_credit_annulation", { p_inscription_id: inscription_id }); // adapte le param selon ta signature
    if (creditErr) {
      return new Response(JSON.stringify({ error: "Erreur RPC calcul remboursement", details: creditErr.message }), { status: 500, headers });
    }

    // Attendu: creditRow.montant_rembourse dÃ©jÃ  en â‚¬ selon ta rÃ¨gle (95% orga)
    const montantRemEnEuros = Number(creditRow?.montant_rembourse ?? 0);
    const amount_cents = Math.max(0, Math.round(montantRemEnEuros * 100));
    if (amount_cents <= 0) {
      return new Response(JSON.stringify({ error: "Montant de remboursement nul" }), { status: 400, headers });
    }

    // 3) Refund Stripe SANS refund de l'application fee, AVEC reverse du transfert
    const refund = await stripe.refunds.create({
      charge: pay.charge_id,
      amount: amount_cents,
      reverse_transfer: true,        // rÃ©cupÃ¨re sur le compte connectÃ©
      refund_application_fee: false, // ne rembourse PAS la commission Tickrace (5%)
    });

    // 4) Mettre lâ€™inscription Ã  "remboursÃ©" + lien vers paiement/credit si besoin
    await supabase.from("inscriptions").update({ statut: "remboursÃ©" }).eq("id", inscription_id);

    // (Optionnel) si ta RPC renvoie un id de credit, on peut lier au paiement remboursement
    // await supabase.from("credits_annulation").update({ paiement_id: pay.id }).eq("id", creditRow.id);

    return new Response(JSON.stringify({ ok: true, refund }), { headers });
  } catch (e: any) {
    console.error("refund-inscription error:", e?.message ?? e);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500, headers });
  }
});

// hard guard
try { (globalThis | Out-Null) } catch {} // keep file non-empty

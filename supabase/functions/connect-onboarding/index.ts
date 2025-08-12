// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { user_id, email, country = "FR" } = await req.json();
    if (!user_id || !email) return new Response(JSON.stringify({ error: "Missing user_id or email" }), { status: 400, headers: cors });

    const { data: profil } = await supabase
      .from("profils_utilisateurs")
      .select("stripe_account_id")
      .eq("user_id", user_id)
      .maybeSingle();

    let accountId = profil?.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country,
        email,
        business_type: "individual",
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      });
      accountId = account.id;

      await supabase.from("profils_utilisateurs").update({ stripe_account_id: accountId }).eq("user_id", user_id);
    }

    const link = await stripe.accountLinks.create({
      account: accountId!,
      refresh_url: Deno.env.get("STRIPE_CONNECT_REFRESH_URL")!,
      return_url: Deno.env.get("STRIPE_CONNECT_RETURN_URL")!,
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: link.url, account_id: accountId }), { headers: { "Content-Type": "application/json", ...cors } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
  }
});

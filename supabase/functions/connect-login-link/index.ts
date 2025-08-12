// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const ALLOWLIST = [
  "https://www.tickrace.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function cors(origin: string | null) {
  const allowed = origin && ALLOWLIST.includes(origin) ? origin : ALLOWLIST[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}

serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers });
  }

  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id manquant" }), { status: 400, headers });
    }

    // Récup stripe_account_id
    const { data: profil, error } = await supabase
      .from("profils_utilisateurs")
      .select("stripe_account_id, email")
      .eq("user_id", user_id)
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ error: "Profil introuvable" }), { status: 404, headers });
    }
    if (!profil?.stripe_account_id) {
      return new Response(JSON.stringify({
        error: "Aucun compte Stripe Connect configuré.",
        code: "ORGANISER_STRIPE_NOT_CONFIGURED",
      }), { status: 409, headers });
    }

    // Optionnel: redirection post-login
    const redirectUrl = Deno.env.get("STRIPE_EXPRESS_RETURN_URL") || undefined;

    const link = await stripe.accounts.createLoginLink(profil.stripe_account_id, {
      redirect_url: redirectUrl,
    });

    return new Response(JSON.stringify({ url: link.url }), { status: 200, headers });
  } catch (e: any) {
    console.error("connect-login-link error:", e?.message ?? e);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500, headers });
  }
});

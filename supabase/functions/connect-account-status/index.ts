// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno&deno-std=0.192.0
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const ALLOW = ["https://www.tickrace.com", "http://localhost:5173", "http://127.0.0.1:5173"];
function cors(o: string | null) {
  const origin = o && ALLOW.includes(o) ? o : ALLOW[0];
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}

async function requireUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!jwt) return null;
  const { data } = await supabase.auth.getUser(jwt);
  return data?.user ?? null;
}

serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  const user = await requireUser(req);
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

  try {
    const { data: profil } = await supabase
      .from("profils_utilisateurs")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profil?.stripe_account_id) {
      return new Response(JSON.stringify({ has_account: false }), { status: 200, headers });
    }

    const acct = await stripe.accounts.retrieve(profil.stripe_account_id);
    const payload = {
      has_account: true,
      charges_enabled: acct.charges_enabled,
      payouts_enabled: acct.payouts_enabled,
      details_submitted: acct.details_submitted,
      requirements_due: acct.requirements?.currently_due ?? [],
    };

    await supabase
      .from("profils_utilisateurs")
      .update({
        stripe_charges_enabled: payload.charges_enabled,
        stripe_payouts_enabled: payload.payouts_enabled,
        stripe_details_submitted: payload.details_submitted,
        stripe_requirements_due: payload.requirements_due as any,
      })
      .eq("user_id", user.id);

    return new Response(JSON.stringify(payload), { status: 200, headers });
  } catch (e: any) {
    console.error("connect-account-status error:", e?.message ?? e);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500, headers });
  }
});

// hard guard
try { (globalThis | Out-Null) } catch {} // keep file non-empty

// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

// CORS local (pas d'import)
function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allow = ["https://www.tickrace.com","http://localhost:5173","http://127.0.0.1:5173"].includes(origin) ? origin : "*";
  const reqHdrs = req.headers.get("access-control-request-headers") || "authorization, content-type";
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": reqHdrs,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };
}

serve(async (req) => {
  // 1) Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: corsHeaders(req) });
  }

  // 2) (sécurité) lecture JWT + vérif admin via table admins
  try {
    const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders(req) });
    }
    const token = auth.split(" ")[1];

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: { user }, error: uerr } = await supabase.auth.getUser(token);
    if (uerr || !user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders(req) });
    }

    const { data: row, error: aerr } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (aerr) return new Response("Forbidden", { status: 403, headers: corsHeaders(req) });
    if (!row) return new Response("Forbidden", { status: 403, headers: corsHeaders(req) });

    // 3) Réponse minimaliste (pour valider CORS)
    const payload = { ok: true, ping: "admin-stats", user_id: user.id };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json", ...corsHeaders(req) },
    });

  } catch (e) {
    return new Response("Unexpected error", { status: 500, headers: corsHeaders(req) });
  }
});

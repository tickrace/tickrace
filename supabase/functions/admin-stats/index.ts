// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { assertIsAdmin } from "../_shared/isAdmin.ts";

// --- CORS helpers ---
const ALLOWED_ORIGINS = new Set([
  "https://www.tickrace.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "*";
  const reqHeaders = req.headers.get("access-control-request-headers") || "authorization, content-type";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };
}

serve(async (req) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: corsHeaders(req) });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    await assertIsAdmin(req, supabase);

    const { data, error } = await supabase
      .from("admin_stats")
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "content-type": "application/json", ...corsHeaders(req) },
    });
  } catch (err) {
    return new Response(err.message ?? "Unexpected error", {
      status: 500,
      headers: corsHeaders(req),
    });
  }
});

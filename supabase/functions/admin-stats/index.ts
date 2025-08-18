// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

// CORS minimal local
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

serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: corsHeaders(req) });
  }
  return new Response(JSON.stringify({ ok: true, ping: "admin-stats-lite" }), {
    status: 200,
    headers: { "content-type": "application/json", ...corsHeaders(req) },
  });
});

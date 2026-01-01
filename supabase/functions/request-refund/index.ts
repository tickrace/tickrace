// supabase/functions/request-refund/index.ts
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// CORS cohérent avec le projet
const ALLOWLIST = ["https://www.tickrace.com", "http://localhost:5173", "http://127.0.0.1:5173"];

function cors(req: Request) {
  const o = req.headers.get("origin");
  const allow = o && ALLOWLIST.includes(o) ? o : ALLOWLIST[0];
  const reqMethod = req.headers.get("access-control-request-method") || "POST";
  const reqHeaders =
    req.headers.get("access-control-request-headers") ||
    "authorization, apikey, content-type, x-client-info, prefer";
  return {
    "Access-Control-Allow-Origin": allow,
    Vary: "Origin",
    "Access-Control-Allow-Methods": `${reqMethod}, OPTIONS`,
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8",
  };
}

serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers });

  try {
    const body = await req.text();

    const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
    if (!base) return new Response(JSON.stringify({ error: "missing_supabase_url" }), { status: 500, headers });

    const url = `${base}/functions/v1/refunds`;

    // ✅ forward auth headers (important si refunds check l'utilisateur)
    const auth = req.headers.get("authorization") || "";
    const apikey = req.headers.get("apikey") || "";
    const xci = req.headers.get("x-client-info") || "";

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { authorization: auth } : {}),
        ...(apikey ? { apikey } : {}),
        ...(xci ? { "x-client-info": xci } : {}),
      },
      body,
    });

    const txt = await r.text();
    return new Response(txt, { status: r.status, headers });
  } catch (e: any) {
    console.error("request-refund error:", e?.message ?? e);
    return new Response(JSON.stringify({ error: "server_error" }), { status: 500, headers });
  }
});

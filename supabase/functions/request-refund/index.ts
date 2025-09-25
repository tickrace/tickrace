// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

console.log("BUILD request-refund 2025-09-22T23:10Z");

// CORS cohérent avec le reste du projet
const ALLOWLIST = ["https://www.tickrace.com", "http://localhost:5173", "http://127.0.0.1:5173"];
function cors(req: Request) {
  const o = req.headers.get("origin");
  const allow = o && ALLOWLIST.includes(o) ? o : ALLOWLIST[0];
  const reqMethod = req.headers.get("access-control-request-method") || "POST";
  const reqHeaders =
    req.headers.get("access-control-request-headers") ||
    "authorization, x-client-info, apikey, content-type, prefer";
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": `${reqMethod}, OPTIONS`,
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}

serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers });
  }

  try {
    // On forward tel quel vers la fonction "refunds" (même payload)
    const body = await req.text();
    const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
    const url = `${base}/functions/v1/refunds`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    const txt = await r.text();
    return new Response(txt, { status: r.status, headers });
    
  } catch (e: any) {
    console.error("request-refund error:", e?.message ?? e);
    const debug = Deno.env.get("DEBUG") === "1";
    return new Response(
      JSON.stringify({ error: debug ? (e?.message ?? "Erreur serveur") : "Erreur serveur" }),
      { status: 500, headers },
    );
  }
});

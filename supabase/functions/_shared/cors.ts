// supabase/functions/_shared/cors.ts

// 🔒 Liste blanche des origines autorisées
const ALLOWED_ORIGINS = new Set<string>([
  "https://www.tickrace.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

/** Construit les headers CORS en reflétant l’Origin & les request-headers du navigateur */
export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "*";
  const reqHeaders =
    req.headers.get("access-control-request-headers") || "authorization, content-type";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    // Si tu utilises des cookies côté front, décommente :
    // "Access-Control-Allow-Credentials": "true",
  };
}

/** Réponse preflight OPTIONS standardisée */
export function handlePreflight(req: Request): Response {
  return new Response("ok", { status: 204, headers: buildCorsHeaders(req) });
}

/** Enveloppe une Response en y ajoutant les headers CORS (merge propre) */
export function withCors(req: Request, res: Response): Response {
  const cors = buildCorsHeaders(req);
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
}

/** Crée une Response JSON (200 par défaut) avec CORS */
export function jsonWithCors(req: Request, body: unknown, status = 200): Response {
  const cors = buildCorsHeaders(req);
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}

/** Crée une Response texte d’erreur avec CORS */
export function errorWithCors(req: Request, message: string, status = 500): Response {
  return new Response(message, { status, headers: buildCorsHeaders(req) });
}

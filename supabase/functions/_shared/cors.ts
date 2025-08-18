const ALLOWED_ORIGINS = new Set<string>([
  "https://www.tickrace.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
export function buildCorsHeaders(req: Request) {
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
export function handlePreflight(req: Request) {
  return new Response("ok", { status: 204, headers: buildCorsHeaders(req) });
}
export function jsonWithCors(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...buildCorsHeaders(req) } });
}
export function errorWithCors(req: Request, message: string, status = 500) {
  return new Response(message, { status, headers: buildCorsHeaders(req) });
}
export function withCors(req: Request, res: Response) {
  const h = new Headers(res.headers);
  const cors = buildCorsHeaders(req);
  Object.entries(cors).forEach(([k, v]) => h.set(k, String(v)));
  return new Response(res.body, { status: res.status, headers: h });
}

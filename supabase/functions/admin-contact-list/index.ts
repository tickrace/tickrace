import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: any, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

const ALLOWED_ORIGINS = new Set([
  "https://www.tickrace.com",
  "https://tickrace.com",
  "http://localhost:5173",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://www.tickrace.com";
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-credentials": "true",
  };
}

function bearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

async function requireAdmin(req: Request) {
  const jwt = bearerToken(req);
  if (!jwt) return { ok: false, status: 401, error: "Missing auth" };

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data, error } = await anon.auth.getUser(jwt);
  if (error || !data?.user) return { ok: false, status: 401, error: "Invalid auth" };

  const user = data.user;

  // check table public.admins via service role
  const adminDb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: adminRow, error: aErr } = await adminDb
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (aErr) return { ok: false, status: 500, error: "Admin check failed" };
  if (!adminRow) return { ok: false, status: 403, error: "Forbidden" };

  return { ok: true, user };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

Deno.serve(async (req) => {
  const c = corsHeaders(req);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: c });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405, c);

  const auth = await requireAdmin(req);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status, c);

  try {
    const body = await req.json().catch(() => ({}));
    const status = (body?.status || null) as string | null;
    const q = (body?.q || null) as string | null;
    const limit = clamp(Number(body?.limit ?? 30), 1, 200);

    const adminDb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    let query = adminDb
      .from("contact_messages")
      .select(
        "id, created_at, role, categorie, source, nom, email, telephone, organisation, lien, sujet, message, status, handled_at, meta"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status && ["new", "in_progress", "done", "spam"].includes(status)) {
      query = query.eq("status", status);
    }

    if (q && q.trim().length >= 2) {
      const s = q.trim().replaceAll("%", "\\%").replaceAll("_", "\\_");
      query = query.or(
        [
          `nom.ilike.%${s}%`,
          `email.ilike.%${s}%`,
          `sujet.ilike.%${s}%`,
          `message.ilike.%${s}%`,
          `organisation.ilike.%${s}%`,
        ].join(",")
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    return json({ ok: true, items: data || [] }, 200, c);
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: "Server error" }, 500, c);
  }
});

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

Deno.serve(async (req) => {
  const c = corsHeaders(req);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: c });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405, c);

  const auth = await requireAdmin(req);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status, c);

  try {
    const body = await req.json();

    const id = String(body?.id || "").trim();
    const status = String(body?.status || "").trim();
    const admin_note = body?.admin_note ?? null;

    if (!id) return json({ ok: false, error: "Missing id" }, 400, c);
    if (!["new", "in_progress", "done", "spam"].includes(status)) {
      return json({ ok: false, error: "Invalid status" }, 400, c);
    }

    const adminDb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: current, error: curErr } = await adminDb
      .from("contact_messages")
      .select("meta")
      .eq("id", id)
      .single();

    if (curErr) throw curErr;

    const nextMeta = {
      ...(current?.meta || {}),
      admin_note: typeof admin_note === "string" ? admin_note : null,
      last_admin_update_at: new Date().toISOString(),
    };

    const handled_at = status === "done" ? new Date().toISOString() : null;

    const { data: updated, error } = await adminDb
      .from("contact_messages")
      .update({
        status,
        handled_at,
        handled_by: auth.user.id,
        meta: nextMeta,
      })
      .eq("id", id)
      .select(
        "id, created_at, role, categorie, source, nom, email, telephone, organisation, lien, sujet, message, status, handled_at, meta"
      )
      .single();

    if (error) throw error;

    return json({ ok: true, item: updated }, 200, c);
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: "Server error" }, 500, c);
  }
});

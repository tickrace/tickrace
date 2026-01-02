// supabase/functions/verify-lottery-invite/index.ts
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWLIST = ["https://www.tickrace.com", "http://localhost:5173", "http://127.0.0.1:5173"];
function corsHeaders(req: Request) {
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
  };
}

const supabaseSR = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function json(data: any, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function safeEmail(s: string) {
  return String(s || "").trim().toLowerCase();
}

function hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(input: string) {
  const enc = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return hex(digest);
}

async function getUserFromAuth(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${m[1]}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
    },
  });
  if (!userRes.ok) return null;
  return await userRes.json().catch(() => null);
}

serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  try {
    const user = await getUserFromAuth(req);
    if (!user?.id) return json({ ok: false, error: "Unauthorized" }, 401, cors);

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();
    const format_id = body?.format_id ? String(body.format_id) : null;
    const course_id = body?.course_id ? String(body.course_id) : null;

    if (!token) return json({ ok: false, error: "Missing token" }, 400, cors);

    const token_hash = await sha256Hex(token);

    /**
     * ⚠️ Adapte si tes noms/colonnes diffèrent :
     * - lottery_invites: id, token_hash, format_id, course_id, preinscription_id, team_id, expires_at, used_at
     * - format_preinscriptions: id, email
     */
    let q = supabaseSR
      .from("lottery_invites")
      .select("id, format_id, course_id, preinscription_id, team_id, expires_at, used_at")
      .eq("token_hash", token_hash)
      .limit(1);

    if (format_id) q = q.eq("format_id", format_id);
    if (course_id) q = q.eq("course_id", course_id);

    const { data: inv, error: invErr } = await q.maybeSingle();
    if (invErr) throw invErr;

    if (!inv) return json({ ok: false, error: "Token invalide" }, 200, cors);
    if (inv.used_at) return json({ ok: false, error: "Invitation déjà utilisée" }, 200, cors);

    const now = new Date();
    const exp = inv.expires_at ? new Date(inv.expires_at) : null;
    if (exp && now > exp) return json({ ok: false, error: "Invitation expirée" }, 200, cors);

    // Vérifie que l’invitation correspond bien au compte connecté (via email de préinscription)
    if (inv.preinscription_id) {
      const { data: pre, error: preErr } = await supabaseSR
        .from("format_preinscriptions")
        .select("id, email")
        .eq("id", inv.preinscription_id)
        .single();
      if (preErr) throw preErr;

      const preEmail = safeEmail(pre?.email || "");
      const userEmail = safeEmail(user?.email || "");
      if (preEmail && userEmail && preEmail !== userEmail) {
        return json({ ok: false, error: "Cette invitation ne correspond pas à ton compte" }, 200, cors);
      }
    }

    return json(
      {
        ok: true,
        invite: {
          id: inv.id,
          format_id: inv.format_id,
          course_id: inv.course_id,
          preinscription_id: inv.preinscription_id || null,
          team_id: inv.team_id || null,
          expires_at: inv.expires_at || null,
        },
      },
      200,
      cors
    );
  } catch (e) {
    console.error("verify-lottery-invite error:", e);
    return json({ ok: false, error: String(e?.message || e) }, 500, cors);
  }
});

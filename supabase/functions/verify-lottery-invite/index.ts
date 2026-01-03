// supabase/functions/verify-lottery-invite/index.ts
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

/* ------------------------------ ENV ------------------------------ */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/* ------------------------------ CORS ------------------------------ */
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

/* --------------------------- Client SR ---------------------------- */
const supabaseSR = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* ---------------------------- Helpers ---------------------------- */
function json(data: any, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeEmail(x: any) {
  return String(x ?? "").trim().toLowerCase();
}

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s || ""));
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseDate(d: any) {
  if (!d) return null;
  const dt = new Date(String(d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function isExpired(expiresAt: any) {
  const dt = parseDate(expiresAt);
  if (!dt) return false;
  return dt.getTime() < Date.now();
}

async function getRequesterUser(req: Request): Promise<{ id: string; email: string } | null> {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;

  const accessToken = m[1];

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      // Utiliser la SR key en apikey marche (comme dans ton send-lottery-email)
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
    },
  });

  if (!userRes.ok) return null;

  const u = await userRes.json().catch(() => null);
  const id = String(u?.id || "");
  const email = safeEmail(u?.email || "");
  if (!id || !email) return null;
  return { id, email };
}

/* ------------------------------ Main ------------------------------ */
serve(async (req: Request) => {
  const cors = corsHeaders(req);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  // ⚠️ Important : on ne renvoie JAMAIS 500
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ ok: false, error: "Missing env" }, 200, cors);
    }

    const body = await req.json().catch(() => ({}));
    const token = safeStr(body?.token);
    const course_id = safeStr(body?.course_id);
    const format_id = safeStr(body?.format_id);

    if (!token) return json({ ok: false, error: "Missing token" }, 200, cors);
    if (!course_id || !isUuid(course_id)) return json({ ok: false, error: "Invalid course_id" }, 200, cors);
    if (!format_id || !isUuid(format_id)) return json({ ok: false, error: "Invalid format_id" }, 200, cors);

    // ✅ Exiger un user connecté pour empêcher multi-comptes
    const requester = await getRequesterUser(req);
    if (!requester) {
      return json({ ok: false, error: "Connecte-toi pour utiliser cette invitation." }, 200, cors);
    }

    const token_hash = await sha256Hex(token);

    // ✅ join pour récupérer l'email attendu (celui de la préinscription)
    const { data: inv, error } = await supabaseSR
      .from("lottery_invites")
      .select(`
        id, course_id, format_id, draw_id, preinscription_id, batch_no, invited_at, expires_at, used_at, token_hash,
        format_preinscriptions:preinscription_id ( email )
      `)
      .eq("course_id", course_id)
      .eq("format_id", format_id)
      .eq("token_hash", token_hash)
      .maybeSingle();

    if (error) {
      console.error("verify-lottery-invite db error:", error);
      return json({ ok: false, error: "DB error", details: error?.message || null }, 200, cors);
    }

    if (!inv) return json({ ok: false, error: "Invitation introuvable." }, 200, cors);
    if (inv.used_at) return json({ ok: false, error: "Invitation déjà utilisée." }, 200, cors);
    if (isExpired(inv.expires_at)) return json({ ok: false, error: "Invitation expirée." }, 200, cors);

    const inviteEmail = safeEmail((inv as any)?.format_preinscriptions?.email);
    if (!inviteEmail) {
      return json({ ok: false, error: "Invitation invalide (email préinscription manquant)." }, 200, cors);
    }

    // ✅ Bloque si le compte connecté n'est pas celui invité
    if (requester.email !== inviteEmail) {
      return json(
        {
          ok: false,
          error: "Cette invitation est liée à un autre email.",
          details: { expected: inviteEmail, got: requester.email },
        },
        200,
        cors
      );
    }

    return json(
      {
        ok: true,
        invite: {
          id: inv.id,
          course_id: inv.course_id,
          format_id: inv.format_id,
          preinscription_id: inv.preinscription_id,
          draw_id: inv.draw_id ?? null,
          batch_no: inv.batch_no ?? 1,
          invited_at: inv.invited_at ?? null,
          expires_at: inv.expires_at ?? null,
          used_at: inv.used_at ?? null,

          // ✅ utile côté UI : verrouiller l'email
          invite_email: inviteEmail,
          requester_user_id: requester.id,
        },
      },
      200,
      cors
    );
  } catch (e) {
    console.error("verify-lottery-invite unexpected error:", e);
    return json({ ok: false, error: String(e?.message || e) }, 200, cors);
  }
});

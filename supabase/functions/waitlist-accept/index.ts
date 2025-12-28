// supabase/functions/waitlist-accept/index.ts
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true }, 200);

  try {
    const url = new URL(req.url);

    // ✅ token depuis query OU body
    const tokenFromQuery = url.searchParams.get("token");
    let tokenFromBody: string | null = null;

    if (req.method !== "GET") {
      try {
        const body = await req.json().catch(() => null);
        tokenFromBody = body?.token ?? body?.invite_token ?? null;
      } catch {
        // ignore
      }
    }

    const token = (tokenFromQuery || tokenFromBody || "").trim();
    if (!token) return json({ ok: false, message: "Token manquant." }, 400);

    // 1) Lire la waitlist par token
    const { data: row, error: rerr } = await supabaseAdmin
      .from("waitlist")
      .select("id, course_id, format_id, invited_at, invite_expires_at, consumed_at")
      .eq("invite_token", token)
      .maybeSingle();

    if (rerr) {
      console.error("WAITLIST_ACCEPT_READ_ERROR", rerr);
      return json({ ok: false, message: "Erreur lecture waitlist." }, 500);
    }

    if (!row) {
      return json({ ok: false, message: "Invitation introuvable (token invalide)." }, 404);
    }

    if (row.consumed_at) {
      return json({ ok: false, message: "Invitation déjà utilisée." }, 409);
    }

    if (row.invite_expires_at) {
      const exp = new Date(row.invite_expires_at).getTime();
      if (!Number.isFinite(exp)) {
        return json({ ok: false, message: "Invitation invalide (expiry illisible)." }, 400);
      }
      if (Date.now() > exp) {
        return json({ ok: false, message: "Invitation expirée." }, 410);
      }
    }

    // 2) Marquer consommée
    const { error: uerr } = await supabaseAdmin
      .from("waitlist")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);

    if (uerr) {
      console.error("WAITLIST_ACCEPT_UPDATE_ERROR", uerr);
      return json({ ok: false, message: "Erreur validation invitation." }, 500);
    }

    // 3) Redirection front (tu peux adapter les params)
    const next = `/inscription/${row.course_id}?formatId=${row.format_id}&waitlistToken=${encodeURIComponent(token)}`;

    return json({
      ok: true,
      courseId: row.course_id,
      formatId: row.format_id,
      next,
    });
  } catch (e) {
    console.error("WAITLIST_ACCEPT_FATAL", e);
    return json({ ok: false, message: "Erreur serveur." }, 500);
  }
});

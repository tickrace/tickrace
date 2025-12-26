// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseSR = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token } = await req.json();
    if (!token) return json(400, { ok: false, message: "token requis" });

    const { data: row, error } = await supabaseSR
      .from("waitlist")
      .select("id, course_id, format_id, email, invited_at, invite_expires_at, consumed_at")
      .eq("invite_token", token)
      .maybeSingle();

    if (error) throw error;
    if (!row) return json(200, { ok: false, message: "Invitation introuvable." });

    if (row.consumed_at) return json(200, { ok: false, message: "Invitation déjà utilisée." });

    if (!row.invited_at) return json(200, { ok: false, message: "Invitation non envoyée." });

    if (row.invite_expires_at) {
      const exp = new Date(row.invite_expires_at);
      if (Date.now() > exp.getTime()) return json(200, { ok: false, message: "Invitation expirée." });
    }

    const { error: upErr } = await supabaseSR
      .from("waitlist")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);

    if (upErr) throw upErr;

    return json(200, {
      ok: true,
      courseId: row.course_id,
      formatId: row.format_id,
      email: row.email,
    });
  } catch (e) {
    console.error("WAITLIST_ACCEPT_FATAL", e);
    return json(500, { ok: false, message: String(e?.message || e) });
  }
});

// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      },
    });
  }

  // Auth interne (ne JAMAIS exposer ce token cÃ´tÃ© front)
  const headerAuth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  const expected = `Bearer ${Deno.env.get("INTERNAL_SETUP_TOKEN")}`;
  if (!headerAuth || headerAuth !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  // user_id depuis GET ?user_id=... ou POST { user_id: ... }
  let userId = new URL(req.url).searchParams.get("user_id");
  if (!userId && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    userId = body?.user_id;
  }
  if (!userId) return json({ error: "Missing user_id" }, 400);

  // Client Admin (Service Role)
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1) app_metadata.roles = ['admin']
  const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: { roles: ["admin"] },
  });
  if (updErr) return json({ error: updErr.message }, 500);

  // 2) whitelist DB (table public.admins)
  const { error: insErr } = await supabaseAdmin
    .from("admins")
    .insert({ user_id: userId })
    .single()
    .catch(() => ({ error: null })); // upsert-like tolÃ©rant

  // si conflit (dÃ©jÃ  prÃ©sent), on ignore
  if (insErr && !String(insErr.message).includes("duplicate key")) {
    return json({ error: insErr.message }, 500);
  }

  return json({ ok: true, userId });
});

// hard guard
try { (globalThis | Out-Null) } catch {} // keep file non-empty

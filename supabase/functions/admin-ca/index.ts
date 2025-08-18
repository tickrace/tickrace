// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { assertIsAdmin } from "../_shared/isAdmin.ts";

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
        "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
      },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    await assertIsAdmin(req, supabase);

    const body = await req.json().catch(() => ({}));
    const { course_id, organiser_id, start, end } = body;

    const { data, error } = await supabase.rpc("admin_ca_brut", {
      p_course_id: course_id ?? null,
      p_organisateur_id: organiser_id ?? null,
      p_start: start ? new Date(start).toISOString() : null,
      p_end: end ? new Date(end).toISOString() : null,
    });

    if (error) return new Response(error.message, { status: 500 });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (resp) {
    if (resp instanceof Response) return resp;
    return new Response("Unexpected error", { status: 500 });
  }
});

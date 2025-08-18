// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { assertIsAdmin } from "../_shared/isAdmin.ts";
import { handlePreflight, jsonWithCors, errorWithCors, withCors } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return handlePreflight(req);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    await assertIsAdmin(req, supabase);

    const { data, error } = await supabase
      .from("admin_courses_kpis")
      .select("*")
      .order("course_nom", { ascending: true })
      .limit(50);

    if (error) return errorWithCors(req, error.message, 500);

    return jsonWithCors(req, data ?? [], 200);
  } catch (e) {
    if (e instanceof Response) return withCors(req, e);
    return errorWithCors(req, "Unexpected error", 500);
  }
});

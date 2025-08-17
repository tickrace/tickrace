// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { assertIsAdmin } from "../_shared/isAdmin.ts";

// Champs autorisés pour le tri
const ALLOWED_ORDER_BY = new Set([
  "course_nom",
  "total_inscriptions",
  "inscriptions_validees",
  "ca_brut",
  "course_id",
]);

serve(async (req) => {
  // CORS preflight
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
    const {
      search,            // string (recherche nom de course)
      organiser_id,      // uuid
      order_by = "course_nom",         // champ de tri
      order_dir = "asc",               // 'asc' | 'desc'
      limit = 25,                      // pagination
      offset = 0,                      // pagination
    } = body || {};

    const dir = (String(order_dir).toLowerCase() === "desc") ? "desc" : "asc";
    const ord = ALLOWED_ORDER_BY.has(order_by) ? order_by : "course_nom";

    // ---------- COUNT ----------
    let countQuery = supabase
      .from("admin_courses_kpis")
      .select("course_id", { count: "exact", head: true });

    if (organiser_id) countQuery = countQuery.eq("organisateur_id", organiser_id);
    if (search && String(search).trim().length > 0) {
      countQuery = countQuery.ilike("course_nom", `%${String(search).trim()}%`);
    }

    const { count, error: countErr } = await countQuery;
    if (countErr) return new Response(countErr.message, { status: 500 });

    // ---------- DATA ----------
    let dataQuery = supabase
      .from("admin_courses_kpis")
      .select("*");

    if (organiser_id) dataQuery = dataQuery.eq("organisateur_id", organiser_id);
    if (search && String(search).trim().length > 0) {
      dataQuery = dataQuery.ilike("course_nom", `%${String(search).trim()}%`);
    }

    // Tri
    dataQuery = dataQuery.order(ord as any, { ascending: dir === "asc", nullsFirst: true });

    // Pagination
    const from = Math.max(0, Number(offset));
    const to = from + Math.max(1, Number(limit)) - 1;
    dataQuery = dataQuery.range(from, to);

    const { data, error } = await dataQuery;
    if (error) return new Response(error.message, { status: 500 });

    return new Response(JSON.stringify({ rows: data ?? [], total: count ?? 0 }), {
      status: 200,
      headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (resp) {
    if (resp instanceof Response) return resp;
    return new Response("Unexpected error", { status: 500 });
  }
});

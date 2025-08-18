import { supabase } from "../supabase";

export async function getAdminStats() {
  const { data, error } = await supabase.from("admin_stats_v").select("*").maybeSingle();
  if (error) throw error;
  return data || {};
}

export async function getAdminCoursesKpis({ limit = 50, offset = 0 } = {}) {
  const { data, error } = await supabase
    .from("admin_courses_kpis_v")
    .select("*")
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data || [];
}

/**
 * params:
 *   search?: string (sur nom/prenom/email)
 *   statut?: string
 *   course_id?: string (uuid)
 *   format_id?: string (uuid)
 *   date_from?: string (YYYY-MM-DD)
 *   date_to?: string (YYYY-MM-DD)
 *   limit?: number
 *   offset?: number
 */
export async function getAdminInscriptions(params = {}) {
  const {
    search = "",
    statut,
    course_id,
    format_id,
    date_from,
    date_to,
    limit = 50,
    offset = 0,
  } = params;

  let q = supabase.from("admin_inscriptions_v").select("*", { count: "exact" });

  if (statut)        q = q.eq("statut", statut);
  if (course_id)     q = q.eq("course_id", course_id);
  if (format_id)     q = q.eq("format_id", format_id);
  if (date_from)     q = q.gte("created_at", `${date_from}T00:00:00`);
  if (date_to)       q = q.lte("created_at", `${date_to}T23:59:59`);

  if (search?.trim()) {
    const s = `%${search.trim()}%`;
    // ilike multi champs
    q = q.or(`coureur_nom.ilike.${s},coureur_prenom.ilike.${s},coureur_email.ilike.${s}`);
  }

  q = q.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: data || [], total: count ?? 0 };
}

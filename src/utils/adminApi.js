import { supabase } from "../supabase";

export async function getAdminStats() {
  // vue: admin_stats_v → une seule ligne
  const { data, error } = await supabase.from("admin_stats_v").select("*").maybeSingle();
  if (error) throw error;
  return data || {};
}

export async function getAdminCoursesKpis({ limit = 50, offset = 0 } = {}) {
  // vue: admin_courses_kpis_v → paginons côté client simplement
  const { data, error } = await supabase
    .from("admin_courses_kpis_v")
    .select("*")
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data || [];
}

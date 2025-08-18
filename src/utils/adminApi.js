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

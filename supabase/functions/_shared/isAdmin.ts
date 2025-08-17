// supabase/functions/_shared/isAdmin.ts
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

export async function assertIsAdmin(req: Request, supabase: SupabaseClient) {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Response("Unauthorized", { status: 401 });

  const token = authHeader.split(" ")[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Response("Unauthorized", { status: 401 });

  // Double check: app_metadata + table admins
  const roles = (user.app_metadata?.roles ?? []) as string[];
  if (!roles.includes("admin")) throw new Response("Forbidden", { status: 403 });

  const { data: row } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!row) throw new Response("Forbidden", { status: 403 });

  return user;
}

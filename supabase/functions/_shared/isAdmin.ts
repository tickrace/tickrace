import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

/**
 * Vérifie que la requête porte un Bearer JWT valide
 * ET que l'utilisateur est bien présent dans public.admins.
 * Source de vérité unique: table public.admins.
 * 
 * Lève un Response 401/403 si non autorisé.
 * Retourne l'objet user sinon.
 */
export async function assertIsAdmin(req: Request, supabase: SupabaseClient) {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const token = authHeader.split(" ")[1];

  // 1) Récupérer l'utilisateur depuis le JWT
  const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
  const user = userRes?.user;
  if (userErr || !user) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // 2) Vérifier l'appartenance à public.admins
  const { data: row, error: adminErr } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminErr) {
    // Erreur d'accès (RLS, etc.)
    throw new Response("Forbidden", { status: 403 });
  }
  if (!row) {
    // Pas admin
    throw new Response("Forbidden", { status: 403 });
  }

  return user;
}

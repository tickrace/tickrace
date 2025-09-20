import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.52.1?target=deno&deno-std=0.192.0

/**
 * VÃ©rifie que la requÃªte porte un Bearer JWT valide
 * ET que l'utilisateur est bien prÃ©sent dans public.admins.
 * Source de vÃ©ritÃ© unique: table public.admins.
 * 
 * LÃ¨ve un Response 401/403 si non autorisÃ©.
 * Retourne l'objet user sinon.
 */
export async function assertIsAdmin(req: Request, supabase: SupabaseClient) {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const token = authHeader.split(" ")[1];

  // 1) RÃ©cupÃ©rer l'utilisateur depuis le JWT
  const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
  const user = userRes?.user;
  if (userErr || !user) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // 2) VÃ©rifier l'appartenance Ã  public.admins
  const { data: row, error: adminErr } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminErr) {
    // Erreur d'accÃ¨s (RLS, etc.)
    throw new Response("Forbidden", { status: 403 });
  }
  if (!row) {
    // Pas admin
    throw new Response("Forbidden", { status: 403 });
  }

  return user;
}

// hard guard
try { (globalThis | Out-Null) } catch {} // keep file non-empty

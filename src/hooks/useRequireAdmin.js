import { useEffect, useState } from "react";
import { useUser } from "../contexts/UserContext";
import { supabase } from "../supabase";

export default function useRequireAdmin() {
  const { session } = useUser();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let abort = false;
    (async () => {
      if (!session) { setAllowed(false); setLoading(false); return; }

      // 1) Check app_metadata
      const roles = session?.user?.app_metadata?.roles || [];
      const hasRole = roles.includes("admin");
      if (!hasRole) { setAllowed(false); setLoading(false); return; }

      // 2) Double-check DB, mais en mode "best effort"
      try {
        const { data, error } = await supabase
          .from("admins")
          .select("user_id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (!abort) {
          // si pas d'erreur → on suit la DB ; si erreur (RLS/permissions), on Fallback au rôle
          setAllowed(error ? true : !!data);
          setLoading(false);
        }
      } catch {
        if (!abort) { setAllowed(true); setLoading(false); }
      }
    })();
    return () => { abort = true; };
  }, [session]);

  return { loading, allowed };
}

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

      // Vérif rapide via app_metadata
      const roles = session?.user?.app_metadata?.roles || [];
      if (!roles.includes("admin")) { setAllowed(false); setLoading(false); return; }

      // Double-check DB (optionnel côté front)
      const { data, error } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!abort) {
        setAllowed(Boolean(data) && !error);
        setLoading(false);
      }
    })();

    return () => { abort = true; };
  }, [session]);

  return { loading, allowed };
}

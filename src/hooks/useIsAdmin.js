import { useEffect, useState } from "react";
import { useUser } from "../contexts/UserContext";
import { supabase } from "../supabase";

export default function useIsAdmin() {
  const { session } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abort = false;
    (async () => {
      if (!session) { setIsAdmin(false); setLoading(false); return; }
      try {
        const { data, error } = await supabase
          .from("admins")
          .select("user_id")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (!abort) {
          setIsAdmin(!!data && !error);
          setLoading(false);
        }
      } catch {
        if (!abort) { setIsAdmin(false); setLoading(false); }
      }
    })();
    return () => { abort = true; };
  }, [session]);

  return { isAdmin, loading };
}

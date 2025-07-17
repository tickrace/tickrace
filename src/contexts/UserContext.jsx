import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase";

export const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessionAndRoles = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);

      if (user) {
        const { data: rolesData } = await supabase
          .from("profils_utilisateurs")
          .select("role")
          .eq("id", user.id);

        if (rolesData) {
          setRoles(rolesData.map((r) => r.role));
        }
      }

      setLoading(false);
    };

    fetchSessionAndRoles();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
        setRoles([]);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <UserContext.Provider value={{ user, roles, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

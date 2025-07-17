// src/contexts/UserContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase";

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [roles, setRoles] = useState([]); // <== tableau de rôles
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      if (session?.user?.id) {
        const { data, error } = await supabase
          .from("profils_utilisateurs")
          .select("role")
          .eq("user_id", session.user.id);

        if (!error) {
          const fetchedRoles = data.map((item) => item.role);
          setRoles(fetchedRoles); // ['coureur', 'organisateur']
        }
      }

      setLoading(false);
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // tu peux relancer init() ici si besoin
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <UserContext.Provider value={{ session, roles, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);

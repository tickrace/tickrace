import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase";

const UserContext = createContext();

export function UserProvider({ children }) {
  const [session, setSession] = useState(null);
  const [currentRole, setCurrentRole] = useState(() => {
    // Charger le rôle sauvegardé au premier chargement
    return localStorage.getItem("tickrace_role") || "coureur";
  });

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const switchRole = (role) => {
    setCurrentRole(role);
    localStorage.setItem("tickrace_role", role); // Sauvegarde persistante
  };

  return (
    <UserContext.Provider
      value={{
        session,
        currentRole,
        switchRole,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

// src/contexts/UserContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase";

const UserContext = createContext();

export function UserProvider({ children }) {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState("coureur"); // Valeur par défaut

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

  return (
    <UserContext.Provider value={{ session, role, setRole }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

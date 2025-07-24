// src/contexts/UserContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase";

const UserContext = createContext();

export function UserProvider({ children }) {
  const [session, setSession] = useState(null);
  const [currentRole, setCurrentRole] = useState(() => {
    return localStorage.getItem("tickrace_role") || "coureur";
  });

  const [roles, setRoles] = useState([]);
  const [activeRole, setActiveRole] = useState("coureur");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");

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
    localStorage.setItem("tickrace_role", role);
  };

  return (
    <UserContext.Provider
      value={{
        session,
        setSession,
        currentRole,
        switchRole,
        roles,
        setRoles,
        activeRole,
        setActiveRole,
        nom,
        setNom,
        prenom,
        setPrenom
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

// src/contexts/UserContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase";

const UserContext = createContext();

export function UserProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profil, setProfil] = useState([]); // Tableau d'entrées profils_utilisateurs
  const [currentRole, setCurrentRole] = useState(null);
  const [availableRoles, setAvailableRoles] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfil(session.user.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session) fetchProfil(session.user.id);
        else {
          setProfil([]);
          setCurrentRole(null);
          setAvailableRoles([]);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const fetchProfil = async (userId) => {
    const { data, error } = await supabase
      .from("profils_utilisateurs")
      .select("*")
      .eq("user_id", userId);

    if (!error && data) {
      setProfil(data);
      const roles = data.map((entry) => entry.role);
      setAvailableRoles(roles);
      if (roles.length > 0) setCurrentRole(roles[0]); // rôle par défaut
    }
  };

  const switchRole = (role) => {
    if (availableRoles.includes(role)) {
      setCurrentRole(role);
    }
  };

  const logout = () => {
    setSession(null);
    setProfil([]);
    setCurrentRole(null);
    setAvailableRoles([]);
  };

  return (
    <UserContext.Provider
      value={{
        session,
        profil,
        currentRole,
        availableRoles,
        switchRole,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);

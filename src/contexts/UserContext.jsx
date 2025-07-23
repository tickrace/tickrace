import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase";
import toast from "react-hot-toast";

const UserContext = createContext();

export function UserProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profil, setProfil] = useState(null); // liste des rôles
  const [currentRole, setCurrentRole] = useState(null);

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

  useEffect(() => {
    if (session?.user?.id) {
      fetchRoles(session.user.id);
    }
  }, [session]);

  const fetchRoles = async (userId) => {
    const { data, error } = await supabase
      .from("profils_utilisateurs")
      .select("role")
      .eq("user_id", userId);

    if (!error) {
      setProfil(data);
      // Si un seul rôle, on le sélectionne automatiquement
      if (data.length === 1) {
        setCurrentRole(data[0].role);
      }
    } else {
      toast.error("Erreur lors du chargement des rôles");
    }
  };

  const switchRole = (role) => {
    setCurrentRole(role);
  };

  return (
    <UserContext.Provider
      value={{
        session,
        profil,
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

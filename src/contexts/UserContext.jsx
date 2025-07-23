import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase";
import toast from "react-hot-toast";

const UserContext = createContext();

export function UserProvider({ children }) {
  const [session, setSession] = useState(null);
  const [availableRoles, setAvailableRoles] = useState([]); // tous les rôles disponibles
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
      const roles = data.map((item) => item.role).filter(Boolean); // retirer les null
      setAvailableRoles(roles);
      if (roles.length === 1) {
        setCurrentRole(roles[0]);
      } else if (roles.length > 1 && !currentRole) {
        setCurrentRole(roles[0]); // valeur par défaut
      }
    } else {
      toast.error("Erreur lors du chargement des rôles");
    }
  };

  const switchRole = async (role) => {
    setCurrentRole(role);
    // Optionnel : tu peux aussi mettre à jour la BDD ici si besoin
    // par exemple pour conserver le rôle actif
  };

  return (
    <UserContext.Provider
      value={{
        session,
        availableRoles,
        currentRole,
        setCurrentRole,
        switchRole,
        fetchRoles,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

// src/contexts/UserContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";

const UserContext = createContext();
export { UserContext }; // ✅ Export nécessaire pour Navbar

export function UserProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profil, setProfil] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);

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
          setProfil(null);
          setCurrentRole(null);
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
      if (data.length > 0 && data[0].role) {
        setCurrentRole(data[0].role);
      } else {
        setCurrentRole(null);
      }
    }
  };

  const switchRole = async (role) => {
    setCurrentRole(role);
    if (session?.user) {
      const { error } = await supabase
        .from("profils_utilisateurs")
        .update({ role })
        .eq("user_id", session.user.id);
      if (error) {
        toast.error("Erreur lors du changement de rôle.");
      } else {
        toast.success(`Rôle défini sur ${role}`);
      }
    }
  };

  return (
    <UserContext.Provider value={{ session, profil, currentRole, switchRole }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);

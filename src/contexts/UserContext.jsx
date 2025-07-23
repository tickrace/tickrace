import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase";

const UserContext = createContext();

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

    if (!error && data.length > 0) {
      setProfil(data);
      if (data[0].role) {
        setCurrentRole(data[0].role);
      }
    }
  };

  const switchRole = async (newRole) => {
    if (!session) return;

    const { error } = await supabase
      .from("profils_utilisateurs")
      .update({ role: newRole })
      .eq("user_id", session.user.id);

    if (!error) {
      setCurrentRole(newRole);
      fetchProfil(session.user.id);
      alert("Rôle mis à jour avec succès !");
    }
  };

  return (
    <UserContext.Provider value={{ session, profil, currentRole, switchRole }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);

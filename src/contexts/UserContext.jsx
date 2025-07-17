// src/contexts/UserContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase";

const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserAndRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUser(user);
        const { data: profil, error } = await supabase
          .from("profils_utilisateurs")
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (error) {
          console.error("Erreur de chargement du rôle :", error.message);
        } else {
          setRole(profil?.role);
        }
      }

      setLoading(false);
    };

    fetchUserAndRole();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session.user);
          supabase
            .from("profils_utilisateurs")
            .select("role")
            .eq("user_id", session.user.id)
            .single()
            .then(({ data, error }) => {
              if (!error) {
                setRole(data.role);
              }
            });
        } else {
          setUser(null);
          setRole(null);
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <UserContext.Provider value={{ user, role, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

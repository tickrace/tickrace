// src/contexts/UserContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase";

const UserContext = createContext();

export function UserProvider({ children }) {
  const [session, setSession] = useState(null);
  const [roles, setRoles] = useState([]);
  const [activeRole, setActiveRole] = useState(null);
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchRoles = async () => {
      if (!session) return;

      const { data, error } = await supabase
        .from("profils_utilisateurs")
        .select("role, nom, prenom")
        .eq("user_id", session.user.id);

      if (data) {
        setRoles(data.map((r) => r.role));
        setActiveRole(data[0]?.role || null);
        setNom(data[0]?.nom || "");
        setPrenom(data[0]?.prenom || "");
      }
    };

    fetchRoles();
  }, [session]);

  return (
    <UserContext.Provider
      value={{ session, roles, activeRole, setActiveRole, nom, prenom }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

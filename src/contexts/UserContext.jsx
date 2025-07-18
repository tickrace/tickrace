import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase";

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [roles, setRoles] = useState([]);
  const [profilCoureur, setProfilCoureur] = useState(null);
  const [profilOrganisateur, setProfilOrganisateur] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);

      if (session?.user?.id) {
        const { data: rolesData, error: rolesError } = await supabase
          .from("profils_utilisateurs")
          .select("role")
          .eq("user_id", session.user.id);

        if (!rolesError && rolesData) {
          const fetchedRoles = rolesData.map((item) => item.role);
          setRoles(fetchedRoles);

          // Charger le profil coureur si applicable
          if (fetchedRoles.includes("coureur")) {
            const { data: coureur, error: errC } = await supabase
              .from("profils_coureurs")
              .select("*")
              .eq("id", session.user.id)
              .single();

            if (!errC && coureur) setProfilCoureur(coureur);
          }

          // Charger le profil organisateur si applicable
          if (fetchedRoles.includes("organisateur")) {
            const { data: orga, error: errO } = await supabase
              .from("profils_organisateurs")
              .select("*")
              .eq("id", session.user.id)
              .single();

            if (!errO && orga) setProfilOrganisateur(orga);
          }
        }
      }

      setLoading(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      init(); // relancer la récupération des rôles et profils
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <UserContext.Provider
      value={{
        session,
        roles,
        profilCoureur,
        profilOrganisateur,
        loading,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);

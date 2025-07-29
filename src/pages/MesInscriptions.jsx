import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

export default function MesInscriptions() {
  const { session } = useUser();
  const [coureurId, setCoureurId] = useState(null);
  const [inscriptions, setInscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    const fetchCoureurId = async () => {
      try {
        if (!session?.user?.id) return;
        const { data, error } = await supabase
          .from("profils_utilisateurs")
          .select("user_id")
          .eq("user_id", session.user.id)
          .eq("role", "coureur")
          .single();

        if (error || !data) {
          setErreur("Profil coureur introuvable.");
          return;
        }

        setCoureurId(data.user_id);
      } catch (err) {
        console.error("Erreur récupération profil coureur :", err);
        setErreur("Erreur récupération du profil.");
      }
    };

    fetchCoureurId();
  }, [session]);

  useEffect(() => {
    const fetchInscriptions = async () => {
      if (!coureurId) return;

      setLoading(true);
      const { data, error } = await supabase
        .from("inscriptions")
        .select("id, format_id, course_id, nom, prenom, format:format_id(nom, date), course:courses(nom)")
        .eq("coureur_id", coureurId);

      if (error) {
        console.error("Erreur chargement des inscriptions :", error);
        setErreur("Erreur chargement des inscriptions.");
      } else {
        setInscriptions(data);
      }

      setLoading(false);
    };

    fetchInscriptions();
  }, [coureurId]);

  if (!session) return <div className="p-6">Connexion requise.</div>;
  if (loading) return <div className="p-6">Chargement...</div>;
  if (erreur) return <div className="p-6 text-red-600">{erreur}</div>;
  if (inscriptions.length === 0) return <div className="p-6">Aucune inscription trouvée.</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Mes inscriptions</h1>
      <ul className="space-y-4">
        {inscriptions.map((insc) => (
          <li key={insc.id} className="border p-4 rounded shadow-sm bg-white">
            <div className="font-semibold">{insc.course?.nom || "Épreuve inconnue"}</div>
            <div className="text-sm text-gray-700">
              Format : {insc.format?.nom || "Inconnu"} — {insc.format?.date || "Date inconnue"}
            </div>
            <Link
              to={`/moninscription/${insc.id}`}
              className="inline-block mt-2 text-blue-600 hover:underline text-sm"
            >
              Voir / Modifier mon inscription →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

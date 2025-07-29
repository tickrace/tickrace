import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import { Link } from "react-router-dom";

export default function MesInscriptions() {
  const { session } = useUser();
  const [inscriptions, setInscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user) {
      fetchInscriptions();
    }
  }, [session]);

  const fetchInscriptions = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("inscriptions")
      .select(`
        *,
        format:format_id (
          id,
          nom,
          distance_km,
          denivele_dplus,
          date,
          course:course_id (
            id,
            nom,
            lieu,
            image_url
          )
        )
      `)
      .eq("coureur_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur chargement inscriptions :", error.message);
    } else {
      setInscriptions(data);
    }

    setLoading(false);
  };

  if (loading) return <div className="p-4">Chargement...</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Mes Inscriptions</h1>
      {inscriptions.length === 0 ? (
        <p>Vous n'avez encore aucune inscription.</p>
      ) : (
        <ul className="space-y-4">
          {inscriptions.map((inscription) => {
            const { format, statut, id } = inscription;
            const course = format?.course;

            return (
              <li key={id} className="bg-white rounded shadow p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{format?.nom}</h2>
                    <p className="text-sm text-gray-600">
                      {course?.nom} – {course?.lieu}
                    </p>
                    <p className="text-sm text-gray-600">
                      {format?.distance_km} km • {format?.denivele_dplus} D+ • {format?.date}
                    </p>
                    <p className="text-sm mt-1">
                      Statut : <span className="font-medium">{statut}</span>
                    </p>
                  </div>
                  <div className="mt-3 md:mt-0">
                    <Link
  to={`/mon-inscription/${inscription.id}`}
  className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
>
  Voir / Modifier
</Link>

                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

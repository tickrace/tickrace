import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import { Link } from "react-router-dom";

export default function MesInscriptions() {
  const { session } = useUser();
  const [inscriptions, setInscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchInscriptions();
    }
  }, [session]);

  const fetchInscriptions = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("inscriptions")
      .select(`
        *,
        format:formats (
          id,
          nom,
          distance_km,
          denivele_dplus,
          date,
          course:courses (
            id,
            nom,
            ville,
            pays,
            image_url
          )
        )
      `)
      .eq("coureur_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur chargement inscriptions:", error.message);
    } else {
      setInscriptions(data);
    }

    setLoading(false);
  };

  if (loading) return <div className="p-6 text-center">Chargement...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Mes Inscriptions</h1>

      {inscriptions.length === 0 ? (
        <p>Vous n'avez pas encore d'inscription.</p>
      ) : (
        <div className="grid gap-4">
          {inscriptions.map((insc) => {
            const { format } = insc;
            const course = format?.course;

            return (
              <div
                key={insc.id}
                className="bg-white rounded-lg shadow p-4 border flex gap-4 items-center"
              >
                {course?.image_url && (
                  <img
                    src={course.image_url}
                    alt={course.nom}
                    className="w-28 h-20 object-cover rounded"
                  />
                )}

                <div className="flex-1">
                  <h2 className="text-lg font-semibold">
                    {course?.nom} – {format?.nom}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {course?.ville}, {course?.pays} – {format?.distance_km} km /{" "}
                    {format?.denivele_dplus} m D+ – {format?.date}
                  </p>
                  <p className="text-sm mt-1">
                    Statut :{" "}
                    <span className="font-medium">{insc.statut || "?"}</span>
                  </p>
                </div>

                <Link
                  to={`/mon-inscription/${insc.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Voir / Modifier
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

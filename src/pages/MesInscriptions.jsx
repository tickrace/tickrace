import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import { Link } from "react-router-dom";

export default function MesInscriptions() {
  const { session } = useUser();
  const [inscriptions, setInscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.id) {
      fetchInscriptions();
    }
  }, [session]);

  const fetchInscriptions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("inscriptions")
      .select(`
        *,
        formats (
          id,
          nom,
          distance_km,
          denivele_dplus,
          date,
          courses (
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

    if (!error) setInscriptions(data);
    setLoading(false);
  };

  if (loading) return <div className="p-4">Chargement...</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Mes inscriptions</h1>
      {inscriptions.length === 0 && (
        <p className="text-gray-600">Aucune inscription trouvée.</p>
      )}
      <div className="space-y-4">
        {inscriptions.map((inscription) => {
          const format = inscription.formats;
          const course = format?.courses;
          return (
            <div
              key={inscription.id}
              className="border rounded p-4 bg-white shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{course?.nom}</h2>
                  <p className="text-sm text-gray-600">
                    {course?.ville}, {course?.pays} – {format?.nom} ({format?.distance_km} km, {format?.denivele_dplus} m D+)
                  </p>
                  <p className="text-sm text-gray-500">
                    Date : {format?.date}
                  </p>
                </div>
                <div className="mt-2 sm:mt-0">
                  <Link
                    to={`/mon-inscription/${inscription.id}`}
                    className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
                  >
                    Voir / Modifier
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

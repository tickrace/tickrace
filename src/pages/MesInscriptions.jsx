import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import { Link } from "react-router-dom";

export default function MesInscriptions() {
  const { session } = useUser();
  const [inscriptions, setInscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    const fetchInscriptions = async () => {
      if (!session?.user?.id) return;

      const { data, error } = await supabase
        .from("inscriptions")
        .select(`
          *,
          formats (
            id, nom, distance_km, denivele_dplus, date,
            courses (
              id, nom, ville, pays, image_url
            )
          )
        `)
        .eq("coureur_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erreur chargement des inscriptions :", error);
        setErreur("Erreur lors du chargement.");
      } else {
        setInscriptions(data);
      }

      setLoading(false);
    };

    fetchInscriptions();
  }, [session]);

  if (loading) return <div className="p-4">Chargement...</div>;
  if (erreur) return <div className="p-4 text-red-500">{erreur}</div>;
  if (inscriptions.length === 0) return <div className="p-4">Aucune inscription trouvée.</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Mes inscriptions</h1>

      <div className="space-y-4">
        {inscriptions.map((insc) => (
          <div key={insc.id} className="border rounded-lg p-4 shadow bg-white">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
              <div>
                <h2 className="text-lg font-semibold">
                  {insc.formats?.courses?.nom || "Course inconnue"} – {insc.formats?.nom}
                </h2>
                <p className="text-sm text-gray-600">
                  {insc.formats?.courses?.ville}, {insc.formats?.courses?.pays} — {insc.formats?.date}
                </p>
                <p className="text-sm mt-1 text-gray-500">Statut : {insc.statut}</p>
              </div>
              <Link
                to={`/moninscription/${insc.id}`}
                className="mt-3 sm:mt-0 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Voir / Modifier
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

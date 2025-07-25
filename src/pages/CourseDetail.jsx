import React, { useEffect, useState, lazy, Suspense } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabase";

const GPXViewer = lazy(() => import("../components/GPXViewer"));

export default function CourseDetail() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, formats(*)")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Erreur de chargement :", error);
      } else {
        setCourse(data);
        setFormats(data.formats || []);
      }
    };
    fetchData();
  }, [id]);

  if (!course) return <div className="p-6">Chargement...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-2 text-gray-800">{course.nom}</h1>
      <p className="text-gray-600 mb-4">
        📍 {course.lieu} ({course.departement})
      </p>
      {course.image_url && (
        <img
          src={course.image_url}
          alt={course.nom}
          className="rounded-xl shadow-md mb-6 w-full max-h-[400px] object-cover"
        />
      )}
      <p className="text-md mb-6 text-gray-700 leading-relaxed">
        {course.presentation}
      </p>

      <h2 className="text-2xl font-semibold mb-4 text-gray-800">🎽 Formats proposés</h2>

      {formats.length === 0 ? (
        <p className="text-gray-600 italic">Aucun format encore enregistré pour cette épreuve.</p>
      ) : (
        <div className="space-y-6">
          {formats.map((format) => (
            <div key={format.id} className="bg-gray-50 rounded-lg shadow p-4">
              <h3 className="text-xl font-bold text-blue-700 mb-2">{format.nom}</h3>
              {format.image_url && (
                <img
                  src={format.image_url}
                  alt={format.nom}
                  className="rounded mb-3 w-full max-h-[250px] object-cover"
                />
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                <p><strong>📅 Date :</strong> {format.date} à {format.heure_depart}</p>
                <p><strong>📏 Distance :</strong> {format.distance_km} km</p>
                <p><strong>⛰️ D+ / D- :</strong> {format.denivele_dplus} / {format.denivele_dmoins} m</p>
                <p><strong>🏃 Type :</strong> {format.type_epreuve}</p>
                <p><strong>🎯 Départ :</strong> {format.adresse_depart}</p>
                <p><strong>🏁 Arrivée :</strong> {format.adresse_arrivee}</p>
                <p><strong>💰 Prix :</strong> {format.prix} €</p>
                <p><strong>🎒 Dotation :</strong> {format.dotation}</p>
              </div>
              {format.presentation_parcours && (
                <p className="mt-3 text-gray-600 italic">
                  {format.presentation_parcours}
                </p>
              )}

              {/* GPX + profil (chargement dynamique) */}
              {format.gpx_url && (
                <Suspense fallback={<p>Chargement de la carte...</p>}>
                  <GPXViewer gpxUrl={format.gpx_url} />
                </Suspense>
              )}

              <div className="mt-4 text-right">
                <Link
                  to={`/inscription/${course.id}`}
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-5 py-2 rounded shadow"
                >
                  S’inscrire
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

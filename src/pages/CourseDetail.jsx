import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabase";

export default function CourseDetail() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourse = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, formats(*)")
        .eq("id", id)
        .single();

      if (!error) setCourse(data);
      setLoading(false);
    };

    fetchCourse();
  }, [id]);

  if (loading) return <div className="p-6">Chargement...</div>;
  if (!course) return <div className="p-6 text-red-600">Épreuve introuvable</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold">{course.nom}</h1>
      <p className="text-gray-600 text-lg">{course.lieu} ({course.departement})</p>

      {course.image_url && (
        <img
          src={course.image_url}
          alt={course.nom}
          className="w-full max-h-96 object-cover rounded-xl shadow"
        />
      )}

      <div>
        <h2 className="text-2xl font-semibold mt-8 mb-2">Présentation</h2>
        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{course.presentation}</p>
      </div>

      {course.formats?.length > 0 && (
        <div className="mt-10">
          <h2 className="text-2xl font-semibold mb-4">Formats disponibles</h2>
          <div className="space-y-6">
            {course.formats.map((format) => (
              <div key={format.id} className="border rounded-xl p-5 bg-gray-50 shadow-md space-y-2">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <h3 className="text-xl font-bold">{format.nom}</h3>
                    <p className="text-sm text-gray-500">
                      {format.date} à {format.heure_depart}
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-700">
                    <p>{format.distance_km} km</p>
                    <p>{format.denivele_dplus} D+ / {format.denivele_dmoins} D-</p>
                  </div>
                </div>

                {format.presentation_parcours && (
                  <p className="text-gray-700">{format.presentation_parcours}</p>
                )}

                <div className="pt-2">
                  <Link
                    to={`/inscription/${course.id}`}
                    className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
                  >
                    S’inscrire
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

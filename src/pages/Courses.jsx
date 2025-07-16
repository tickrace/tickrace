import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, formats(*)");

      if (error) {
        console.error("Erreur de chargement des courses :", error.message);
      } else {
        setCourses(data);
      }

      setLoading(false);
    };

    fetchCourses();
  }, []);

  if (loading) return <p className="p-6">Chargement...</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Toutes les épreuves</h1>
      {courses.length === 0 ? (
        <p>Aucune course enregistrée.</p>
      ) : (
        <ul className="space-y-6">
          {courses.map((course) => (
            <li key={course.id} className="border rounded p-4 shadow">
              <h2 className="text-xl font-semibold">{course.nom}</h2>
              {course.sous_nom && <p className="text-gray-600">{course.sous_nom}</p>}
              <p className="text-sm text-gray-500">{course.lieu} – {course.date}</p>

              {course.image_url && (
                <div className="my-4">
                  <img
                    src={course.image_url}
                    alt={`Affiche de ${course.nom}`}
                    className="max-w-full h-auto rounded"
                  />
                </div>
              )}

              {course.formats && course.formats.length > 0 && (
                <div className="mt-2">
                  <h3 className="font-semibold mb-1">Formats :</h3>
                  <ul className="list-disc list-inside text-sm">
                    {course.formats.map((format, index) => (
                      <li key={index}>
                        {format.nom_format} – {format.distance_km} km / {format.denivele_dplus} m D+
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

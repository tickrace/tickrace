import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { Link } from "react-router-dom";

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, formats(*)")
        .order("date", { ascending: true });

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
      <h1 className="text-2xl font-bold mb-4">Toutes les courses</h1>
      {courses.length === 0 ? (
        <p>Aucune course enregistrée.</p>
      ) : (
        <ul className="space-y-4">
          {courses.map((course) => (
            <li key={course.id} className="border p-4 rounded shadow-sm flex gap-4">
              {course.image_url && (
                <img
                  src={`https://pecotcxpcqfkwvyylvjv.supabase.co/storage/v1/object/public/courses/${course.image_url}`}
                  alt={course.nom}
                  className="w-32 h-20 object-cover rounded"
                />
              )}

              <div>
                <Link
                  to={`/courses/${course.id}`}
                  className="text-lg font-semibold text-blue-600 underline"
                >
                  {course.nom}
                </Link>
                {course.sous_nom && (
                  <p className="text-sm text-gray-600">{course.sous_nom}</p>
                )}
                <p className="text-sm">
                  {course.lieu} – {course.date}
                </p>

                {course.formats && course.formats.length > 0 && (
                  <div className="mt-2">
                    <p className="font-semibold text-sm mb-1">Formats :</p>
                    <ul className="list-disc list-inside text-sm">
                      {course.formats.map((format) => (
                        <li key={format.id}>
                          {format.nom_format} – {format.distance_km} km,{" "}
                          {format.denivele_dplus} D+
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

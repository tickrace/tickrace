import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [formatsByCourse, setFormatsByCourse] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCoursesAndFormats = async () => {
      setLoading(true);

      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select("*");

      if (coursesError) {
        console.error("Erreur de chargement des courses :", coursesError.message);
        setLoading(false);
        return;
      }

      const { data: formatsData, error: formatsError } = await supabase
        .from("formats")
        .select("*");

      if (formatsError) {
        console.error("Erreur de chargement des formats :", formatsError.message);
        setLoading(false);
        return;
      }

      const groupedFormats = {};
      formatsData.forEach((format) => {
        if (!groupedFormats[format.event_id]) {
          groupedFormats[format.event_id] = [];
        }
        groupedFormats[format.event_id].push(format);
      });

      setCourses(coursesData);
      setFormatsByCourse(groupedFormats);
      setLoading(false);
    };

    fetchCoursesAndFormats();
  }, []);

  if (loading) return <p className="p-6">Chargement...</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Toutes les épreuves</h1>
      {courses.length === 0 ? (
        <p>Aucune course disponible.</p>
      ) : (
        <ul className="space-y-4">
          {courses.map((course) => (
            <li key={course.id} className="border p-4 rounded shadow-sm">
              <h2 className="text-xl font-semibold">{course.nom}</h2>
              {course.sous_nom && <p className="text-gray-600">{course.sous_nom}</p>}
              <p className="text-sm mb-2">{course.lieu} – {course.date}</p>
              {course.image_url && (
                <img
                  src={course.image_url}
                  alt={course.nom}
                  className="w-full max-w-xs mb-4"
                />
              )}
              {formatsByCourse[course.id] ? (
                <div className="mt-2">
                  <h3 className="font-bold mb-1">Formats :</h3>
                  <ul className="list-disc list-inside">
                    {formatsByCourse[course.id].map((format) => (
                      <li key={format.id}>
                        {format.nom} – {format.distance_km} km, {format.denivele_dplus} m D+
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Aucun format renseigné.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

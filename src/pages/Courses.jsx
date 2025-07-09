import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourses() {
      const { data, error } = await supabase
        .from("courses")
        .select("id, nom, lieu, date, distance_km, denivele_dplus, denivele_dmoins, cote_itra, photo_url")
        .order("date", { ascending: true });

      if (error) {
        console.error("Erreur lors de la récupération des courses:", error.message);
      } else {
        setCourses(data);
      }
      setLoading(false);
    }

    fetchCourses();
  }, []);

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Toutes les épreuves</h1>

      {loading && <p>Chargement...</p>}

      {!loading && courses.length === 0 && <p>Aucune épreuve trouvée.</p>}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <div key={course.id} className="border rounded-xl p-4 shadow-md bg-white">
            {course.photo_url && (
              <img
                src={`https://pecotcxpcqfkwvyylvjv.supabase.co/storage/v1/object/public/courses/${course.photo_url}`}
                alt={course.nom}
                className="w-full h-40 object-cover rounded mb-4"
              />
            )}
            <h2 className="text-xl font-semibold mb-1">{course.nom}</h2>
            <p className="text-sm text-gray-600 mb-2">📍 {course.lieu} – 📅 {new Date(course.date).toLocaleDateString()}</p>
            <p className="text-sm">{course.distance_km} km – D+ {course.denivele_dplus} m – D- {course.denivele_dmoins} m</p>
            {course.cote_itra && <p className="text-sm mt-1">🔢 Cote ITRA : {course.cote_itra}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

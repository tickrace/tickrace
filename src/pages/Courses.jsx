import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .order("date", { ascending: true });

      if (error) {
        console.error("Erreur de chargement :", error);
      } else {
        setCourses(data);
      }

      setLoading(false);
    };

    fetchCourses();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">📅 Épreuves à venir</h1>
      {loading ? (
        <p>Chargement...</p>
      ) : courses.length === 0 ? (
        <p>Aucune épreuve trouvée.</p>
      ) : (
        <ul className="space-y-4">
          {courses.map((course) => (
            <li key={course.id} className="border p-4 rounded shadow">
              <h2 className="text-lg font-semibold">{course.nom}</h2>
              <p>📍 {course.lieu}</p>
              <p>📆 {new Date(course.date).toLocaleDateString()}</p>
              <p>🏃 {course.distance_km} km / D+ {course.denivele_dplus} m</p>
              <p>🎯 Cote ITRA : {course.cote_itra || "N/A"}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

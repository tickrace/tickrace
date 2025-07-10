import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function EspaceOrganisateur() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) return;

      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("organisateur_id", user.id)
        .order("date", { ascending: true });

      if (!error) {
        setCourses(data);
      }

      setLoading(false);
    };

    fetchCourses();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Mes courses</h1>
      {loading ? (
        <p>Chargement…</p>
      ) : courses.length === 0 ? (
        <p>Aucune course pour l’instant.</p>
      ) : (
        <ul className="space-y-4">
          {courses.map((course) => (
            <li key={course.id} className="border p-4 rounded">
              <h2 className="font-bold text-lg">{course.nom}</h2>
              <p>{course.lieu} — {course.date}</p>
              <p>D+ {course.denivele_dplus} m — {course.distance_km} km</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

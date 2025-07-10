import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function EspaceOrganisateur() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("organisateur_id", user.id);

      if (!error) setCourses(data);
      setLoading(false);
    };

    fetchCourses();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Mes courses</h1>
      {loading ? (
        <p>Chargement...</p>
      ) : (
        <ul>
          {courses.map((course) => (
            <li key={course.id} className="border-b py-2">
              {course.nom} - {course.date}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

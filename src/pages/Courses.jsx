import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("courses")
        .select("nom, sous_nom, lieu, date, type_epreuve, image_url")
        .order("date", { ascending: true });

      if (error) {
        console.error("Erreur de chargement des courses :", error);
        setErreur("Erreur de chargement des courses");
      } else {
        setCourses(data);
      }
      setLoading(false);
    };

    fetchCourses();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Toutes les épreuves</h1>

      {loading && <p>Chargement...</p>}
      {erreur && <p className="text-red-500">{erreur}</p>}

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
        {courses.map((course) => (
          <div key={course.nom + course.date} className="border rounded shadow p-4 bg-white">
            {course.image_url && (
              <img
                src={course.image_url}
                alt={course.nom}
                className="w-full h-48 object-cover rounded mb-4"
              />
            )}
            <h2 className="text-xl font-bold">{course.nom}</h2>
            {course.sous_nom && <p className="italic text-gray-600">{course.sous_nom}</p>}
            <p className="mt-2 text-sm text-gray-700">
              📍 {course.lieu} <br />
              🏁 {new Date(course.date).toLocaleDateString()} <br />
              🏷️ {course.type_epreuve}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

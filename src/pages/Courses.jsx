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

  if (loading) return <p className="p-6">Chargement des épreuves...</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Toutes les épreuves</h1>
      {courses.length === 0 ? (
        <p>Aucune épreuve enregistrée.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <li key={course.id} className="border rounded shadow p-4">
              <Link to={`/courses/${course.id}`} className="block hover:underline">
                <img
                  src={
                    course.image_url
                      ? `https://pecotcxpcqfkwvyylvjv.supabase.co/storage/v1/object/public/courses/${course.image_url}`
                      : "https://via.placeholder.com/400x200?text=Aucune+image"
                  }
                  alt={`Illustration de ${course.nom}`}
                  className="w-full h-48 object-cover rounded mb-4"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "https://via.placeholder.com/400x200?text=Image+indisponible";
                  }}
                />
                <h2 className="text-lg font-semibold">{course.nom}</h2>
                {course.sous_nom && <p className="text-sm text-gray-600">{course.sous_nom}</p>}
                <p className="text-sm text-gray-700">{course.lieu} – {course.date}</p>

                {course.formats?.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm text-gray-800">
                    {course.formats.map((format, index) => (
                      <li key={index}>
                        • {format.nom_format} – {format.distance} km / {format.dplus} m D+
                      </li>
                    ))}
                  </ul>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

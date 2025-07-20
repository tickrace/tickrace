import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      const { data: coursesData, error } = await supabase
        .from("courses")
        .select("*, formats(*)");

      if (!error) {
        setCourses(coursesData);
      }

      setLoading(false);
    };

    fetchCourses();
  }, []);

  if (loading) {
    return <div className="p-4">Chargement des épreuves...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Toutes les épreuves</h1>

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        {courses.map((course) => (
          <Link
            to={`/courses/${course.id}`}
            key={course.id}
            className="block border rounded-xl shadow-md overflow-hidden hover:shadow-lg transition"
          >
            {course.image_url ? (
              <img
                src={course.image_url}
                alt={course.nom}
                className="w-full h-48 object-cover"
              />
            ) : (
              <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-500">
                Pas d’image
              </div>
            )}

            <div className="p-4 space-y-2">
              <h2 className="text-xl font-semibold">{course.nom}</h2>
              <p className="text-sm text-gray-600">
                {course.lieu} ({course.departement})
              </p>

              {course.formats?.length > 0 && (
                <div className="text-sm text-gray-700 mt-2 space-y-1">
                  {course.formats.map((format) => (
                    <div key={format.id} className="flex justify-between text-sm border-t pt-1">
                      <span>{format.nom}</span>
                      <span>
                        {format.distance_km ?? "?"} km / {format.denivele_dplus ?? "?"} D+
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

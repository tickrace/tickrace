import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { Link } from "react-router-dom";

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [formats, setFormats] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select("*")
        .order("date", { ascending: true });

      const { data: formatsData, error: formatsError } = await supabase
        .from("formats")
        .select("*");

      if (coursesError) {
        console.error("Erreur de chargement des courses :", coursesError.message);
      } else {
        setCourses(coursesData);
      }

      if (formatsError) {
        console.error("Erreur de chargement des formats :", formatsError.message);
      } else {
        setFormats(formatsData);
      }
    };

    fetchData();
  }, []);

  const getFormatsForCourse = (courseId) => {
    return formats.filter((format) => format.event_id === courseId);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Toutes les épreuves</h1>
      {courses.length === 0 ? (
        <p>Aucune course disponible.</p>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2">
          {courses.map((course) => (
            <li key={course.id} className="border rounded p-4 shadow">
              {course.image_url && (
                <img
                  src={course.image_url}
                  alt={`Affiche ${course.nom}`}
                  className="mb-4 rounded w-full object-cover h-48"
                />
              )}
              <h2 className="text-xl font-bold">{course.nom}</h2>
              {course.sous_nom && (
                <p className="text-gray-600 text-sm mb-1">{course.sous_nom}</p>
              )}
              <p className="text-sm">
                📍 {course.lieu} — 🗓 {new Date(course.date).toLocaleDateString()}
              </p>

              <div className="mt-4">
                {getFormatsForCourse(course.id).map((format) => (
                  <div key={format.id} className="border-t pt-2 mt-2">
                    <p className="text-sm font-semibold">{format.nom}</p>
                    <p className="text-sm">
                      {format.distance_km} km / {format.denivele_dplus} D+
                    </p>
                    {format.heure_depart && (
                      <p className="text-sm">⏰ Départ : {format.heure_depart}</p>
                    )}
                    {format.prix && (
                      <p className="text-sm">💶 Prix : {format.prix} €</p>
                    )}
                  </div>
                ))}
              </div>

              <Link
                to={`/courses/${course.id}`}
                className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                En savoir plus
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

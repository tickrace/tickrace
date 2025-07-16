import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { Link } from "react-router-dom";

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [formats, setFormats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select("*");

      const { data: formatsData, error: formatsError } = await supabase
        .from("formats")
        .select("*");

      if (coursesError) {
        console.error("Erreur chargement courses :", coursesError.message);
      } else {
        setCourses(coursesData || []);
      }

      if (formatsError) {
        console.error("Erreur chargement formats :", formatsError.message);
      } else {
        setFormats(formatsData || []);
      }

      setLoading(false);
    };

    fetchCourses();
  }, []);

  const getFormatsForCourse = (courseId) =>
    formats.filter((f) => f.course_id === courseId);

  if (loading) return <p className="p-6">Chargement...</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Toutes les épreuves</h1>
      <ul className="space-y-6">
        {courses.map((course) => (
          <li key={course.id} className="border p-4 rounded shadow-sm">
            <div className="flex gap-4 items-center">
              {course.image_url && (
                <img
                  src={`https://pecotcxpcqfkwvyylvjv.supabase.co/storage/v1/object/public/courses/${course.image_url}`}
                  alt={course.nom}
                  className="w-28 h-20 object-cover rounded"
                />
              )}
              <div className="flex-1">
                <Link
                  to={`/courses/${course.id}`}
                  className="text-xl font-semibold hover:underline"
                >
                  {course.nom}
                </Link>
                {course.sous_nom && (
                  <p className="text-gray-600 text-sm">{course.sous_nom}</p>
                )}
                <p className="text-sm">
                  📍 {course.lieu} — 📅 {course.date}
                </p>
                <ul className="text-sm mt-2 space-y-1">
                  {getFormatsForCourse(course.id).map((format, i) => (
                    <li key={i} className="ml-2 list-disc">
                      {format.nom_format} : {format.distance_km} km / {format.dplus} m D+
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

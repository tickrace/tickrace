// src/pages/Courses.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function Courses() {
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, nom, lieu, date, image_url");

      if (error) {
        console.error("Erreur de chargement des courses :", error.message);
      } else {
        setCourses(data);
      }
    };

    fetchCourses();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Épreuves à venir</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {courses.map((course) => (
          <div key={course.id} className="border rounded shadow hover:shadow-lg transition">
            {course.image_url && (
              <img
                src={course.image_url}
                alt={course.nom}
                className="w-full h-48 object-cover rounded-t"
              />
            )}
            <div className="p-4">
              <h2 className="text-xl font-semibold">{course.nom}</h2>
              <p className="text-gray-600">{course.lieu}</p>
              <p className="text-sm text-gray-500">{new Date(course.date).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

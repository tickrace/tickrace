import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

const Courses = () => {
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .order("date", { ascending: true });

      if (error) {
        console.error("Erreur lors de la récupération des courses :", error);
      } else {
        setCourses(data);
      }
    };

    fetchCourses();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Toutes les épreuves</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((course) => (
          <div
            key={course.id}
            className="border rounded-lg p-4 shadow bg-white"
          >
            {course.image_url && (
              <img
                src={course.image_url}
                alt={course.nom}
                className="w-full h-48 object-cover rounded mb-2"
              />
            )}
            <h2 className="text-xl font-semibold">{course.nom}</h2>
            <p>{course.lieu}</p>
            <p>
              📅 {new Date(course.date).toLocaleDateString("fr-FR")}
            </p>
            <p>📏 {course.distance_km} km</p>
            <p>📈 D+ : {course.denivele_dplus} m</p>
            <p>📉 D- : {course.denivele_dmoins} m</p>
            {course.cote_itra && <p>🏁 Cote ITRA : {course.cote_itra}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Courses;

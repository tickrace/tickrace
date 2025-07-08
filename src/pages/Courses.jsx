import React, { useEffect, useState } from "react";

export default function Courses() {
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    fetch("/data/races.json")
      .then((res) => res.json())
      .then((data) => setCourses(data));
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Toutes les épreuves</h1>
      <ul className="space-y-3">
        {courses.map((course) => (
          <li key={course.id} className="border p-4 rounded shadow">
            <h2 className="text-lg font-bold">{course.nom}</h2>
            <p>{course.lieu} – {course.date}</p>
            {course.formats.map((f, i) => (
              <p key={i} className="text-sm">📏 {f.distance_km} km / {f.dplus} m D+</p>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
import React, { useEffect, useState } from "react";

export default function Home() {
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    fetch("/data/races.json")
      .then((res) => res.json())
      .then((data) => setCourses(data.slice(0, 3)));
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">🏃‍♂️ Bienvenue sur Tickrace</h1>
      <p className="mb-6">Explorez les épreuves de trail autour de chez vous.</p>
      <h2 className="text-xl font-semibold mb-2">Prochaines épreuves</h2>
      <ul className="space-y-3">
        {courses.map((course) => (
          <li key={course.id} className="border p-4 rounded shadow">
            <h3 className="text-lg font-bold">{course.nom}</h3>
            <p>{course.lieu} – {course.date}</p>
            {course.formats.map((f, i) => (
              <p key={i} className="text-sm">🟢 {f.distance_km} km / {f.dplus} m D+</p>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
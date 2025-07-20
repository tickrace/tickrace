import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [departement, setDepartement] = useState("all");
  const [type, setType] = useState("all");

  useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, formats(*)");

      if (!error) {
        setCourses(data);
        setFiltered(data);
      }

      setLoading(false);
    };

    fetchCourses();
  }, []);

  useEffect(() => {
    const filteredCourses = courses.filter((course) => {
      const matchSearch =
        course.nom.toLowerCase().includes(search.toLowerCase()) ||
        course.lieu.toLowerCase().includes(search.toLowerCase());

      const matchDep =
        departement === "all" || course.departement === departement;

      const matchType =
        type === "all" ||
        course.formats?.some((f) => f.type_epreuve === type);

      return matchSearch && matchDep && matchType;
    });

    setFiltered(filteredCourses);
  }, [search, departement, type, courses]);

  const departements = Array.from(
    new Set(courses.map((c) => c.departement).filter(Boolean))
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Toutes les épreuves</h1>

      <div className="flex flex-wrap gap-4 mb-6">
        <input
          type="text"
          placeholder="Rechercher une épreuve ou un lieu..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded w-full sm:w-64"
        />

        <select
          value={departement}
          onChange={(e) => setDepartement(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="all">Tous les départements</option>
          {departements.map((dep) => (
            <option key={dep} value={dep}>
              {dep}
            </option>
          ))}
        </select>

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="all">Tous les types</option>
          <option value="trail">Trail</option>
          <option value="rando">Rando</option>
          <option value="route">Route</option>
        </select>
      </div>

      {loading ? (
        <p>Chargement...</p>
      ) : filtered.length === 0 ? (
        <p>Aucune épreuve trouvée.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {filtered.map((course) => (
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
      )}
    </div>
  );
}

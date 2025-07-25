// src/pages/Courses.jsx
import React, { useEffect, useState, Suspense } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";
import "leaflet/dist/leaflet.css";

// Lazy load de la carte (optimisation)
const MapView = React.lazy(() => import("../components/CoursesMap"));

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [departement, setDepartement] = useState("all");
  const [type, setType] = useState("all");
  const [viewMode, setViewMode] = useState("list"); // "list" ou "map"

  useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase.from("courses").select("*, formats(*)");
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

  // Vérifie si une course est récente (moins de 30 jours)
  const isNew = (course) => {
    const createdAt = new Date(course.created_at);
    const now = new Date();
    return (now - createdAt) / (1000 * 60 * 60 * 24) <= 30;
  };

  // Vérifie si la course est terminée
  const isFinished = (course) => {
    const now = new Date();
    return (
      course.formats?.every((f) => new Date(f.date) < now) || false
    );
  };

  // Récupère la date la plus proche
  const getNextDate = (course) => {
    const futureDates = course.formats
      ?.map((f) => new Date(f.date))
      .filter((d) => d >= new Date())
      .sort((a, b) => a - b);
    return futureDates?.[0] ? futureDates[0].toLocaleDateString() : "Terminé";
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 flex justify-between items-center">
        <span>Toutes les épreuves</span>
        <button
          onClick={() => setViewMode(viewMode === "list" ? "map" : "list")}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {viewMode === "list" ? "Vue carte" : "Vue liste"}
        </button>
      </h1>

      {/* Filtres */}
      {viewMode === "list" && (
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
      )}

      {/* Loader */}
      {loading ? (
        <div className="flex justify-center items-center py-10">
          <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-600 text-lg mt-10">
          Aucune épreuve trouvée.
        </p>
      ) : viewMode === "map" ? (
        <Suspense fallback={<p>Chargement de la carte...</p>}>
          <MapView courses={filtered} />
        </Suspense>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {filtered.map((course) => (
            <Link
              to={`/courses/${course.id}`}
              key={course.id}
              className="block border rounded-xl shadow-md overflow-hidden hover:shadow-lg transition bg-white relative"
            >
              {/* Badges */}
              {isNew(course) && (
                <span className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                  Nouveau
                </span>
              )}
              {isFinished(course) && (
                <span className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                  Terminé
                </span>
              )}

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
                <h2 className="text-xl font-semibold text-gray-800">{course.nom}</h2>
                <p className="text-sm text-gray-600">
                  📍 {course.lieu} ({course.departement})
                </p>
                <p className="text-sm text-gray-500">
                  📅 Prochaine date : {getNextDate(course)}
                </p>
                {course.formats?.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {course.formats.map((format) => (
                      <div key={format.id} className="flex justify-between text-sm border-t pt-1">
                        <span className="font-medium">{format.nom}</span>
                        <span>
                          {format.distance_km ?? "?"} km / {format.denivele_dplus ?? "?"} m D+
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

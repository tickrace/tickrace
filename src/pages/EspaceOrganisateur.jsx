import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { Link } from "react-router-dom";

export default function EspaceOrganisateur() {
  const [courses, setCourses] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("organisateur_id", user.id);

      if (error) {
        console.error("Erreur de chargement des courses :", error.message);
      } else {
        setCourses(data);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) return <p className="p-6">Chargement...</p>;

  if (!user) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold mb-2">Espace organisateur</h2>
        <p>Veuillez vous connecter pour accéder à cet espace.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Mes épreuves</h2>
      <Link to="/organisateur" className="text-blue-600 underline">
        + Ajouter une nouvelle course
      </Link>

      {courses.length === 0 ? (
        <p className="mt-4">Aucune course enregistrée.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {courses.map((course) => (
            <li key={course.id} className="border p-4 rounded shadow-sm">
              <p className="font-semibold text-lg">{course.nom}</p>
              {course.sous_nom && (
                <p className="text-sm text-gray-600">{course.sous_nom}</p>
              )}
              <p className="text-sm">{course.lieu} – {course.date}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

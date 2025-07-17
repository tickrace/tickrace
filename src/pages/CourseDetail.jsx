import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabase";

export default function CourseDetail() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourse = async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("id", id).single();
      if (error) {
        console.error("Erreur chargement course :", error.message);
        setLoading(false);
        return;
      }
      setCourse(data);

      const { data: formatsData, error: formatsError } = await supabase
        .from("formats")
        .select("*")
        .eq("event_id", id);

      if (formatsError) {
        console.error("Erreur chargement formats :", formatsError.message);
      } else {
        setFormats(formatsData);
      }

      setLoading(false);
    };

    fetchCourse();
  }, [id]);

  if (loading) return <p className="p-6">Chargement...</p>;
  if (!course) return <p className="p-6">Course non trouvée.</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">{course.nom}</h1>

      {course.image_url && (
        <img
          src={course.image_url}
          alt={`Affiche ${course.nom}`}
          className="w-full max-w-2xl rounded mb-6 object-cover"
        />
      )}

      {course.sous_nom && <p className="text-gray-600 mb-2 italic">{course.sous_nom}</p>}
      <p className="text-sm mb-2">📍 {course.lieu}</p>
      <p className="text-sm mb-4">🗓 {new Date(course.date).toLocaleDateString()}</p>

      <h2 className="text-xl font-semibold mt-6 mb-2">Formats proposés</h2>
      {formats.length === 0 ? (
        <p>Aucun format enregistré pour cette course.</p>
      ) : (
        <ul className="space-y-4">
          {formats.map((format) => (
            <li key={format.id} className="border p-4 rounded bg-gray-50">
              <p className="font-bold">{format.nom}</p>
              <p>{format.distance_km} km / {format.denivele_dplus} m D+</p>
              {format.heure_depart && <p>⏰ Départ : {format.heure_depart}</p>}
              {format.prix && <p>💶 Prix : {format.prix} €</p>}
            </li>
          ))}
        </ul>
      )}

      <Link
        to={`/courses/${id}/inscription`}
        className="inline-block mt-8 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        S’inscrire
      </Link>
    </div>
  );
}

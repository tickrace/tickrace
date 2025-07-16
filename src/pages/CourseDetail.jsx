import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function CourseDetail() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourse = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Erreur chargement course :", error.message);
      } else {
        setCourse(data);

        // Charger les formats liés
        const { data: formatsData, error: formatsError } = await supabase
          .from("formats")
          .select("*")
          .eq("course_id", id);

        if (formatsError) {
          console.error("Erreur chargement formats :", formatsError.message);
        } else {
          setFormats(formatsData);
        }
      }

      setLoading(false);
    };

    fetchCourse();
  }, [id]);

  if (loading) return <p className="p-6">Chargement...</p>;
  if (!course) return <p className="p-6">Course introuvable.</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">{course.nom}</h2>
      {course.sous_nom && <h3 className="text-lg mb-4">{course.sous_nom}</h3>}
      <p className="text-sm text-gray-600 mb-2">{course.lieu} – {course.date}</p>

      {course.image_url && (
        <img
          src={`https://pecotcxpcqfkwvyylvjv.supabase.co/storage/v1/object/public/courses/${course.image_url}`}
          alt="Affiche de l’épreuve"
          className="w-full max-w-md mx-auto mb-6 rounded shadow"
        />
      )}

      <h4 className="text-xl font-semibold mt-6 mb-3">Formats proposés</h4>
      {formats.length === 0 ? (
        <p>Aucun format précisé.</p>
      ) : (
        <ul className="space-y-2">
          {formats.map((format) => (
            <li key={format.id} className="border p-4 rounded shadow-sm">
              <p className="font-semibold">{format.nom}</p>
              {format.distance_km && <p>Distance : {format.distance_km} km</p>}
              {format.denivele_dplus && <p>D+ : {format.denivele_dplus} m</p>}
              {format.denivele_dmoins && <p>D- : {format.denivele_dmoins} m</p>}
              {format.prix && <p>Tarif : {format.prix} €</p>}
            </li>
          ))}
        </ul>
      )}

      <button className="mt-6 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        S’inscrire
      </button>
    </div>
  );
}

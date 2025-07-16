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
      }
    };

    const fetchFormats = async () => {
      const { data, error } = await supabase
        .from("formats")
        .select("*")
        .eq("event_id", id);

      if (error) {
        console.error("Erreur chargement formats :", error.message);
      } else {
        setFormats(data);
      }
    };

    fetchCourse();
    fetchFormats();
    setLoading(false);
  }, [id]);

  if (loading || !course) return <p className="p-6">Chargement...</p>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-2">{course.nom}</h2>
      {course.sous_nom && <p className="text-lg text-gray-700">{course.sous_nom}</p>}
      <p className="mt-1 text-gray-600">{course.lieu} – {course.date}</p>
      <p className="text-sm text-gray-600 mb-4">Type : {course.type_epreuve}</p>

      {course.image_url && (
        <img
          src={`https://pecotcxpcqfkwvyylvjv.supabase.co/storage/v1/object/public/courses/${course.image_url}`}
          alt={course.nom}
          className="w-full max-w-xl mb-6 rounded shadow"
        />
      )}

      <h3 className="text-xl font-semibold mb-2">Formats disponibles :</h3>
      {formats.length === 0 ? (
        <p>Aucun format enregistré pour cette épreuve.</p>
      ) : (
        <ul className="space-y-4">
          {formats.map((format) => (
            <li key={format.id} className="border rounded p-4 shadow-sm">
              <p className="font-bold text-lg">{format.nom}</p>
              <p>Distance : {format.distance_km} km</p>
              <p>Dénivelé + : {format.denivele_dplus} m</p>
              <p>Dénivelé - : {format.denivele_dmoins} m</p>
              <p>Heure de départ : {format.heure_depart}</p>
              <p>Prix : {format.prix} €</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// src/pages/CourseDetail.jsx
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
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("*")
        .eq("id", id)
        .single();

      const { data: formatsData, error: formatsError } = await supabase
        .from("formats")
        .select("*")
        .eq("event_id", id);

      if (courseError) console.error(courseError.message);
      else setCourse(courseData);

      if (formatsError) console.error(formatsError.message);
      else setFormats(formatsData);

      setLoading(false);
    };

    fetchCourse();
  }, [id]);

  if (loading) return <p className="p-6">Chargement...</p>;

  if (!course) return <p className="p-6 text-red-500">Course non trouvée.</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{course.nom}</h1>
      {course.sous_nom && <p className="text-lg text-gray-600 mb-4">{course.sous_nom}</p>}
      <p className="mb-2">{course.lieu} — {course.date}</p>
      {course.image_url && (
        <img
          src={`https://pecotcxpcqfkwvyylvjv.supabase.co/storage/v1/object/public/courses/${course.image_url}`}
          alt={course.nom}
          className="mb-4 w-full h-auto rounded shadow"
        />
      )}
      <h2 className="text-xl font-semibold mt-6 mb-2">Formats disponibles</h2>
      {formats.length === 0 ? (
        <p>Aucun format renseigné.</p>
      ) : (
        <ul className="space-y-2">
          {formats.map((format) => (
            <li key={format.id} className="border p-4 rounded">
              <p className="font-semibold">{format.nom}</p>
              <p>{format.distance_km} km / {format.denivele_dplus} D+ / {format.denivele_dmoins} D-</p>
              <p>Départ : {format.heure_depart}</p>
              <p>Tarif : {format.prix} €</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function CoursePage() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);

  useEffect(() => {
    const fetchCourse = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("id", id)
        .single();

      if (data) setCourse(data);
    };

    const fetchFormats = async () => {
      const { data, error } = await supabase
        .from("formats")
        .select("*")
        .eq("event_id", id);

      if (data) setFormats(data);
    };

    fetchCourse();
    fetchFormats();
  }, [id]);

  if (!course) return <p className="p-4">Chargement...</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">{course.nom}</h1>
      {course.sous_nom && <p className="text-lg text-gray-600">{course.sous_nom}</p>}
      <p className="text-sm text-gray-500 mb-4">
        {course.lieu} — {new Date(course.date).toLocaleDateString()}
      </p>

      {course.image_url && (
        <img
          src={`https://pecotcxpcqfkwvyylvjv.supabase.co/storage/v1/object/public/courses/${course.image_url}`}
          alt={course.nom}
          className="w-full rounded-lg mb-6"
        />
      )}

      <h2 className="text-2xl font-semibold mb-2">Formats disponibles</h2>
      <ul className="space-y-2">
        {formats.map((format) => (
          <li key={format.id} className="border p-3 rounded">
            <p className="font-semibold">{format.nom}</p>
            <p>
              {format.distance_km} km / {format.denivele_dplus} D+ /{" "}
              {format.denivele_dmoins} D-
            </p>
            <p>Départ à {format.heure_depart}</p>
            <p>Prix : {format.prix} €</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
        console.error("Erreur lors du chargement de la course :", error.message);
      } else {
        setCourse(data);
      }
    };

    const fetchFormats = async () => {
      const { data, error } = await supabase
        .from("formats")
        .select("*")
        .eq("course_id", id);

      if (error) {
        console.error("Erreur lors du chargement des formats :", error.message);
      } else {
        setFormats(data);
      }

      setLoading(false);
    };

    fetchCourse();
    fetchFormats();
  }, [id]);

  if (loading) return <p className="p-6">Chargement...</p>;
  if (!course) return <p className="p-6">Épreuve introuvable.</p>;

  const imageUrl = course.image_url
    ? `https://pecotcxpcqfkwvyylvjv.supabase.co/storage/v1/object/public/courses/${course.image_url}`
    : null;

  return (
    <div className="p-6 max-w-3xl mx-auto">
     <h1 className="text-2xl font-bold mb-2">{course.nom}</h1>
{course?.sous_nom && <p className="text-gray-600">{course.sous_nom}</p>}

{course?.image_url ? (
  <img
    src={`https://pecotcxpcqfkwvyylvjv.supabase.co/storage/v1/object/public/courses/${course.image_url}`}
    alt={`Affiche de ${course.nom}`}
    className="w-full max-w-md mx-auto rounded-lg shadow-md mb-4"
  />
) : (
  <p className="text-gray-500 italic mb-4">Aucune image disponible</p>
)}


      <p><strong>Lieu :</strong> {course.lieu}</p>
      <p><strong>Date :</strong> {course.date}</p>
      <p><strong>Type :</strong> {course.type_epreuve}</p>

      {formats.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xl font-semibold mb-2">Formats proposés :</h3>
          <ul className="list-disc pl-6 space-y-1">
            {formats.map((format) => (
              <li key={format.id}>
                {format.nom_format} – {format.distance_km} km / {format.dplus} m D+
                {format.prix && ` – ${format.prix} €`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

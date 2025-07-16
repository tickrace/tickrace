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
        console.error("Erreur de chargement de la course :", error.message);
      } else {
        setCourse(data);
        console.log("Image URL brute :", data.image_url);
      }

      setLoading(false);
    };

    const fetchFormats = async () => {
      const { data, error } = await supabase
        .from("formats")
        .select("*")
        .eq("course_id", id);

      if (error) {
        console.error("Erreur de chargement des formats :", error.message);
      } else {
        setFormats(data);
      }
    };

    fetchCourse();
    fetchFormats();
  }, [id]);

  if (loading) return <p className="p-6">Chargement...</p>;
  if (!course) return <p className="p-6">Course introuvable.</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">{course.nom}</h1>

      {course.image_url && (
        <img
          src={`https://pecotcxpcqfkwvyylvjv.supabase.co/storage/v1/object/public/courses/${course.image_url}`}
          alt="Affiche de l’épreuve"
          className="w-full max-h-96 object-contain mb-6 border"
          onError={(e) => {
            console.error("Image non trouvée :", e.target.src);
            e.target.onerror = null;
            e.target.src = "/default.jpg"; // ou laisse vide
          }}
        />
      )}

      {course.sous_nom && <p className="text-lg italic mb-2">{course.sous_nom}</p>}

      <p className="text-md mb-2">
        <strong>Lieu :</strong> {course.lieu}
      </p>
      <p className="text-md mb-2">
        <strong>Date :</strong> {course.date}
      </p>
      <p className="text-md mb-4">
        <strong>Type :</strong> {course.type_epreuve}
      </p>

      {formats.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">Formats disponibles</h2>
          <ul className="space-y-2">
            {formats.map((format) => (
              <li key={format.id} className="border rounded p-4 shadow-sm">
                <p className="font-semibold">{format.nom_format}</p>
                <p>Distance : {format.distance_km} km</p>
                <p>D+ : {format.denivele_dplus} m</p>
                <p>D– : {format.denivele_dmoins} m</p>
                {format.prix && <p>Prix : {format.prix} €</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

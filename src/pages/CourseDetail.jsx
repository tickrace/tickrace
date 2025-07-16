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
      // Chargement des infos de la course
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("*")
        .eq("id", id)
        .single();

      if (courseError) {
        console.error("Erreur chargement course :", courseError.message);
      } else {
        setCourse(courseData);
      }

      // Chargement des formats liés
      const { data: formatsData, error: formatsError } = await supabase
        .from("formats")
        .select("*")
        .eq("course_id", id);

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
  if (!course) return <p className="p-6 text-red-600">Course non trouvée.</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{course.nom}</h1>
      {course.sous_nom && <h2 className="text-lg text-gray-600 mb-4">{course.sous_nom}</h2>}
      <p className="text-sm text-gray-500 mb-4">
        {course.lieu} – {course.date}
      </p>

      {course.image_url && (
        <img
          src={`https://pecotcxpcqfkwvyylvjv.supabase.co/storage/v1/object/public/courses/${course.image_url}`}
          alt="Affiche de l’épreuve"
          className="w-full max-w-xl mb-6 rounded"
        />
      )}

      {formats.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">Formats disponibles</h3>
          <ul className="space-y-3">
            {formats.map((format) => (
              <li key={format.id} className="border p-4 rounded shadow">
                <p className="font-bold">{format.nom_format}</p>
                <p>
                  {format.distance_km} km – {format.denivele_dplus} m D+
                </p>
                {format.prix && <p className="text-green-600 font-semibold">Prix : {format.prix} €</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded">
        S'inscrire
      </button>
    </div>
  );
}

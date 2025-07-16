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
        if (data.id) {
          const { data: formatsData, error: formatsError } = await supabase
            .from("formats")
            .select("*")
            .eq("course_id", data.id);

          if (formatsError) {
            console.error("Erreur chargement formats :", formatsError.message);
          } else {
            setFormats(formatsData);
          }
        }
      }

      setLoading(false);
    };

    fetchCourse();
  }, [id]);

  if (loading) return <p className="p-6">Chargement...</p>;
  if (!course) return <p className="p-6">Course non trouvée.</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">{course.nom}</h2>
      {course.sous_nom && <p className="text-lg text-gray-600 mb-4">{course.sous_nom}</p>}
      
      {course.image_url && (
        <img
          src={`https://pecotcxpcqfkwvyylvjv.supabase.co/storage/v1/object/public/courses/${course.image_url}`}
          alt="Affiche de l’épreuve"
          className="w-full max-h-96 object-contain mb-6 border"
        />
      )}

      <p><strong>Lieu :</strong> {course.lieu}</p>
      <p><strong>Date :</strong> {course.date}</p>
      <p><strong>Type :</strong> {course.type_epreuve}</p>

      <div className="mt-6">
        <h3 className="text-xl font-semibold mb-2">Formats proposés :</h3>
        {formats.length === 0 ? (
          <p>Aucun format enregistré.</p>
        ) : (
          <ul className="space-y-2">
            {formats.map((format) => (
              <li key={format.id} className="border p-4 rounded">
                <p className="font-semibold">{format.nom}</p>
                {format.distance_km && <p>Distance : {format.distance_km} km</p>}
                {format.denivele_dplus && <p>D+ : {format.denivele_dplus} m</p>}
                {format.denivele_dmoins && <p>D- : {format.denivele_dmoins} m</p>}
                {format.prix && <p>Prix : {format.prix} €</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

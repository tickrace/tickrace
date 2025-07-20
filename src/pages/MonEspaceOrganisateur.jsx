import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import { Copy, Check } from "lucide-react";

export default function MonEspaceOrganisateur() {
  const { session } = useUser();
  const [courses, setCourses] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (session) {
      fetchCourses();
    }
  }, [session]);

  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("organisateur_id", session.user.id);

    if (!error) setCourses(data);
  };

  const handleDelete = async (id) => {
    const confirm = window.confirm("Supprimer cette course ?");
    if (!confirm) return;

    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (!error) {
      setCourses((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const handleCopy = (id) => {
    const url = `${window.location.origin}/courses/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDuplicate = async (course) => {
    const { id, created_at, ...fieldsToCopy } = course;

    const { data: duplicatedCourse, error: courseError } = await supabase
      .from("courses")
      .insert({ ...fieldsToCopy, nom: course.nom + " (copie)" })
      .select()
      .single();

    if (courseError) return alert("Erreur duplication épreuve");

    const { data: formats, error: formatsError } = await supabase
      .from("formats")
      .select("*")
      .eq("course_id", id);

    if (!formatsError && formats.length > 0) {
      const cleanedFormats = formats.map(({ id, created_at, ...f }) => ({
        ...f,
        course_id: duplicatedCourse.id,
      }));

      const { error: insertFormatsError } = await supabase
        .from("formats")
        .insert(cleanedFormats);

      if (insertFormatsError) {
        console.error("Erreur insertion formats :", insertFormatsError);
        alert("Épreuve copiée sans les formats (erreur insertion).");
      }
    }

    fetchCourses();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Mon espace organisateur</h1>
      {courses.length === 0 ? (
        <p>Aucune épreuve créée.</p>
      ) : (
        <div className="space-y-6">
          {courses.map((course) => (
            <div key={course.id} className="border rounded-lg p-4 bg-white shadow">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold">{course.nom}</h2>
                <span className="text-sm text-gray-600">{course.lieu} ({course.departement})</span>
              </div>
              <p className="text-gray-700 mb-3">{course.presentation}</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/organisateur/modifier-course/${course.id}`}
                  className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                >
                  ✏️ Modifier
                </Link>
                <Link
                  to={`/courses/${course.id}`}
                  className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
                >
                  🔍 Voir la page publique
                </Link>
                <button
                  onClick={() => handleDuplicate(course)}
                  className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                >
                  📄 Dupliquer
                </button>
                <button
                  onClick={() => handleDelete(course.id)}
                  className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                >
                  🗑️ Supprimer
                </button>
                <button
                  onClick={() => handleCopy(course.id)}
                  className="flex items-center gap-1 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                >
                  {copiedId === course.id ? (
                    <>
                      <Check size={16} />
                      Copié
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      Copier le lien
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

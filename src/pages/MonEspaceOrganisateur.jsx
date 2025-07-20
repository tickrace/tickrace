import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import { Pencil, Eye, PlusCircle, Trash2, Clipboard } from "lucide-react";

export default function MonEspaceOrganisateur() {
  const { session } = useUser();
  const [courses, setCourses] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (session) fetchCourses();
  }, [session]);

  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("organisateur_id", session.user.id)
      .order("created_at", { ascending: false });

    if (!error) setCourses(data);
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm("Voulez-vous vraiment supprimer cette épreuve ?");
    if (!confirmed) return;

    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (!error) {
      alert("Épreuve supprimée.");
      fetchCourses();
    }
  };

  const handleCopyLink = (id) => {
    const url = `${window.location.origin}/courses/${id}`;
    navigator.clipboard.writeText(url);
    alert("Lien copié !");
  };

  const handleDuplicate = async (course) => {
    const { data: duplicatedCourse, error: duplicateError } = await supabase
      .from("courses")
      .insert({
        nom: course.nom + " (copie)",
        lieu: course.lieu,
        departement: course.departement,
        presentation: course.presentation,
        image_url: course.image_url,
        organisateur_id: course.organisateur_id,
      })
      .select()
      .single();

    if (duplicateError) {
      alert("Erreur duplication.");
      return;
    }

    const { data: formats, error: formatsError } = await supabase
      .from("formats")
      .select("*")
      .eq("course_id", course.id);

    if (!formatsError && formats.length > 0) {
      const newFormats = formats.map((f) => ({
        ...f,
        course_id: duplicatedCourse.id,
        id: undefined,
        created_at: undefined,
      }));
      await supabase.from("formats").insert(newFormats);
    }

    alert("Épreuve dupliquée !");
    fetchCourses();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Mes épreuves organisées</h1>

      {courses.length === 0 ? (
        <p className="text-gray-600">Aucune course créée pour l’instant.</p>
      ) : (
        <div className="space-y-6">
          {courses.map((course) => (
            <div
              key={course.id}
              className="border border-gray-200 rounded-xl p-4 bg-white shadow hover:shadow-md transition"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold text-gray-800">
                  {course.nom}
                  {course.nom.includes("(copie)") && (
                    <span className="ml-2 text-sm bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full">
                      Copie
                    </span>
                  )}
                </h2>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                📍 {course.lieu} ({course.departement})
              </p>

              <div className="flex flex-wrap gap-4 text-sm">
                <button
                  onClick={() => navigate(`/organisateur/modifier-course/${course.id}`)}
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Pencil className="w-4 h-4" />
                  Modifier
                </button>
                <button
                  onClick={() => navigate(`/courses/${course.id}`)}
                  className="text-green-600 hover:underline flex items-center gap-1"
                >
                  <Eye className="w-4 h-4" />
                  Voir la page publique
                </button>
                <button
                  onClick={() => handleDuplicate(course)}
                  className="text-purple-600 hover:underline flex items-center gap-1"
                >
                  <PlusCircle className="w-4 h-4" />
                  Dupliquer
                </button>
                <button
                  onClick={() => handleDelete(course.id)}
                  className="text-red-600 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </button>
                <button
                  onClick={() => handleCopyLink(course.id)}
                  className="text-gray-600 hover:underline flex items-center gap-1"
                >
                  <Clipboard className="w-4 h-4" />
                  Copier le lien
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

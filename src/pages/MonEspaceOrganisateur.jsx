import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import {
  Pencil,
  Eye,
  Copy,
  Trash2,
  CopyCheck,
  CopyPlus
} from "lucide-react";

export default function MonEspaceOrganisateur() {
  const [courses, setCourses] = useState([]);
  const { session } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCourses = async () => {
      const userId = session?.user?.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("organisateur_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erreur chargement des épreuves", error);
      } else {
        setCourses(data);
      }
    };

    fetchCourses();
  }, [session]);

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette épreuve ?")) return;
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) {
      alert("Erreur suppression");
    } else {
      setCourses((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const handleDuplicate = async (id) => {
    const original = courses.find((c) => c.id === id);
    if (!original) return;

    const { data, error } = await supabase.from("courses").insert({
      ...original,
      nom: original.nom + " (copie)",
      created_at: new Date().toISOString(),
    });
    if (!error) {
      alert("Épreuve dupliquée");
    }
  };

  const handleCopyLink = (id) => {
    const url = `${window.location.origin}/courses/${id}`;
    navigator.clipboard.writeText(url);
    alert("Lien copié dans le presse-papiers");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Mes épreuves organisées</h1>
      {courses.length === 0 ? (
        <p>Aucune épreuve créée pour le moment.</p>
      ) : (
        <ul className="space-y-4">
          {courses.map((course) => (
            <li key={course.id} className="border rounded p-4 bg-white shadow">
              <h2 className="text-xl font-semibold mb-2">{course.nom}</h2>
              <p className="text-sm text-gray-600">{course.lieu} ({course.departement})</p>
              <p className="mt-2 text-sm">{course.presentation}</p>
              <div className="flex flex-wrap gap-3 mt-4 text-sm">
                <Link
                  to={`/organisateur/modifier-course/${course.id}`}
                  className="flex items-center gap-1 text-blue-600 hover:underline"
                >
                  <Pencil size={16} />
                  Modifier
                </Link>

                <Link
                  to={`/courses/${course.id}`}
                  className="flex items-center gap-1 text-green-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Eye size={16} />
                  Voir publique
                </Link>

                <button
                  onClick={() => handleDuplicate(course.id)}
                  className="flex items-center gap-1 text-yellow-600 hover:underline"
                >
                  <CopyPlus size={16} />
                  Dupliquer
                </button>

                <button
                  onClick={() => handleDelete(course.id)}
                  className="flex items-center gap-1 text-red-600 hover:underline"
                >
                  <Trash2 size={16} />
                  Supprimer
                </button>

                <button
                  onClick={() => handleCopyLink(course.id)}
                  className="flex items-center gap-1 text-purple-600 hover:underline"
                >
                  <CopyCheck size={16} />
                  Copier le lien
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

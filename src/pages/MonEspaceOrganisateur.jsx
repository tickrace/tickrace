// src/pages/MonEspaceOrganisateur.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import { Copy, Check } from "lucide-react";

export default function MonEspaceOrganisateur() {
  const { session } = useUser();
  const [courses, setCourses] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [inscriptionsParFormat, setInscriptionsParFormat] = useState({});
  const [repasParFormat, setRepasParFormat] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (session) {
      fetchCoursesAndFormats();
    }
  }, [session]);

  const fetchCoursesAndFormats = async () => {
    setLoading(true);
    const { data: coursesData, error } = await supabase
      .from("courses")
      .select("*, formats(*)")
      .eq("organisateur_id", session.user.id)
      .order("created_at", { ascending: false });

    if (!error && coursesData) {
      setCourses(coursesData);

      const allFormatIds = coursesData.flatMap((c) =>
        (c.formats || []).map((f) => f.id)
      );

      if (allFormatIds.length > 0) {
        const { data: inscriptions, error: errIns } = await supabase
          .from("inscriptions")
          .select("format_id, nombre_repas");

        if (!errIns && inscriptions) {
          const counts = {};
          const repasCounts = {};

          inscriptions.forEach((i) => {
            counts[i.format_id] = (counts[i.format_id] || 0) + 1;
            const repas = parseInt(i.nombre_repas || 0);
            repasCounts[i.format_id] = (repasCounts[i.format_id] || 0) + repas;
          });

          setInscriptionsParFormat(counts);
          setRepasParFormat(repasCounts);
        }
      }
    }
    setLoading(false);
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

  const togglePublication = async (course) => {
    const newState = !course.en_ligne;
    const { error } = await supabase
      .from("courses")
      .update({ en_ligne: newState })
      .eq("id", course.id);

    if (error) {
      console.error(error);
      return alert("Impossible de changer l’état de publication.");
    }

    setCourses((prev) =>
      prev.map((c) => (c.id === course.id ? { ...c, en_ligne: newState } : c))
    );
  };

  const handleDuplicate = async (course) => {
    // retirer les champs non insérables ET la relation `formats`
    const {
      id,
      created_at,
      updated_at,
      formats,
      slug, // si slug unique
      ...fieldsToCopy
    } = course;

    // Forcer la copie en HORS-LIGNE par sécurité
    const payload = {
      ...fieldsToCopy,
      nom: `${course.nom} (copie)`,
      en_ligne: false,
      organisateur_id: session?.user?.id || fieldsToCopy.organisateur_id,
    };

    // 1) Créer la nouvelle course
    const { data: duplicatedCourse, error: courseError } = await supabase
      .from("courses")
      .insert(payload)
      .select()
      .single();

    if (courseError) {
      console.error(courseError);
      return alert("Erreur duplication épreuve");
    }

    // 2) Dupliquer les formats
    const { data: srcFormats, error: formatsError } = await supabase
      .from("formats")
      .select("*")
      .eq("course_id", id);

    if (formatsError) {
      console.error(formatsError);
      return fetchCoursesAndFormats();
    }

    if (srcFormats && srcFormats.length > 0) {
      const cleanedFormats = srcFormats.map(
        ({ id, created_at, updated_at, course_id, ...f }) => ({
          ...f,
          course_id: duplicatedCourse.id,
        })
      );

      const { error: insertFormatsError } = await supabase
        .from("formats")
        .insert(cleanedFormats);

      if (insertFormatsError) {
        console.error("Erreur insertion formats :", insertFormatsError);
        alert(
          "Épreuve copiée, mais les formats n'ont pas pu être dupliqués (voir console)."
        );
      }
    }

    fetchCoursesAndFormats();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Mon espace organisateur</h1>

      {loading && <p className="text-sm text-gray-600 mb-4">Chargement…</p>}

      {courses.length === 0 ? (
        <p>Aucune épreuve créée.</p>
      ) : (
        <div className="space-y-6">
          {courses.map((course) => (
            <div key={course.id} className="border rounded-lg p-4 bg-white shadow">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <h2 className="text-xl font-semibold">{course.nom}</h2>
                  <span className="text-sm text-gray-600">
                    {course.lieu} ({course.departement})
                  </span>
                </div>

                {/* Badge état publication */}
                <span
                  className={
                    "text-xs px-2 py-1 rounded self-start " +
                    (course.en_ligne
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700")
                  }
                  title={course.en_ligne ? "Publiée" : "Hors-ligne"}
                >
                  {course.en_ligne ? "🟢 Publiée" : "🔒 Hors-ligne"}
                </span>
              </div>

              <p className="text-gray-700 mb-3">{course.presentation}</p>

              {/* Formats + indicateurs */}
              {course.formats && course.formats.length > 0 && (
                <div className="space-y-2 mb-3">
                  {course.formats.map((f) => {
                    const inscrits = inscriptionsParFormat[f.id] || 0;
                    const max = f.nb_max_coureurs;
                    const repas = repasParFormat[f.id] || 0;
                    return (
                      <div key={f.id} className="text-sm text-gray-800 bg-gray-50 p-2 rounded">
                        🏁 <strong>{f.nom}</strong> – {f.date} – {f.distance_km} km / {f.denivele_dplus} m D+<br />
                        👥 Inscriptions : {inscrits} {max ? `/ ${max}` : ""}<br />
                        🍽️ Repas réservés : {repas} {f.stock_repas ? `/ ${f.stock_repas}` : ""}<br />
                        <Link
                          to={`/organisateur/inscriptions/${f.id}`}
                          className="text-blue-600 underline text-sm"
                        >
                          👥 Voir les inscrits
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/modifier-course/${course.id}`}
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

                {/* Toggle Publier / Hors ligne */}
                <button
                  onClick={() => togglePublication(course)}
                  className={
                    (course.en_ligne
                      ? "bg-purple-600 hover:bg-purple-700"
                      : "bg-gray-700 hover:bg-gray-800") +
                    " text-white px-3 py-1 rounded"
                  }
                >
                  {course.en_ligne ? "Mettre hors-ligne" : "Publier"}
                </button>

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

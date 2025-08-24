// src/pages/MonEspaceOrganisateur.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import {
  Copy,
  Check,
  Pencil,
  Eye,
  FilePlus,
  Trash2,
  Globe,
  Lock,
  Link2,
} from "lucide-react";

export default function MonEspaceOrganisateur() {
  const { session } = useUser();
  const [courses, setCourses] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [inscriptionsParFormat, setInscriptionsParFormat] = useState({});
  const [repasParFormat, setRepasParFormat] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (session) fetchCoursesAndFormats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const confirm = window.confirm(
      "Supprimer définitivement cette épreuve ? Cette action est irréversible."
    );
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
    // Retirer champs non-insérables et relation
    const {
      id,
      created_at,
      updated_at,
      formats,
      slug, // si unique en base
      ...fieldsToCopy
    } = course;

    const payload = {
      ...fieldsToCopy,
      nom: `${course.nom} (copie)`,
      en_ligne: false, // sécurité: copie hors-ligne
      organisateur_id: session?.user?.id || fieldsToCopy.organisateur_id,
    };

    const { data: duplicatedCourse, error: courseError } = await supabase
      .from("courses")
      .insert(payload)
      .select()
      .single();

    if (courseError) {
      console.error(courseError);
      return alert("Erreur duplication épreuve");
    }

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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mon espace organisateur</h1>
        {loading && (
          <span className="text-sm text-gray-600 animate-pulse">
            Chargement…
          </span>
        )}
      </div>

      {courses.length === 0 ? (
        <p className="text-gray-700">Aucune épreuve créée.</p>
      ) : (
        <div className="space-y-6">
          {courses.map((course) => (
            <div
              key={course.id}
              className="rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Header card */}
              <div className="p-4 sm:p-5 border-b border-gray-100 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold truncate">
                    {course.nom}
                  </h2>
                  <div className="mt-1 text-sm text-gray-600">
                    {course.lieu} ({course.departement})
                  </div>
                </div>

                {/* Badge état publication */}
                <span
                  className={[
                    "shrink-0 text-xs px-2.5 py-1 rounded-full border",
                    course.en_ligne
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-gray-50 text-gray-700 border-gray-200",
                  ].join(" ")}
                  title={course.en_ligne ? "Publiée" : "Hors-ligne"}
                >
                  {course.en_ligne ? "🟢 Publiée" : "🔒 Hors-ligne"}
                </span>
              </div>

              {/* Body card */}
              <div className="p-4 sm:p-5">
                {course.presentation && (
                  <p className="text-gray-700 mb-4">{course.presentation}</p>
                )}

                {/* Formats + indicateurs */}
                {course.formats && course.formats.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {course.formats.map((f) => {
                      const inscrits = inscriptionsParFormat[f.id] || 0;
                      const max = f.nb_max_coureurs;
                      const repas = repasParFormat[f.id] || 0;
                      return (
                        <div
                          key={f.id}
                          className="text-sm text-gray-800 bg-gray-50 border border-gray-100 p-3 rounded-xl"
                        >
                          <div className="font-medium">
                            🏁 <strong>{f.nom}</strong> — {f.date} — {f.distance_km} km /{" "}
                            {f.denivele_dplus} m D+
                          </div>
                          <div className="mt-1">
                            👥 Inscriptions : {inscrits} {max ? `/ ${max}` : ""}
                          </div>
                          <div>
                            🍽️ Repas réservés : {repas}{" "}
                            {f.stock_repas ? `/ ${f.stock_repas}` : ""}
                          </div>
                          <Link
                            to={`/organisateur/inscriptions/${f.id}`}
                            className="inline-block mt-2 text-blue-600 hover:text-blue-700 underline text-sm"
                          >
                            👥 Voir les inscrits
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Actions: 2 groupes (gauche/droite) */}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  {/* Groupe gauche */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/modifier-course/${course.id}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      <Pencil size={16} />
                      Modifier
                    </Link>

                    <Link
                      to={`/courses/${course.id}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-gray-700 px-3 py-2 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
                    >
                      <Eye size={16} />
                      Voir la page
                    </Link>

                    <button
                      onClick={() => handleDuplicate(course)}
                      className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
                    >
                      <FilePlus size={16} />
                      Dupliquer
                    </button>

                    <button
                      onClick={() => handleDelete(course.id)}
                      className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                    >
                      <Trash2 size={16} />
                      Supprimer
                    </button>

                    <button
                      onClick={() => handleCopy(course.id)}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
                    >
                      {copiedId === course.id ? <Check size={16} /> : <Link2 size={16} />}
                      {copiedId === course.id ? "Copié" : "Copier le lien"}
                    </button>
                  </div>

                  {/* Groupe droite : bouton publication */}
                  <button
                    onClick={() => togglePublication(course)}
                    className={[
                      "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-white text-sm font-semibold transition-colors",
                      course.en_ligne
                        ? "bg-purple-600 hover:bg-purple-700"
                        : "bg-gray-900 hover:bg-black",
                    ].join(" ")}
                    title={course.en_ligne ? "Mettre hors-ligne" : "Publier"}
                  >
                    {course.en_ligne ? <Lock size={16} /> : <Globe size={16} />}
                    {course.en_ligne ? "Mettre hors-ligne" : "Publier"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

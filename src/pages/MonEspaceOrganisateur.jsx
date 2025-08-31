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
    const {
      id,
      created_at,
      updated_at,
      formats,
      slug,
      ...fieldsToCopy
    } = course;

    const payload = {
      ...fieldsToCopy,
      nom: `${course.nom} (copie)`,
      en_ligne: false,
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
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header / Hero */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 py-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-neutral-900">
            Espace Organisateur{" "}
            <span className="font-black">
              <span className="text-orange-600">Tick</span>Race
            </span>
          </h1>
          <p className="mt-2 text-neutral-600 text-base">
            Créez, gérez et publiez vos épreuves en quelques minutes.
          </p>

          <div className="mt-5 flex justify-center gap-3">
            <Link
              to="/organisateur/nouvelle-course"
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-orange-300"
            >
              + Créer une épreuve
            </Link>
            <Link
              to="/organisateur/mon-espace"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              Tableau de bord
            </Link>
          </div>
        </div>
      </section>

      {/* Contenu */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-neutral-600">
            {loading ? "Chargement…" : `${courses.length} épreuve${courses.length > 1 ? "s" : ""} au total`}
          </div>
        </div>

        {courses.length === 0 ? (
          <EmptyStateCTA />
        ) : (
          <div className="space-y-6">
            {courses.map((course) => (
              <div
                key={course.id}
                className="rounded-2xl bg-white shadow-lg shadow-neutral-900/5 ring-1 ring-neutral-200 overflow-hidden"
              >
                {/* Header card */}
                <div className="p-4 sm:p-5 border-b border-neutral-200 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold truncate">
                      {course.nom}
                    </h2>
                    <div className="mt-1 text-sm text-neutral-600">
                      {course.lieu} ({course.departement})
                    </div>
                  </div>

                  {/* Badge état publication */}
                  <span
                    className={[
                      "shrink-0 text-xs px-2.5 py-1 rounded-full ring-1",
                      course.en_ligne
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : "bg-neutral-50 text-neutral-700 ring-neutral-200",
                    ].join(" ")}
                    title={course.en_ligne ? "Publiée" : "Hors-ligne"}
                  >
                    {course.en_ligne ? "🟢 Publiée" : "🔒 Hors-ligne"}
                  </span>
                </div>

                {/* Body card */}
                <div className="p-4 sm:p-5">
                  {course.presentation && (
                    <p className="text-neutral-700 mb-4">{course.presentation}</p>
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
                            className="text-sm text-neutral-800 bg-neutral-50 ring-1 ring-neutral-200 p-3 rounded-xl"
                          >
                            <div className="font-medium">
                              🏁 <strong>{f.nom}</strong> — {f.date} — {f.distance_km} km / {f.denivele_dplus} m D+
                            </div>
                            <div className="mt-1">
                              👥 Inscriptions : {inscrits} {max ? `/ ${max}` : ""}
                            </div>
                            <div>
                              🍽️ Repas réservés : {repas} {f.stock_repas ? `/ ${f.stock_repas}` : ""}
                            </div>
                            <Link
                              to={`/organisateur/inscriptions/${f.id}`}
                              className="inline-block mt-2 text-orange-600 hover:text-orange-700 underline text-sm"
                            >
                              👥 Voir les inscrits
                            </Link>
                            <Link
  to={`/organisateur/benevoles?course=${course.id}`}
  className="inline-block mt-2 text-orange-600 hover:text-orange-700 underline text-sm"
>

      🙋 Voir les bénévoles
</Link>
<OrgaBenevolesCard />



                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    {/* Groupe gauche */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/modifier-course/${course.id}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-white text-sm font-semibold hover:brightness-110"
                      >
                        <Pencil size={16} />
                        Modifier
                      </Link>

                      <Link
                        to={`/courses/${course.id}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-white text-sm font-semibold hover:brightness-110"
                      >
                        <Eye size={16} />
                        Voir la page
                      </Link>

                      <button
                        onClick={() => handleDuplicate(course)}
                        className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-white text-sm font-semibold hover:brightness-110"
                      >
                        <FilePlus size={16} />
                        Dupliquer
                      </button>

                      <button
                        onClick={() => handleDelete(course.id)}
                        className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-white text-sm font-semibold hover:bg-rose-700"
                      >
                        <Trash2 size={16} />
                        Supprimer
                      </button>

                      <button
                        onClick={() => handleCopy(course.id)}
                        className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                      >
                        {copiedId === course.id ? <Check size={16} /> : <Link2 size={16} />}
                        {copiedId === course.id ? "Copié" : "Copier le lien"}
                      </button>
                    </div>

                    {/* Groupe droite : bouton publication */}
                    <button
                      onClick={() => togglePublication(course)}
                      className={[
                        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-white text-sm font-semibold",
                        course.en_ligne
                          ? "bg-neutral-800 hover:bg-black" // action = mettre hors-ligne
                          : "bg-orange-500 hover:brightness-110", // action = publier
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
    </div>
  );
}

/* --- Composants auxiliaires --- */
function EmptyStateCTA() {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
      <h3 className="text-lg font-semibold">Aucune épreuve créée</h3>
      <p className="mt-1 text-neutral-600">
        Créez votre première épreuve en quelques clics.
      </p>
      <Link
        to="/organisateur/nouvelle-course"
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
      >
        + Créer une épreuve
      </Link>
    </div>
  );
}

// src/pages/OrganisateurTest.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";

export default function OrganisateurTest() {
  const [courseId, setCourseId] = useState("");
  const [loading, setLoading] = useState(false);
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    if (!courseId) return;
    setLoading(true);
    setError("");
    setCourse(null);
    setFormats([]);

    try {
      const { data, error: e1 } = await supabase
        .from("courses")
        .select(
          `
          id, nom, lieu, date, sport, created_at,
          formats (
            id, nom, type_format, prix, prix_equipe, nb_max_coureurs, waitlist_enabled, age_minimum,
            inscription_ouverture, inscription_fermeture
          )
        `
        )
        .eq("id", courseId)
        .single();

      if (e1) throw e1;

      const withCounts = await Promise.all(
        (data.formats || []).map(async (f) => {
          const { count } = await supabase
            .from("inscriptions")
            .select("*", { count: "exact", head: true })
            .eq("format_id", f.id)
            .neq("statut", "annulé");
          return { ...f, inscrits: count || 0 };
        })
      );

      setCourse(data);
      setFormats(withCounts);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // rien auto : on clique "Charger"
  }, []);

  const totalInscrits = useMemo(
    () => formats.reduce((acc, f) => acc + Number(f.inscrits || 0), 0),
    [formats]
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6">
        <Link to="/test" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Index tests
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold mt-1">OrganisateurTest</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Charge une course et vérifie formats, capacités, fenêtres d’inscription, compteurs.
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="p-5 border-b border-neutral-100 flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-xl">
            <div className="text-sm font-semibold text-neutral-700 mb-1">courseId</div>
            <input
              className="w-full rounded-xl border border-neutral-300 px-3 py-2"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              placeholder="uuid course"
            />
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading || !courseId}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
              loading || !courseId ? "bg-neutral-400 cursor-not-allowed" : "bg-neutral-900 hover:bg-black"
            }`}
          >
            {loading ? "Chargement..." : "Charger"}
          </button>
        </div>

        <div className="p-5">
          {error ? <div className="text-sm text-red-700">{error}</div> : null}

          {!course ? (
            <div className="text-sm text-neutral-600">Renseigne un courseId puis clique “Charger”.</div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="font-semibold">{course.nom}</div>
                <div className="text-sm text-neutral-600">
                  {course.lieu || "—"} · {course.date || "—"} · sport: <b>{course.sport || "—"}</b>
                </div>
                <div className="mt-2 text-sm">
                  Total inscrits (tous formats) : <b>{totalInscrits}</b>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-neutral-600">
                      <th className="py-2 pr-3">Format</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Prix</th>
                      <th className="py-2 pr-3">Capacité</th>
                      <th className="py-2 pr-3">Fenêtre</th>
                      <th className="py-2 pr-3">Waitlist</th>
                      <th className="py-2 pr-3">Âge min</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formats.map((f) => {
                      const max = Number(f.nb_max_coureurs || 0);
                      const inscrits = Number(f.inscrits || 0);
                      const restant = max ? Math.max(0, max - inscrits) : null;
                      return (
                        <tr key={f.id} className="border-t">
                          <td className="py-2 pr-3 font-medium">{f.nom}</td>
                          <td className="py-2 pr-3">{f.type_format || "individuel"}</td>
                          <td className="py-2 pr-3">
                            {Number(f.prix || 0).toFixed(2)} €
                            {f.prix_equipe ? ` (+ équipe ${Number(f.prix_equipe).toFixed(2)} €)` : ""}
                          </td>
                          <td className="py-2 pr-3">
                            {inscrits}/{max || "—"} {restant !== null ? `(${restant} restantes)` : ""}
                          </td>
                          <td className="py-2 pr-3 text-xs text-neutral-600">
                            {f.inscription_ouverture ? `O: ${new Date(f.inscription_ouverture).toLocaleString()}` : "O: —"}
                            {" · "}
                            {f.inscription_fermeture ? `F: ${new Date(f.inscription_fermeture).toLocaleString()}` : "F: —"}
                          </td>
                          <td className="py-2 pr-3">{f.waitlist_enabled ? "oui" : "non"}</td>
                          <td className="py-2 pr-3">{f.age_minimum ?? "—"}</td>
                        </tr>
                      );
                    })}
                    {formats.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-3 text-neutral-500">
                          Aucun format.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/courses/${course.id}`}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50 transition"
                >
                  Voir page course →
                </Link>
                <Link
                  to={`/inscription/${course.id}`}
                  className="rounded-xl bg-neutral-900 text-white px-4 py-2 text-sm font-semibold hover:bg-black transition"
                >
                  Tester inscription →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

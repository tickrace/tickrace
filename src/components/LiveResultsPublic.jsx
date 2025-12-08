// src/components/LiveResultsPublic.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import {
  formatChrono,
  computeVitesse,
  formatDateFr,
  isFemaleGenre,
  buildClassementParFormat,
} from "../lib/classementUtils";

function LiveResultsPublic({ courseId }) {
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [inscriptions, setInscriptions] = useState([]);
  const [error, setError] = useState(null);

  // Chargement des données
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Course
        const { data: courseData, error: courseErr } = await supabase
          .from("courses")
          .select("*")
          .eq("id", courseId)
          .maybeSingle();
        if (courseErr) throw courseErr;
        setCourse(courseData);

        // Formats
        const { data: fmts, error: fmtsErr } = await supabase
          .from("formats")
          .select("*")
          .eq("course_id", courseId)
          .order("distance_km", { ascending: true });
        if (fmtsErr) throw fmtsErr;
        setFormats(fmts || []);

        // Inscriptions
        if ((fmts || []).length > 0) {
          const formatIds = fmts.map((f) => f.id);
          const { data: insc, error: inscErr } = await supabase
            .from("inscriptions")
            .select("*")
            .in("format_id", formatIds);
          if (inscErr) throw inscErr;
          setInscriptions(insc || []);
        } else {
          setInscriptions([]);
        }
      } catch (e) {
        console.error(e);
        setError("Impossible de charger les résultats pour le moment.");
      } finally {
        setLoading(false);
      }
    }

    if (courseId) load();
  }, [courseId]);

  // Dernières arrivées (tous formats)
  const lastArrivals = useMemo(() => {
    return [...inscriptions]
      .filter((i) => i.heure_arrivee)
      .sort(
        (a, b) => new Date(b.heure_arrivee) - new Date(a.heure_arrivee)
      )
      .slice(0, 10);
  }, [inscriptions]);

  // Classement par format (scratch / sexe / cat)
  const tableauxParFormat = useMemo(
    () => buildClassementParFormat(inscriptions, formats, course),
    [inscriptions, formats, course]
  );

  const formatsById = useMemo(() => {
    const map = {};
    (formats || []).forEach((f) => {
      map[f.id] = f;
    });
    return map;
  }, [formats]);

  if (loading) {
    return (
      <div className="text-sm text-neutral-600">Chargement des résultats…</div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (!formats.length || !inscriptions.length) {
    return (
      <div className="rounded-md bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        Les résultats seront publiés ici dès l’arrivée des premiers coureurs.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">
            Résultats en direct
          </h2>
          {course && (
            <p className="text-xs text-neutral-500">
              {course.lieu} – {formatDateFr(course.date_course)}
            </p>
          )}
        </div>
        <p className="text-xs text-neutral-500">
          Les résultats affichés sont donnés à titre indicatif et peuvent être
          ajustés par l’organisation.
        </p>
      </div>

      {/* Dernières arrivées */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold">Dernières arrivées</h3>
        {lastArrivals.length === 0 ? (
          <p className="text-xs text-neutral-500">
            Aucune arrivée enregistrée pour le moment.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">Dossard</th>
                  <th className="text-left py-2 pr-4">Coureur</th>
                  <th className="text-left py-2 pr-4">Format</th>
                  <th className="text-left py-2 pr-4">Heure d’arrivée</th>
                </tr>
              </thead>
              <tbody>
                {lastArrivals.map((row) => {
                  const f = formatsById[row.format_id];
                  return (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-1 pr-4 font-mono">{row.dossard}</td>
                      <td className="py-1 pr-4">
                        {row.prenom} {row.nom}
                      </td>
                      <td className="py-1 pr-4">{f?.nom || "—"}</td>
                      <td className="py-1 pr-4">
                        {row.heure_arrivee
                          ? new Date(row.heure_arrivee).toLocaleTimeString(
                              "fr-FR",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              }
                            )
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Classement par format */}
      <div className="space-y-6">
        {formats.map((format) => {
          const rows = tableauxParFormat[format.id] || [];
          if (!rows.length) {
            return (
              <div
                key={format.id}
                className="rounded-xl border border-neutral-200 bg-white p-4"
              >
                <h3 className="text-sm font-semibold mb-1">
                  {format.nom} –{" "}
                  {format.distance_km ? `${format.distance_km} km` : ""}
                </h3>
                <p className="text-xs text-neutral-500">
                  Aucun résultat enregistré pour ce format pour le moment.
                </p>
              </div>
            );
          }

          return (
            <div
              key={format.id}
              className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <h3 className="text-sm md:text-base font-semibold">
                    {format.nom}{" "}
                    {format.distance_km
                      ? `– ${format.distance_km} km`
                      : ""}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {format.date && format.date !== ""
                      ? formatDateFr(format.date)
                      : "Date à confirmer"}
                    {format.heure_depart
                      ? ` • Départ ${String(format.heure_depart).slice(0, 5)}`
                      : ""}
                  </p>
                </div>
                <div className="text-xs text-neutral-500">
                  {rows.filter((r) => r.seconds != null).length} coureur
                  {rows.filter((r) => r.seconds != null).length > 1 && "s"} classé
                  {rows.length !==
                    rows.filter((r) => r.seconds != null).length &&
                    ` / ${rows.length} inscrit(s)`}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-[11px] md:text-xs">
                  <thead>
                    <tr className="border-b bg-neutral-50">
                      <th className="text-left py-2 px-2">#</th>
                      <th className="text-left py-2 px-2">Sexe</th>
                      <th className="text-left py-2 px-2">Cat.</th>
                      <th className="text-left py-2 px-2">Code cat.</th>
                      <th className="text-left py-2 px-2">Dossard</th>
                      <th className="text-left py-2 px-2">Nom</th>
                      <th className="text-left py-2 px-2">Prénom</th>
                      <th className="text-left py-2 px-2">Club</th>
                      <th className="text-left py-2 px-2">Équipe</th>
                      <th className="text-left py-2 px-2">Chrono</th>
                      <th className="text-left py-2 px-2">km/h</th>
                      <th className="text-left py-2 px-2">min/km</th>
                      <th className="text-left py-2 px-2">Rang sexe</th>
                      <th className="text-left py-2 px-2">Rang cat.</th>
                      <th className="text-left py-2 px-2">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const i = row.inscription;
                      const seconds = row.seconds;
                      const distanceKm = format?.distance_km || null;
                      const { kmh, minKm } = computeVitesse(
                        distanceKm,
                        seconds
                      );

                      const scratchRank =
                        row.scratchRank ?? i.rang_scratch;
                      const sexRank = row.sexRank ?? i.rang_sexe;
                      const catRank = row.catRank ?? i.rang_categorie;

                      const female = isFemaleGenre(i.genre);
                      const catDisplay =
                        i.categorie_age_label ||
                        i.categorie_age_code ||
                        i.categorie ||
                        i.categorie_code ||
                        "—";

                      const catBaseCode =
                        i.categorie_age_code ||
                        i.categorie ||
                        i.categorie_code ||
                        i.categorie_age_label;

                      const codeCat =
                        catRank && catBaseCode
                          ? `${catRank}${catBaseCode}${
                              female ? "F" : "H"
                            }`
                          : "—";

                      const isFemaleRow = female;
                      const isCatWinner = catRank === 1;

                      const rowClasses = [
                        "border-b last:border-0",
                        isFemaleRow ? "bg-pink-50" : "",
                        isCatWinner ? "border-l-4 border-red-500" : "",
                      ]
                        .filter(Boolean)
                        .join(" ");

                      return (
                        <tr key={i.id} className={rowClasses}>
                          <td className="py-1 px-2 font-semibold">
                            {scratchRank || "—"}
                          </td>
                          <td className="py-1 px-2">
                            {i.genre || "—"}
                          </td>
                          <td className="py-1 px-2">{catDisplay}</td>
                          <td className="py-1 px-2 font-semibold">
                            {codeCat}
                          </td>
                          <td className="py-1 px-2 font-mono">
                            {i.dossard || "—"}
                          </td>
                          <td className="py-1 px-2 uppercase">
                            {i.nom || "—"}
                          </td>
                          <td className="py-1 px-2 capitalize">
                            {i.prenom || "—"}
                          </td>
                          <td className="py-1 px-2">
                            {i.club || "—"}
                          </td>
                          <td className="py-1 px-2">
                            {i.team_name || "—"}
                          </td>
                          <td className="py-1 px-2 font-mono">
                            {formatChrono(seconds)}
                          </td>
                          <td className="py-1 px-2">{kmh}</td>
                          <td className="py-1 px-2">{minKm}</td>
                          <td className="py-1 px-2">
                            {sexRank || "—"}
                          </td>
                          <td className="py-1 px-2">
                            {catRank || "—"}
                          </td>
                          <td className="py-1 px-2">
                            {i.statut_course || "ok"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LiveResultsPublic;

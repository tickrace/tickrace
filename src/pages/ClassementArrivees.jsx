// src/pages/ClassementArrivees.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";

/* ---------- Helpers UI / formatage ---------- */

function formatHeure(date) {
  if (!date) return "—";
  return new Date(date).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// Pour les champs time Postgres (ex: "13:30:00")
function formatHeureDepart(timeStr) {
  if (!timeStr) return "—";
  const parts = String(timeStr).split(":");
  const h = parts[0] ?? "00";
  const m = parts[1] ?? "00";
  return `${h}:${m}`;
}

function formatChrono(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const s = Number(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (v) => String(v).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function computeVitesse(distanceKm, seconds) {
  if (!distanceKm || !seconds || seconds <= 0) {
    return { kmh: "—", minKm: "—" };
  }
  const kmh = distanceKm / (seconds / 3600);
  const totalMinPerKm = (seconds / 60) / distanceKm;
  const min = Math.floor(totalMinPerKm);
  const sec = Math.round((totalMinPerKm - min) * 60);
  const pad = (v) => String(v).padStart(2, "0");
  return {
    kmh: kmh.toFixed(1),
    minKm: `${pad(min)}:${pad(sec)}`,
  };
}

function formatDateFr(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

// Détecter si le genre est féminin (gère "F", "Femme", etc.)
function isFemaleGenre(genre) {
  if (!genre) return false;
  const g = genre.toString().trim().toUpperCase();
  return g === "F" || g.startsWith("FEM");
}

/**
 * Calcule un temps officiel à partir de :
 * - heureArriveeIso: timestamp ISO de l'arrivée
 * - format.heure_depart: time Postgres "HH:MM:SS"
 * - course.date_course (optionnel)
 *
 * Pour les tests hors jour de course :
 *  - on se base toujours sur la **date de l'arrivée**
 *    (et si un jour tu veux forcer la date de course, on pourra ajuster).
 */
function computeTempsOfficielFromData(heureArriveeIso, format, course) {
  if (!heureArriveeIso || !format?.heure_depart) return null;

  try {
    const arrivee = new Date(heureArriveeIso);
    if (Number.isNaN(arrivee.getTime())) return null;

    // Date du jour de l'arrivée (YYYY-MM-DD)
    const arriveeDateStr = heureArriveeIso.slice(0, 10);
    let baseDateStr = arriveeDateStr;

    // Option : si tu veux forcer date_course quand c'est le même jour
    if (course?.date_course) {
      const courseDateStr = String(course.date_course);
      if (courseDateStr === arriveeDateStr) {
        baseDateStr = courseDateStr;
      }
      // Si c'est différent (cas de tests), on garde arriveeDateStr
    }

    const rawTime = String(format.heure_depart);
    const timePart = rawTime.split(".")[0]; // au cas où il y ait des fractions
    const departIso = `${baseDateStr}T${timePart}`;
    const depart = new Date(departIso);

    if (Number.isNaN(depart.getTime())) return null;

    const diff = (arrivee - depart) / 1000;
    if (diff <= 0) return null;
    return Math.round(diff);
  } catch (e) {
    console.error("Erreur calcul chrono", e);
    return null;
  }
}

/**
 * Fallback pour les inscriptions qui n'ont pas encore temps_officiel_sec
 */
function computeTempsOfficielSecFallback(inscription, format, course) {
  if (inscription?.temps_officiel_sec != null) {
    return inscription.temps_officiel_sec;
  }
  if (!inscription?.heure_arrivee) return null;
  return computeTempsOfficielFromData(inscription.heure_arrivee, format, course);
}

/* ---------- Page principale ---------- */

function ClassementArrivees() {
  const { courseId } = useParams();

  const [now, setNow] = useState(new Date());
  const [dossard, setDossard] = useState("");
  const [loadingSave, setLoadingSave] = useState(false);
  const [loadingClassement, setLoadingClassement] = useState(false);
  const [error, setError] = useState(null);

  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [inscriptions, setInscriptions] = useState([]);

  // Heure actuelle
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Chargement course + formats + inscriptions
  useEffect(() => {
    async function loadData() {
      setError(null);

      // 1) Course
      const { data: courseData, error: courseErr } = await supabase
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .maybeSingle();

      if (courseErr) {
        console.error(courseErr);
        setError("Erreur lors du chargement de la course.");
        return;
      }
      setCourse(courseData);

      // 2) Formats (avec heure_depart)
      const { data: formatsData, error: formatsErr } = await supabase
        .from("formats")
        .select("*")
        .eq("course_id", courseId)
        .order("distance_km", { ascending: true });

      if (formatsErr) {
        console.error(formatsErr);
        setError("Erreur lors du chargement des formats.");
        return;
      }
      setFormats(formatsData || []);

      // 3) Inscriptions
      if (formatsData && formatsData.length > 0) {
        const formatIds = formatsData.map((f) => f.id);
        const { data: inscData, error: inscErr } = await supabase
          .from("inscriptions")
          .select("*")
          .in("format_id", formatIds);

        if (inscErr) {
          console.error(inscErr);
          setError("Erreur lors du chargement des inscriptions.");
          return;
        }
        setInscriptions(inscData || []);
      } else {
        setInscriptions([]);
      }
    }

    if (courseId) {
      loadData();
    }
  }, [courseId]);

  // Helper pour recharger uniquement les inscriptions (après RPC/reset)
  async function refreshInscriptions() {
    if (!formats || formats.length === 0) return;
    const formatIds = formats.map((f) => f.id);

    const { data: inscData, error: inscErr } = await supabase
      .from("inscriptions")
      .select("*")
      .in("format_id", formatIds);

    if (inscErr) {
      console.error(inscErr);
      setError("Erreur lors du rechargement des inscriptions.");
      return;
    }
    setInscriptions(inscData || []);
  }

  // Saisie d'une arrivée (dossard -> heure_arrivee = now + temps_officiel_sec calculé)
  async function handleArrivee(e) {
    e.preventDefault();
    if (!dossard || !formats || formats.length === 0) return;

    setError(null);
    setLoadingSave(true);

    try {
      const formatIds = formats.map((f) => f.id);

      // Chercher l'inscription par dossard sur cette course (tous formats)
      const { data: candidates, error: findErr } = await supabase
        .from("inscriptions")
        .select("id, dossard, format_id, heure_arrivee")
        .eq("dossard", dossard)
        .in("format_id", formatIds);

      if (findErr) throw findErr;

      if (!candidates || candidates.length === 0) {
        setError(`Aucune inscription trouvée pour le dossard ${dossard}.`);
        setLoadingSave(false);
        return;
      }

      if (candidates.length > 1) {
        setError(
          `Plusieurs inscriptions trouvées pour le dossard ${dossard}. Vérifie le format / paramétrage des dossards.`
        );
        setLoadingSave(false);
        return;
      }

      const insc = candidates[0];

      if (insc.heure_arrivee) {
        setError(
          `Ce dossard a déjà une heure d'arrivée (${formatHeure(
            insc.heure_arrivee
          )}).`
        );
        setLoadingSave(false);
        return;
      }

      const nowIso = new Date().toISOString();

      // On retrouve le format pour ce dossard
      const format = formats.find((f) => f.id === insc.format_id);

      // Calcul du temps officiel immédiatement (pratique pour les tests)
      const seconds = computeTempsOfficielFromData(nowIso, format, course);

      const updatePayload = {
        heure_arrivee: nowIso,
      };
      if (seconds != null) {
        updatePayload.temps_officiel_sec = seconds;
      }

      const { error: updateErr } = await supabase
        .from("inscriptions")
        .update(updatePayload)
        .eq("id", insc.id);

      if (updateErr) throw updateErr;

      // Met à jour en local pour le live
      setInscriptions((prev) =>
        prev.map((p) =>
          p.id === insc.id ? { ...p, ...updatePayload } : p
        )
      );

      setDossard("");
    } catch (err) {
      console.error(err);
      setError("Erreur lors de l'enregistrement de l'arrivée.");
    } finally {
      setLoadingSave(false);
    }
  }

  // RPC : recalculer les chronos / rangs en base (officiel)
  async function handleRecalculerClassement() {
    if (!courseId) return;
    setError(null);
    setLoadingClassement(true);

    try {
      const { error: rpcError } = await supabase.rpc(
        "recalculer_classement_course",
        { p_course_id: courseId }
      );

      if (rpcError) {
        throw rpcError;
      }

      await refreshInscriptions();
    } catch (err) {
      console.error(err);
      setError("Erreur lors du recalcul du classement (RPC).");
    } finally {
      setLoadingClassement(false);
    }
  }

  // Reset du classement pour un format
  async function handleResetFormat(formatId) {
    const ok = window.confirm(
      "Réinitialiser toutes les heures d’arrivée et le classement pour ce format ?"
    );
    if (!ok) return;

    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc(
        "reset_classement_format",
        { p_format_id: formatId }
      );
      if (rpcError) throw rpcError;
      await refreshInscriptions();
    } catch (err) {
      console.error(err);
      setError(
        "Erreur lors de la réinitialisation du classement pour ce format."
      );
    }
  }

  // Dernières arrivées (top 10)
  const lastArrivals = useMemo(() => {
    return [...inscriptions]
      .filter((i) => i.heure_arrivee)
      .sort(
        (a, b) => new Date(b.heure_arrivee) - new Date(a.heure_arrivee)
      )
      .slice(0, 10);
  }, [inscriptions]);

  // Map formats par id pour accès rapide
  const formatsById = useMemo(() => {
    const map = {};
    (formats || []).forEach((f) => {
      map[f.id] = f;
    });
    return map;
  }, [formats]);

  // Groupement inscriptions par format + calcul place / rang sexe / rang cat
  const tableauxParFormat = useMemo(() => {
    const res = {};
    if (!inscriptions || inscriptions.length === 0) return res;

    inscriptions.forEach((i) => {
      if (!res[i.format_id]) res[i.format_id] = [];
      const format = formatsById[i.format_id];
      const seconds = computeTempsOfficielSecFallback(i, format, course);
      res[i.format_id].push({
        inscription: i,
        format,
        seconds,
        scratchRank: null,
        sexRankComputed: null,
        catRankComputed: null,
      });
    });

    Object.keys(res).forEach((formatId) => {
      const arr = res[formatId];

      // Tri principal par chrono
      arr.sort((a, b) => {
        const ta = a.seconds ?? Number.MAX_SAFE_INTEGER;
        const tb = b.seconds ?? Number.MAX_SAFE_INTEGER;
        if (ta !== tb) return ta - tb;
        const ha = a.inscription.heure_arrivee
          ? new Date(a.inscription.heure_arrivee).getTime()
          : Number.MAX_SAFE_INTEGER;
        const hb = b.inscription.heure_arrivee
          ? new Date(b.inscription.heure_arrivee).getTime()
          : Number.MAX_SAFE_INTEGER;
        return ha - hb;
      });

      // Place au scratch
      let scratch = 0;
      arr.forEach((row) => {
        if (row.seconds != null) {
          scratch += 1;
          row.scratchRank = scratch;
        } else {
          row.scratchRank = null;
        }
      });

      // Rang par sexe
      let maleRank = 0;
      let femaleRank = 0;
      arr.forEach((row) => {
        if (row.seconds == null) {
          row.sexRankComputed = null;
          return;
        }
        const female = isFemaleGenre(row.inscription.genre);
        if (female) {
          femaleRank += 1;
          row.sexRankComputed = femaleRank;
        } else {
          maleRank += 1;
          row.sexRankComputed = maleRank;
        }
      });

      // Rang par catégorie + sexe
      const catCounters = {};
      arr.forEach((row) => {
        if (row.seconds == null) {
          row.catRankComputed = null;
          return;
        }
        const cat = row.inscription.categorie;
        if (!cat) {
          row.catRankComputed = null;
          return;
        }
        const female = isFemaleGenre(row.inscription.genre);
        const sexKey = female ? "F" : "H";
        const key = `${cat}_${sexKey}`;
        catCounters[key] = (catCounters[key] || 0) + 1;
        row.catRankComputed = catCounters[key];
      });
    });

    return res;
  }, [inscriptions, formatsById, course]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">
            Classement en direct{" "}
            {course ? `– ${course.nom}` : ""}
          </h1>
          {course && (
            <p className="text-sm text-neutral-500">
              {course.lieu} – {formatDateFr(course.date_course)}
            </p>
          )}
        </div>
        <div className="text-right space-y-1">
          <div>
            <p className="text-xs text-neutral-500">Heure actuelle</p>
            <p className="text-xl font-mono">{formatHeure(now)}</p>
          </div>
          <button
            type="button"
            onClick={handleRecalculerClassement}
            disabled={loadingClassement}
            className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-xs md:text-sm font-semibold text-white disabled:opacity-60"
          >
            {loadingClassement
              ? "Recalcul en cours..."
              : "Recalculer le classement (RPC)"}
          </button>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="rounded-md bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Bloc saisie + dernières arrivées */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Saisie arrivée */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-4">
          <h2 className="text-lg font-semibold">Saisie arrivée</h2>
          <form onSubmit={handleArrivee} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Numéro de dossard
              </label>
              <input
                type="number"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                value={dossard}
                onChange={(e) => setDossard(e.target.value)}
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loadingSave || !dossard}
              className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loadingSave ? "Enregistrement..." : "Arrivée maintenant"}
            </button>
          </form>
        </div>

        {/* Dernières arrivées */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-4">
          <h2 className="text-lg font-semibold">Dernières arrivées</h2>
          {lastArrivals.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Aucune arrivée enregistrée pour le moment.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4">Dossard</th>
                    <th className="text-left py-2 pr-4">Heure arrivée</th>
                  </tr>
                </thead>
                <tbody>
                  {lastArrivals.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b last:border-0"
                    >
                      <td className="py-1 pr-4 font-medium">
                        {row.dossard}
                      </td>
                      <td className="py-1 pr-4">
                        {formatHeure(row.heure_arrivee)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Tableaux de classement par format */}
      <div className="space-y-8">
        {formats && formats.length > 0 ? (
          formats.map((format) => {
            const rows = tableauxParFormat[format.id] || [];
            return (
              <div
                key={format.id}
                className="rounded-xl border border-neutral-200 bg-white p-4 space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {format.nom || "Format"} –{" "}
                      {format.distance_km
                        ? `${format.distance_km} km`
                        : ""}
                    </h2>
                    <p className="text-sm text-neutral-500">
                      {format.heure_depart && (
                        <>Départ : {formatHeureDepart(format.heure_depart)}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-neutral-500">
                      Arrivées enregistrées : {rows.length}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleResetFormat(format.id)}
                      className="inline-flex items-center justify-center rounded-lg border border-red-200 text-red-700 px-3 py-1.5 text-xs font-semibold hover:bg-red-50"
                    >
                      Réinitialiser le classement
                    </button>
                  </div>
                </div>

                {rows.length === 0 ? (
                  <p className="text-sm text-neutral-500">
                    Aucun arrivé enregistré sur ce format pour le
                    moment.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs md:text-sm">
                      <thead>
                        <tr className="border-b bg-neutral-50">
                          <th className="text-left py-2 px-2">
                            #
                          </th>
                          <th className="text-left py-2 px-2">
                            Sexe
                          </th>
                          <th className="text-left py-2 px-2">
                            Cat.
                          </th>
                          <th className="text-left py-2 px-2">
                            Code cat.
                          </th>
                          <th className="text-left py-2 px-2">
                            Dossard
                          </th>
                          <th className="text-left py-2 px-2">
                            Nom
                          </th>
                          <th className="text-left py-2 px-2">
                            Prénom
                          </th>
                          <th className="text-left py-2 px-2">
                            Club
                          </th>
                          <th className="text-left py-2 px-2">
                            Équipe
                          </th>
                          <th className="text-left py-2 px-2">
                            Chrono
                          </th>
                          <th className="text-left py-2 px-2">
                            km/h
                          </th>
                          <th className="text-left py-2 px-2">
                            min/km
                          </th>
                          <th className="text-left py-2 px-2">
                            Rang sexe
                          </th>
                          <th className="text-left py-2 px-2">
                            Rang cat.
                          </th>
                          <th className="text-left py-2 px-2">
                            Statut
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => {
                          const i = row.inscription;
                          const f = row.format;
                          const seconds = row.seconds;
                          const distanceKm = f?.distance_km || null;
                          const { kmh, minKm } = computeVitesse(
                            distanceKm,
                            seconds
                          );

                          const scratchRank =
                            row.scratchRank ?? i.rang_scratch;
                          const sexRank =
                            row.sexRankComputed ?? i.rang_sexe;
                          const catRank =
                            row.catRankComputed ?? i.rang_categorie;

                          const female = isFemaleGenre(i.genre);
                          const catCode =
                            catRank && i.categorie
                              ? `${catRank}${i.categorie}${
                                  female ? "F" : "H"
                                }`
                              : "—";

                          const isFemaleRow = female;
                          const isCatWinner = catRank === 1;

                          const rowClasses = [
                            isFemaleRow ? "bg-pink-50" : "",
                            isCatWinner
                              ? "border-l-4 border-red-500"
                              : "",
                            "border-b last:border-0",
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
                              <td className="py-1 px-2">
                                {i.categorie || "—"}
                              </td>
                              <td className="py-1 px-2 font-semibold">
                                {catCode}
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
                                {i.equipe_nom || i.equipe || "—"}
                              </td>
                              <td className="py-1 px-2 font-mono">
                                {formatChrono(seconds)}
                              </td>
                              <td className="py-1 px-2">
                                {kmh}
                              </td>
                              <td className="py-1 px-2">
                                {minKm}
                              </td>
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
                )}
              </div>
            );
          })
        ) : (
          <p className="text-sm text-neutral-500">
            Aucun format trouvé pour cette course.
          </p>
        )}
      </div>
    </div>
  );
}

export default ClassementArrivees;

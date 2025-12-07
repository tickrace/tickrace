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
  if (g === "F") return true;
  if (g.startsWith("FEM")) return true; // FEMME, FEMININ…
  return false;
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
  const [loadingSave, setLoadingSave] = useState(false);
  const [loadingClassement, setLoadingClassement] = useState(false);
  const [error, setError] = useState(null);

  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [inscriptions, setInscriptions] = useState([]);

  // Saisie par format : { formatId: "123" }
  const [dossardsParFormat, setDossardsParFormat] = useState({});

  // Edition ligne par ligne
  const [editingId, setEditingId] = useState(null);
  const [editingValues, setEditingValues] = useState({});

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

  // Helper pour recharger uniquement les inscriptions (après RPC/reset/edit)
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

  // Saisie d'une arrivée pour un format donné
  async function handleArrivee(e, formatId) {
    e.preventDefault();
    const dossard = dossardsParFormat[formatId] || "";
    if (!dossard) return;

    setError(null);
    setLoadingSave(true);

    try {
      // Chercher l'inscription par dossard pour CE format
      const { data: candidates, error: findErr } = await supabase
        .from("inscriptions")
        .select("id, dossard, format_id, heure_arrivee")
        .eq("dossard", dossard)
        .eq("format_id", formatId);

      if (findErr) throw findErr;

      if (!candidates || candidates.length === 0) {
        setError(`Aucune inscription trouvée pour le dossard ${dossard} sur ce format.`);
        setLoadingSave(false);
        return;
      }

      if (candidates.length > 1) {
        setError(
          `Plusieurs inscriptions trouvées pour le dossard ${dossard} sur ce format.`
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

      // On retrouve le format
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

      setDossardsParFormat((prev) => ({
        ...prev,
        [formatId]: "",
      }));
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

  // Edition d'une ligne de résultat
  function startEdit(inscription) {
    let timePart = "";
    if (inscription.heure_arrivee) {
      const d = new Date(inscription.heure_arrivee);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const ss = String(d.getSeconds()).padStart(2, "0");
      timePart = `${hh}:${mm}:${ss}`;
    }

    setEditingId(inscription.id);
    setEditingValues({
      dossard: inscription.dossard ?? "",
      team_name: inscription.team_name ?? "",
      statut_course: inscription.statut_course ?? "ok",
      categorie_age_code: inscription.categorie_age_code ?? "",
      categorie_age_label: inscription.categorie_age_label ?? "",
      heure_arrivee_time: timePart,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingValues({});
  }

  async function saveEdit() {
    if (!editingId) return;
    setError(null);
    setLoadingSave(true);

    try {
      const original = inscriptions.find((i) => i.id === editingId);
      if (!original) {
        setLoadingSave(false);
        return;
      }

      const payload = {
        dossard: editingValues.dossard || null,
        team_name: editingValues.team_name || null,
        statut_course: editingValues.statut_course || null,
        categorie_age_code: editingValues.categorie_age_code || null,
        categorie_age_label: editingValues.categorie_age_label || null,
      };

      // Si on a modifié l'heure d'arrivée
      if (editingValues.heure_arrivee_time) {
        const datePart =
          original.heure_arrivee?.slice(0, 10) ||
          (course?.date_course
            ? String(course.date_course)
            : new Date().toISOString().slice(0, 10));

        const timePart = editingValues.heure_arrivee_time;
        const newIso = `${datePart}T${timePart}`;
        const format = formats.find((f) => f.id === original.format_id);
        const seconds = computeTempsOfficielFromData(newIso, format, course);

        payload.heure_arrivee = newIso;
        if (seconds != null) {
          payload.temps_officiel_sec = seconds;
        }
      }

      const { error: updateErr } = await supabase
        .from("inscriptions")
        .update(payload)
        .eq("id", editingId);

      if (updateErr) throw updateErr;

      await refreshInscriptions();
      setEditingId(null);
      setEditingValues({});
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la modification du résultat.");
    } finally {
      setLoadingSave(false);
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

      // Rang par catégorie (code ou label) + sexe
      const catCounters = {};
      arr.forEach((row) => {
        if (row.seconds == null) {
          row.catRankComputed = null;
          return;
        }

        const i = row.inscription;
        const catCode =
          i.categorie_age_code ||
          i.categorie ||
          i.categorie_code ||
          i.categorie_age_label;

        if (!catCode) {
          row.catRankComputed = null;
          return;
        }

        const female = isFemaleGenre(i.genre);
        const sexKey = female ? "F" : "H";
        const key = `${catCode}_${sexKey}`;

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

      {/* Dernières arrivées globales */}
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
                  <th className="text-left py-2 pr-4">Format</th>
                  <th className="text-left py-2 pr-4">Heure arrivée</th>
                </tr>
              </thead>
              <tbody>
                {lastArrivals.map((row) => {
                  const f = formatsById[row.format_id];
                  return (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-1 pr-4 font-medium">
                        {row.dossard}
                      </td>
                      <td className="py-1 pr-4">
                        {f?.nom || "—"}
                      </td>
                      <td className="py-1 pr-4">
                        {formatHeure(row.heure_arrivee)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tableaux de classement par format, avec saisie au-dessus */}
      <div className="space-y-8">
        {formats && formats.length > 0 ? (
          formats.map((format) => {
            const rows = tableauxParFormat[format.id] || [];
            const dossardValue = dossardsParFormat[format.id] || "";

            return (
              <div
                key={format.id}
                className="rounded-xl border border-neutral-200 bg-white p-4 space-y-4"
              >
                {/* En-tête format */}
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
                      Arrivées (toutes inscriptions) : {rows.length}
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

                {/* Saisie arrivée pour CE format */}
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                  <h3 className="text-sm font-semibold mb-2">
                    Saisie d’arrivée – {format.nom}
                  </h3>
                  <form
                    onSubmit={(e) => handleArrivee(e, format.id)}
                    className="flex flex-col sm:flex-row gap-2 sm:items-end"
                  >
                    <div className="flex-1">
                      <label className="block text-xs font-medium mb-1">
                        Numéro de dossard
                      </label>
                      <input
                        type="number"
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                        value={dossardValue}
                        onChange={(e) =>
                          setDossardsParFormat((prev) => ({
                            ...prev,
                            [format.id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loadingSave || !dossardValue}
                      className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {loadingSave ? "Enregistrement..." : "Arrivée maintenant"}
                    </button>
                  </form>
                </div>

                {/* Tableau de classement */}
                {rows.length === 0 ? (
                  <p className="text-sm text-neutral-500">
                    Aucun inscrit ou aucune arrivée enregistrée sur ce format pour le moment.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs md:text-sm">
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
                          <th className="text-left py-2 px-2">Actions</th>
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
                            isFemaleRow ? "bg-pink-50" : "",
                            isCatWinner
                              ? "border-l-4 border-red-500"
                              : "",
                            "border-b last:border-0",
                          ]
                            .filter(Boolean)
                            .join(" ");

                          const isEditing = editingId === i.id;

                          return (
                            <tr key={i.id} className={rowClasses}>
                              {/* Rang scratch */}
                              <td className="py-1 px-2 font-semibold">
                                {scratchRank || "—"}
                              </td>

                              {/* Sexe */}
                              <td className="py-1 px-2">
                                {i.genre || "—"}
                              </td>

                              {/* Catégorie affichée */}
                              <td className="py-1 px-2">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    className="w-24 rounded border border-neutral-300 px-1 py-0.5 text-xs"
                                    value={
                                      editingValues.categorie_age_label ?? ""
                                    }
                                    onChange={(e) =>
                                      setEditingValues((prev) => ({
                                        ...prev,
                                        categorie_age_label: e.target.value,
                                      }))
                                    }
                                  />
                                ) : (
                                  catDisplay
                                )}
                              </td>

                              {/* Code cat. */}
                              <td className="py-1 px-2 font-semibold">
                                {codeCat}
                              </td>

                              {/* Dossard */}
                              <td className="py-1 px-2 font-mono">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    className="w-16 rounded border border-neutral-300 px-1 py-0.5 text-xs"
                                    value={editingValues.dossard ?? ""}
                                    onChange={(e) =>
                                      setEditingValues((prev) => ({
                                        ...prev,
                                        dossard: e.target.value,
                                      }))
                                    }
                                  />
                                ) : (
                                  i.dossard || "—"
                                )}
                              </td>

                              {/* Nom */}
                              <td className="py-1 px-2 uppercase">
                                {i.nom || "—"}
                              </td>

                              {/* Prénom */}
                              <td className="py-1 px-2 capitalize">
                                {i.prenom || "—"}
                              </td>

                              {/* Club */}
                              <td className="py-1 px-2">
                                {i.club || "—"}
                              </td>

                              {/* Équipe */}
                              <td className="py-1 px-2">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    className="w-32 rounded border border-neutral-300 px-1 py-0.5 text-xs"
                                    value={editingValues.team_name ?? ""}
                                    onChange={(e) =>
                                      setEditingValues((prev) => ({
                                        ...prev,
                                        team_name: e.target.value,
                                      }))
                                    }
                                  />
                                ) : (
                                  i.team_name || "—"
                                )}
                              </td>

                              {/* Chrono */}
                              <td className="py-1 px-2 font-mono">
                                {formatChrono(seconds)}
                              </td>

                              {/* Vitesse */}
                              <td className="py-1 px-2">
                                {kmh}
                              </td>
                              <td className="py-1 px-2">
                                {minKm}
                              </td>

                              {/* Rang sexe */}
                              <td className="py-1 px-2">
                                {sexRank || "—"}
                              </td>

                              {/* Rang cat */}
                              <td className="py-1 px-2">
                                {catRank || "—"}
                              </td>

                              {/* Statut */}
                              <td className="py-1 px-2">
                                {isEditing ? (
                                  <select
                                    className="w-20 rounded border border-neutral-300 px-1 py-0.5 text-xs"
                                    value={editingValues.statut_course ?? "ok"}
                                    onChange={(e) =>
                                      setEditingValues((prev) => ({
                                        ...prev,
                                        statut_course: e.target.value,
                                      }))
                                    }
                                  >
                                    <option value="ok">ok</option>
                                    <option value="dnf">DNF</option>
                                    <option value="dns">DNS</option>
                                    <option value="dsq">DSQ</option>
                                  </select>
                                ) : (
                                  i.statut_course || "ok"
                                )}
                              </td>

                              {/* Actions (édition + heure) */}
                              <td className="py-1 px-2">
                                {isEditing ? (
                                  <div className="flex flex-col gap-1">
                                    <input
                                      type="time"
                                      step="1"
                                      className="w-24 rounded border border-neutral-300 px-1 py-0.5 text-xs"
                                      value={
                                        editingValues.heure_arrivee_time ?? ""
                                      }
                                      onChange={(e) =>
                                        setEditingValues((prev) => ({
                                          ...prev,
                                          heure_arrivee_time: e.target.value,
                                        }))
                                      }
                                    />
                                    <div className="flex gap-1 mt-1">
                                      <button
                                        type="button"
                                        onClick={saveEdit}
                                        className="px-2 py-0.5 rounded bg-emerald-600 text-white text-xs"
                                      >
                                        Sauver
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelEdit}
                                        className="px-2 py-0.5 rounded bg-neutral-200 text-xs"
                                      >
                                        Annuler
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startEdit(i)}
                                    className="px-2 py-0.5 rounded border border-neutral-300 text-xs hover:bg-neutral-100"
                                  >
                                    Modifier
                                  </button>
                                )}
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

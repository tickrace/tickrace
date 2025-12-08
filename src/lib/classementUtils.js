// src/lib/classementUtils.js

// ---------- Helpers génériques ----------

export function formatChrono(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const s = Number(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (v) => String(v).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export function computeVitesse(distanceKm, seconds) {
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

export function formatDateFr(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

// Détecter si le genre est féminin (gère "F", "Femme", etc.)
export function isFemaleGenre(genre) {
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
 *  - on se base toujours sur la date de l’arrivée,
 *    et si la date course est la même, on l’utilise.
 */
export function computeTempsOfficielFromData(heureArriveeIso, format, course) {
  if (!heureArriveeIso || !format?.heure_depart) return null;

  try {
    const arrivee = new Date(heureArriveeIso);
    if (Number.isNaN(arrivee.getTime())) return null;

    // Date du jour de l'arrivée (YYYY-MM-DD)
    const arriveeDateStr = heureArriveeIso.slice(0, 10);
    let baseDateStr = arriveeDateStr;

    if (course?.date_course) {
      const courseDateStr = String(course.date_course);
      if (courseDateStr === arriveeDateStr) {
        baseDateStr = courseDateStr;
      }
    }

    const rawTime = String(format.heure_depart);
    const timePart = rawTime.split(".")[0];
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
export function computeTempsOfficielSecFallback(inscription, format, course) {
  if (inscription?.temps_officiel_sec != null) {
    return inscription.temps_officiel_sec;
  }
  if (!inscription?.heure_arrivee) return null;
  return computeTempsOfficielFromData(inscription.heure_arrivee, format, course);
}

/**
 * Construit les tableaux de classement par format :
 * - tri par chrono
 * - rang scratch
 * - rang par sexe
 * - rang par catégorie (cat + sexe)
 *
 * Retourne : { [formatId]: rows[] }
 * où row = { inscription, format, seconds, scratchRank, sexRank, catRank }
 */
export function buildClassementParFormat(inscriptions, formats, course) {
  const res = {};
  if (!inscriptions || inscriptions.length === 0) return res;

  const formatsById = {};
  (formats || []).forEach((f) => {
    formatsById[f.id] = f;
  });

  inscriptions.forEach((i) => {
    if (!res[i.format_id]) res[i.format_id] = [];
    const format = formatsById[i.format_id];
    const seconds = computeTempsOfficielSecFallback(i, format, course);
    res[i.format_id].push({
      inscription: i,
      format,
      seconds,
      scratchRank: null,
      sexRank: null,
      catRank: null,
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
        row.sexRank = null;
        return;
      }
      const female = isFemaleGenre(row.inscription.genre);
      if (female) {
        femaleRank += 1;
        row.sexRank = femaleRank;
      } else {
        maleRank += 1;
        row.sexRank = maleRank;
      }
    });

    // Rang par catégorie (code ou label) + sexe
    const catCounters = {};
    arr.forEach((row) => {
      if (row.seconds == null) {
        row.catRank = null;
        return;
      }

      const i = row.inscription;
      const catCode =
        i.categorie_age_code ||
        i.categorie ||
        i.categorie_code ||
        i.categorie_age_label;

      if (!catCode) {
        row.catRank = null;
        return;
      }

      const female = isFemaleGenre(i.genre);
      const sexKey = female ? "F" : "H";
      const key = `${catCode}_${sexKey}`;

      catCounters[key] = (catCounters[key] || 0) + 1;
      row.catRank = catCounters[key];
    });
  });

  return res;
}

// src/utils/ageCategories.js

/**
 * Calcule la catégorie d'un athlète à une date de course donnée.
 *
 * @param {Object} params
 * @param {Date | string} params.birthDate   - Date de naissance du coureur
 * @param {Date | string} params.eventDate   - Date de l'épreuve
 * @param {Array} params.categories          - Liste des catégories (déjà filtrées par fédé + éventuellement par sexe)
 * @param {string} [params.sex='ALL']        - 'M', 'F', 'X' ou 'ALL'
 * @param {number} [params.federationSeasonStartMonth=1] - Mois de début de saison de la fédé (1..12)
 *
 * @returns {Object|null} catégorie (ligne Supabase) ou null si aucune
 */
export function computeCategoryForAthlete({
  birthDate,
  eventDate,
  categories,
  sex = "ALL",
  federationSeasonStartMonth = 1,
}) {
  if (!birthDate || !eventDate || !Array.isArray(categories) || categories.length === 0) {
    return null;
  }

  const birth = birthDate instanceof Date ? birthDate : new Date(birthDate);
  const event = eventDate instanceof Date ? eventDate : new Date(eventDate);

  if (Number.isNaN(birth.getTime()) || Number.isNaN(event.getTime())) {
    return null;
  }

  const birthYear = birth.getFullYear();
  const eventYear = event.getFullYear();
  const eventMonth = event.getMonth() + 1;

  // On suppose que les catégories sont déjà triées par sort_order ASC côté requête.
  for (const cat of categories) {
    if (!cat) continue;

    // Filtre sexe
    const catSex = cat.sex || "ALL";
    if (catSex !== "ALL" && catSex !== sex) {
      continue;
    }

    const seasonStartMonth =
      cat.season_start_month ||
      cat.seasonStartMonth ||
      federationSeasonStartMonth ||
      1;

    // Année de référence pour le calcul de l'âge (utile si tu utilises age_min / age_max)
    const refYear = eventMonth >= seasonStartMonth ? eventYear : eventYear - 1;
    const age = refYear - birthYear;

    // 1) Filtre sur années de naissance si défini
    if (cat.birthyear_min != null && birthYear < cat.birthyear_min) {
      continue;
    }
    if (cat.birthyear_max != null && birthYear > cat.birthyear_max) {
      continue;
    }

    // 2) Filtre sur âge si défini (permet d'avoir un système générique qui se décale chaque année)
    if (cat.age_min != null && age < cat.age_min) {
      continue;
    }
    if (cat.age_max != null && age > cat.age_max) {
      continue;
    }

    // Si tous les critères sont OK, on retourne la première catégorie (d'où l'importance du sort_order)
    return cat;
  }

  return null;
}

/**
 * Helper pour juste retourner le label.
 */
export function getCategoryLabelForAthlete(params) {
  const cat = computeCategoryForAthlete(params);
  return cat ? cat.label : null;
}

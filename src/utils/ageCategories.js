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
  sex = "ALL",
  categories = [],
  federationSeasonStartMonth = 1,
}) {
  if (!birthDate || !eventDate || !Array.isArray(categories)) return null;

  const b = birthDate instanceof Date ? birthDate : new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;

  const dEvent = eventDate instanceof Date ? eventDate : new Date(eventDate);
  if (Number.isNaN(dEvent.getTime())) return null;

  const birthYear = b.getFullYear();

  // Si tes catégories portent leur propre season_start_month, on peut l’utiliser,
  // sinon fallback param federationSeasonStartMonth
  const seasonStartMonth =
    Number(categories?.[0]?.season_start_month) || federationSeasonStartMonth;

  const seasonYear = getSeasonYear(dEvent, seasonStartMonth);
  if (!seasonYear) return null;

  const age = getAgeAtSeasonYear(b, seasonYear);
  if (age == null) return null;

  const eligible = categories.filter((cat) => {
    if (cat.is_active === false) return false;
    if (!isSexCompatible(cat.sex, sex)) return false;

    // 1) Priorité : bornes par année de naissance (FFA-like)
    const byMin = cat.birthyear_min != null ? parseInt(cat.birthyear_min, 10) : null;
    const byMax = cat.birthyear_max != null ? parseInt(cat.birthyear_max, 10) : null;

    if (byMin != null || byMax != null) {
      const minY = Number.isNaN(byMin) ? null : byMin;
      const maxY = Number.isNaN(byMax) ? null : byMax;
      if (minY != null && birthYear < minY) return false;
      if (maxY != null && birthYear > maxY) return false;
      return true;
    }

    // 2) Sinon fallback : bornes par âge (age_min/age_max)
    const amin = cat.age_min != null ? parseInt(cat.age_min, 10) : null;
    const amax = cat.age_max != null ? parseInt(cat.age_max, 10) : null;
    const minA = Number.isNaN(amin) ? null : amin;
    const maxA = Number.isNaN(amax) ? null : amax;

    if (minA != null && age < minA) return false;
    if (maxA != null && age > maxA) return false;

    // si aucune borne n'est définie, on considère la catégorie éligible
    return true;
  });

  if (!eligible.length) return null;

  const sorted = [...eligible].sort((a, b) => {
    const soA = a.sort_order != null ? parseInt(a.sort_order, 10) : 0;
    const soB = b.sort_order != null ? parseInt(b.sort_order, 10) : 0;
    if (soA !== soB) return soA - soB;

    // secondaire : fenêtre la plus précise (année naissance si dispo, sinon âge)
    const spanBirthA =
      (parseInt(a.birthyear_max ?? "0", 10) || 0) - (parseInt(a.birthyear_min ?? "0", 10) || 0);
    const spanBirthB =
      (parseInt(b.birthyear_max ?? "0", 10) || 0) - (parseInt(b.birthyear_min ?? "0", 10) || 0);

    if (spanBirthA && spanBirthB && spanBirthA !== spanBirthB) return spanBirthA - spanBirthB;

    const spanAgeA =
      (parseInt(a.age_max ?? "0", 10) || 0) - (parseInt(a.age_min ?? "0", 10) || 0);
    const spanAgeB =
      (parseInt(b.age_max ?? "0", 10) || 0) - (parseInt(b.age_min ?? "0", 10) || 0);

    return spanAgeA - spanAgeB;
  });

  return sorted[0] || null;
}

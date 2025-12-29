// src/lib/justificatifs.js

export const JUSTIFICATIF_TYPES = Object.freeze({
  PPS: "pps",
  LICENCE_FFA: "licence_ffa",
  CERTIFICAT_MEDICAL: "certificat_medical",
  AUTRE: "autre",
});

export const JUSTIFICATIF_LABELS = Object.freeze({
  [JUSTIFICATIF_TYPES.PPS]: "PPS",
  [JUSTIFICATIF_TYPES.LICENCE_FFA]: "Licence FFA",
  [JUSTIFICATIF_TYPES.CERTIFICAT_MEDICAL]: "Certificat médical",
  [JUSTIFICATIF_TYPES.AUTRE]: "Autre justificatif",
});

export function isUploadType(type) {
  return type === JUSTIFICATIF_TYPES.CERTIFICAT_MEDICAL || type === JUSTIFICATIF_TYPES.AUTRE;
}

export function isTextType(type) {
  return type === JUSTIFICATIF_TYPES.PPS || type === JUSTIFICATIF_TYPES.LICENCE_FFA;
}

/**
 * Nettoyage de l’état justificatif lorsqu’on change de type
 * - évite d’avoir PPS + licence + upload en même temps
 */
export function sanitizeOnTypeChange(current, nextType) {
  const next = { ...(current || {}) };

  next.justificatif_type = nextType;

  if (nextType === JUSTIFICATIF_TYPES.PPS) {
    next.numero_licence = "";
    next.justificatif_url = null;
    // pps_identifier conservé
    return next;
  }

  if (nextType === JUSTIFICATIF_TYPES.LICENCE_FFA) {
    next.pps_identifier = "";
    next.justificatif_url = null;
    // numero_licence conservé
    return next;
  }

  if (nextType === JUSTIFICATIF_TYPES.CERTIFICAT_MEDICAL || nextType === JUSTIFICATIF_TYPES.AUTRE) {
    next.numero_licence = "";
    next.pps_identifier = "";
    // justificatif_url conservé
    return next;
  }

  return next;
}

/**
 * Validation "donnée" (pas de backend ici)
 * Retourne { ok, missing, errors[] }
 */
export function validateJustificatif(payload, { required = false } = {}) {
  const p = payload || {};
  const type = p.justificatif_type || JUSTIFICATIF_TYPES.PPS;

  const errors = [];

  const hasPps = !!(p.pps_identifier && String(p.pps_identifier).trim());
  const hasLicence = !!(p.numero_licence && String(p.numero_licence).trim());
  const hasUpload = !!(p.justificatif_url && String(p.justificatif_url).trim());

  let ok = true;

  if (type === JUSTIFICATIF_TYPES.PPS) ok = hasPps;
  else if (type === JUSTIFICATIF_TYPES.LICENCE_FFA) ok = hasLicence;
  else if (isUploadType(type)) ok = hasUpload;
  else ok = false;

  if (required && !ok) {
    errors.push("Justificatif requis manquant.");
  }

  // Incohérences (optionnel, mais utile pour debug)
  if (type === JUSTIFICATIF_TYPES.PPS && hasLicence) {
    errors.push("Incohérence : PPS sélectionné mais une licence est renseignée.");
  }
  if (type === JUSTIFICATIF_TYPES.LICENCE_FFA && hasPps) {
    errors.push("Incohérence : Licence sélectionnée mais un PPS est renseigné.");
  }
  if (isUploadType(type) && (hasPps || hasLicence)) {
    errors.push("Incohérence : Upload sélectionné mais PPS/licence renseigné.");
  }

  return {
    ok,
    missing: required ? !ok : false,
    errors,
  };
}

/**
 * Profil "par défaut" : ce qui est requis / autorisé selon sport/fédé
 * -> Tu pourras plus tard surcharger via un champ en DB côté format/course.
 */
export function getJustificatifRequirementProfile({
  sport_code,
  federation_code,
  country_code,
} = {}) {
  const sport = (sport_code || "").toLowerCase();
  const fed = (federation_code || "").toLowerCase();
  const country = (country_code || "FR").toUpperCase();

  // Par défaut (générique)
  let required = false;
  let allowed = [
    JUSTIFICATIF_TYPES.PPS,
    JUSTIFICATIF_TYPES.LICENCE_FFA,
    JUSTIFICATIF_TYPES.CERTIFICAT_MEDICAL,
    JUSTIFICATIF_TYPES.AUTRE,
  ];
  let defaultType = JUSTIFICATIF_TYPES.PPS;
  let label = "Justificatif";

  // France running/trail : logique PPS/licence (à affiner plus tard)
  if (country === "FR" && (sport === "trail" || sport === "running")) {
    required = true;
    allowed = [JUSTIFICATIF_TYPES.PPS, JUSTIFICATIF_TYPES.LICENCE_FFA];
    defaultType = JUSTIFICATIF_TYPES.PPS;
    label = "PPS ou Licence FFA";
  }

  // Si on sait explicitement que c’est FFA
  if (country === "FR" && fed === "ffa") {
    required = true;
    allowed = [JUSTIFICATIF_TYPES.PPS, JUSTIFICATIF_TYPES.LICENCE_FFA];
    defaultType = JUSTIFICATIF_TYPES.PPS;
    label = "PPS ou Licence FFA";
  }

  // Sports autres (VTT, tri, etc.) : souvent upload / autre (placeholder)
  if (sport && !["trail", "running"].includes(sport)) {
    required = false; // on ne force pas tant qu’on n’a pas la règle par fédé
    allowed = [JUSTIFICATIF_TYPES.AUTRE, JUSTIFICATIF_TYPES.CERTIFICAT_MEDICAL];
    defaultType = JUSTIFICATIF_TYPES.AUTRE;
    label = "Justificatif (document)";
  }

  return { required, allowed, defaultType, label };
}

/**
 * Applique un patch de manière sûre côté state (évite les mélanges)
 * - si patch contient justificatif_type -> on sanitize
 */
export function mergeJustificatifState(prev, patch) {
  const p = prev || {};
  const next = { ...p, ...(patch || {}) };

  if (patch && Object.prototype.hasOwnProperty.call(patch, "justificatif_type")) {
    return sanitizeOnTypeChange(next, patch.justificatif_type);
  }

  // Si on modifie un champ, on peut aussi "nettoyer" légèrement
  const type = next.justificatif_type || JUSTIFICATIF_TYPES.PPS;

  if (type === JUSTIFICATIF_TYPES.PPS) {
    next.numero_licence = "";
    next.justificatif_url = null;
  } else if (type === JUSTIFICATIF_TYPES.LICENCE_FFA) {
    next.pps_identifier = "";
    next.justificatif_url = null;
  } else if (isUploadType(type)) {
    next.numero_licence = "";
    next.pps_identifier = "";
  }

  return next;
}

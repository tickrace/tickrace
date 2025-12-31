// src/lib/justificatifs.js

/**
 * ✅ Catalogue “simple” (course-level)
 * - On garde une liste stable côté front, pour éviter de recoder partout
 * - Chaque type a un code + label
 * - `input` indique ce qu’on attend côté coureur
 */

export const JUSTIFICATIF_TYPES = [
  { code: "", label: "— Aucun —", input: "none" },

  // Certificat / PPS / Attestation (upload)
  { code: "certificat_medical_upload", label: "Certificat médical (upload)", input: "upload" },
  { code: "attestation_medicale_upload", label: "Attestation médicale (upload)", input: "upload" },
  { code: "pps_upload", label: "PPS (upload)", input: "upload" },

  // Codes / identifiants
  { code: "pps_code", label: "PPS (code / identifiant)", input: "text" },

  // Licences (texte)
  { code: "licence_ffa", label: "Licence FFA", input: "text" },
  { code: "licence_ffc", label: "Licence FFC", input: "text" },
  { code: "licence_fft", label: "Licence FFTri", input: "text" },
  { code: "licence_autre", label: "Licence (autre fédération)", input: "text" },

  // Autres
  { code: "autorisation_parentale", label: "Autorisation parentale", input: "checkbox" },
];

/**
 * Normalise un code (évite null/undefined)
 */
export function normalizeJustificatifType(code) {
  return String(code || "").trim();
}

/**
 * ✅ Retourne le “profil de besoin” à partir d’une course (settings au niveau courses)
 * Attendu côté DB (proposition) :
 * - courses.justif_required (bool)
 * - courses.justif_type_1 (text)
 * - courses.justif_type_2 (text)
 * - courses.justif_type_3 (text)
 * - courses.parental_authorization_enabled (bool)
 *
 * (Si tes champs ont d’autres noms, adapte juste ici : 1 seul endroit.)
 */
export function getJustificatifRequirementProfile(course) {
  const required = !!course?.justif_required;

  const t1 = normalizeJustificatifType(course?.justif_type_1);
  const t2 = normalizeJustificatifType(course?.justif_type_2);
  const t3 = normalizeJustificatifType(course?.justif_type_3);

  // On retire les vides et on déduplique en gardant l’ordre
  const types = Array.from(new Set([t1, t2, t3].filter(Boolean)));

  const parental = !!course?.parental_authorization_enabled;

  return {
    required,
    types, // liste 0..3
    parental_authorization_enabled: parental,
  };
}

/**
 * ✅ Fusion “safe” d’état Justificatif (utile pour centraliser les updates)
 * - base : état actuel (form)
 * - patch : nouvelles valeurs (partielles)
 */
export function mergeJustificatifState(base, patch) {
  const b = base || {};
  const p = patch || {};
  return {
    ...b,
    ...p,
  };
}

/**
 * ✅ Indique si un type autorise un upload (input === "upload")
 */
export function justificatifTypeAllowsUpload(typeCode) {
  const code = normalizeJustificatifType(typeCode);
  const found = JUSTIFICATIF_TYPES.find((t) => t.code === code);
  return found?.input === "upload";
}

/**
 * ✅ Validation minimale : “est-ce que le coureur a répondu ?”
 * Convention “simple” attendue côté inscriptions :
 * - inscriptions.justif_choice (text) : le type choisi par le coureur
 * - inscriptions.justif_value_text (text) : licence / code PPS / etc.
 * - inscriptions.justif_file_url (text) : URL publique si upload
 * - inscriptions.parental_authorization (bool)
 *
 * (Là aussi : si tes noms diffèrent, adapte ici uniquement.)
 */
export function isJustificatifComplete({ courseProfile, inscription }) {
  const prof = courseProfile || { required: false, types: [], parental_authorization_enabled: false };
  const ins = inscription || {};

  if (!prof.required && !prof.parental_authorization_enabled) return true;

  // Autorisation parentale
  if (prof.parental_authorization_enabled) {
    if (!ins.parental_authorization) return false;
  }

  if (!prof.required) return true;

  const choice = normalizeJustificatifType(ins.justif_choice);
  if (!choice) return false;

  const typeDef = JUSTIFICATIF_TYPES.find((t) => t.code === choice);

  // Si le coureur choisit un type qui n’est pas dans la config (si config non vide), on refuse
  if (Array.isArray(prof.types) && prof.types.length > 0) {
    if (!prof.types.includes(choice)) return false;
  }

  // upload vs text vs checkbox
  const input = typeDef?.input || "text";
  if (input === "upload") return !!String(ins.justif_file_url || "").trim();
  if (input === "checkbox") return !!ins.parental_authorization; // cas rare si on met AP comme “justif”
  // text
  return !!String(ins.justif_value_text || "").trim();
}

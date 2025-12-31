// src/lib/justificatifs.js

/* ------------------------------------------------------------------
   Catalogue (fallback) des types de justificatifs
   - La source de vérité côté DB reste la table `justificatif_types`
   - Ce catalogue sert de fallback + pour les composants admin/UI
------------------------------------------------------------------- */

export const JUSTIF_TYPES = [
  {
    code: "pps",
    label: "PPS",
    federation_code: "FFA",
    input_mode: "pps", // saisie code
    is_medical: true,
    sort_order: 10,
  },
  {
    code: "licence_ffa",
    label: "Licence FFA",
    federation_code: "FFA",
    input_mode: "licence", // saisie numéro licence
    is_medical: false,
    sort_order: 20,
  },
  {
    code: "certificat_medical",
    label: "Certificat médical",
    federation_code: null,
    input_mode: "upload", // upload
    is_medical: true,
    sort_order: 30,
  },
  {
    code: "autre_licence",
    label: "Autre licence",
    federation_code: null,
    input_mode: "licence",
    is_medical: false,
    sort_order: 40,
  },
];

/* ✅ Alias (certains composants utilisent l’un ou l’autre) */
export const JUSTIFICATIF_TYPES = JUSTIF_TYPES;

/* ✅ Labels (ancien nom souvent importé) */
export const JUSTIFICATIF_LABELS = Object.fromEntries(
  JUSTIF_TYPES.map((t) => [t.code, t.label])
);

/* ------------------------------------------------------------------
   Helpers
------------------------------------------------------------------- */

const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));

export function normalizeJustificatifState(state) {
  const s = state || {};
  return {
    is_required: s.is_required !== false, // default true si défini
    allow_medical_upload: !!s.allow_medical_upload,
    allowed_types: uniq(Array.isArray(s.allowed_types) ? s.allowed_types : []),
    notes: typeof s.notes === "string" ? s.notes : "",
  };
}

/**
 * Profil "requirements" prêt à consommer par l’UI
 * - accepte un objet venant de DB (course_justificatif_policies / format policies)
 */
export function getJustificatifRequirementProfile(rawPolicy) {
  return normalizeJustificatifState(rawPolicy);
}

/**
 * Merge robuste (admin patch) : garde les defaults, dédoublonne allowed_types
 */
export function mergeJustificatifState(prev, patch) {
  const a = normalizeJustificatifState(prev);
  const p = patch || {};
  const next = {
    ...a,
    ...p,
  };

  // allowed_types : union + uniq si patch fourni
  if (Object.prototype.hasOwnProperty.call(p, "allowed_types")) {
    next.allowed_types = uniq(Array.isArray(p.allowed_types) ? p.allowed_types : []);
  } else {
    next.allowed_types = uniq(a.allowed_types);
  }

  // booleans
  if (Object.prototype.hasOwnProperty.call(p, "is_required")) {
    next.is_required = p.is_required !== false;
  }
  if (Object.prototype.hasOwnProperty.call(p, "allow_medical_upload")) {
    next.allow_medical_upload = !!p.allow_medical_upload;
  }

  // notes
  if (Object.prototype.hasOwnProperty.call(p, "notes")) {
    next.notes = typeof p.notes === "string" ? p.notes : "";
  }

  return next;
}

// src/components/JustificatifTypes.js
// Catalogue des types de justificatifs + helpers d'affichage.
//
// Objectif : centraliser les "labels", "descriptions", et quelques outils de rendu
// pour éviter de dupliquer partout (InscriptionCourse, ListeInscriptions, etc.).

import {
  TYPE_PPS,
  TYPE_LICENCE_FFA,
  TYPE_LICENCE_AUTRE,
  TYPE_CERTIF_MEDICAL,
  TYPE_AUTRE_DOC,
} from "./JustificatifRulesEngine";
export const JUSTIF_TYPES = Object.freeze({
  PPS: TYPE_PPS,
  LICENCE_FFA: TYPE_LICENCE_FFA,
  LICENCE_AUTRE: TYPE_LICENCE_AUTRE,
  CERTIF_MEDICAL: TYPE_CERTIF_MEDICAL,
  AUTRE_DOC: TYPE_AUTRE_DOC,
});

export const JUSTIFICATIF_TYPES = [
  {
    code: TYPE_PPS,
    label: "PPS",
    short: "PPS",
    description:
      "Parcours Prévention Santé : saisis/scanne le code PPS valide (recommandé pour la majorité des courses).",
    fields: ["pps_identifier", "pps_expiry_date"],
    kind: "code",
  },
  {
    code: TYPE_LICENCE_FFA,
    label: "Licence FFA",
    short: "FFA",
    description: "Licence Fédération Française d’Athlétisme (numéro de licence requis).",
    fields: ["numero_licence"],
    kind: "licence",
  },
  {
    code: TYPE_LICENCE_AUTRE,
    label: "Licence (autre fédération)",
    short: "Autre licence",
    description: "Licence d’une autre fédération acceptée par l’organisateur (code fédé + numéro).",
    fields: ["federation_code", "numero_licence"],
    kind: "licence",
  },
  {
    code: TYPE_CERTIF_MEDICAL,
    label: "Certificat médical",
    short: "Certificat",
    description:
      "Téléverse un certificat médical si l’organisateur l’autorise (selon règlement).",
    fields: ["justificatif_url"],
    kind: "upload",
  },
  {
    code: TYPE_AUTRE_DOC,
    label: "Autre document",
    short: "Document",
    description:
      "Téléverse un document accepté par l’organisateur (ex: autorisation parentale, attestation).",
    fields: ["justificatif_url"],
    kind: "upload",
  },
];

export const JUSTIFICATIF_TYPE_MAP = JUSTIFICATIF_TYPES.reduce((acc, t) => {
  acc[t.code] = t;
  return acc;
}, {});

export function getJustificatifTypeMeta(code) {
  return JUSTIFICATIF_TYPE_MAP[code] || null;
}

export function getJustificatifLabel(code) {
  return getJustificatifTypeMeta(code)?.label || code || "—";
}

export function getJustificatifShort(code) {
  return getJustificatifTypeMeta(code)?.short || code || "—";
}

export function getJustificatifDescription(code) {
  return getJustificatifTypeMeta(code)?.description || "";
}

export function getJustificatifFields(code) {
  return getJustificatifTypeMeta(code)?.fields || [];
}

export function getJustificatifKind(code) {
  return getJustificatifTypeMeta(code)?.kind || "unknown";
}

/**
 * Retourne une "valeur visible" courte pour affichage dans un tableau.
 * Ex:
 * - PPS => "ABCD-1234"
 * - Licence => "FFC • 123456"
 * - Upload => "Document"
 */
export function getJustificatifDisplayValue(j) {
  if (!j) return "—";
  const t = j.justificatif_type;
  if (t === TYPE_PPS) {
    return j.pps_identifier ? String(j.pps_identifier).trim() : "PPS";
  }
  if (t === TYPE_LICENCE_FFA) {
    return j.numero_licence ? String(j.numero_licence).trim() : "Licence FFA";
  }
  if (t === TYPE_LICENCE_AUTRE) {
    const fed = (j.federation_code || "").trim();
    const num = (j.numero_licence || "").trim();
    if (fed && num) return `${fed} • ${num}`;
    if (num) return num;
    return "Licence";
  }
  if (t === TYPE_CERTIF_MEDICAL) {
    return j.justificatif_url ? "Certificat" : "Certificat (manquant)";
  }
  if (t === TYPE_AUTRE_DOC) {
    return j.justificatif_url ? "Document" : "Document (manquant)";
  }
  return "—";
}

/**
 * Normalise un objet justificatif (évite undefined)
 */
export function normalizeJustificatif(value = {}) {
  return {
    justificatif_type: value.justificatif_type || "",
    numero_licence: value.numero_licence || "",
    pps_identifier: value.pps_identifier || "",
    pps_expiry_date: value.pps_expiry_date || "",
    federation_code: value.federation_code || "",
    justificatif_url: value.justificatif_url || "",
  };
}

/**
 * Reset les champs non pertinents pour un type donné (optionnel).
 * Utile quand l’utilisateur change de type et qu’on veut éviter de garder
 * une ancienne valeur (ex: garder un justificatif_url alors qu'on passe sur PPS).
 */
export function sanitizeJustificatifForType(nextType, value = {}) {
  const v = normalizeJustificatif(value);
  const keep = new Set(getJustificatifFields(nextType));

  // Toujours garder justificatif_type
  const out = { justificatif_type: nextType };

  // Conserve uniquement les champs du type
  ["numero_licence", "pps_identifier", "pps_expiry_date", "federation_code", "justificatif_url"].forEach(
    (k) => {
      out[k] = keep.has(k) ? v[k] : "";
    }
  );

  return out;
}

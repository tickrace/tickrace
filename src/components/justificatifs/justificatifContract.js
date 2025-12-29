// src/components/justificatifs/justificatifContract.js

export const JUSTIFICATIF_TYPES = {
  none: { label: "Aucun", requires: [] },

  pps: {
    label: "PPS",
    requires: ["ppsCode"],
    normalize: (p = {}) => ({
      ppsCode: String(p.ppsCode || "").trim(),
      method: p.method === "qr" ? "qr" : p.method === "manual" ? "manual" : undefined,
      scanPath: p.scanPath ? String(p.scanPath) : undefined,
      verified: typeof p.verified === "boolean" ? p.verified : undefined,
      verifiedAt: p.verifiedAt ? String(p.verifiedAt) : undefined,
    }),
    validate: (payload) => {
      const errs = [];
      if (!payload.ppsCode || payload.ppsCode.length < 6) errs.push("PPS: code requis.");
      return errs;
    },
  },

  licence_ffa: {
    label: "Licence FFA",
    requires: ["licence"],
    normalize: (p = {}) => ({
      licence: String(p.licence || "").trim(),
      season: p.season ? String(p.season).trim() : undefined,
      club: p.club ? String(p.club).trim() : undefined,
    }),
    validate: (payload) => {
      const errs = [];
      if (!payload.licence || payload.licence.length < 5) errs.push("Licence FFA: numéro requis.");
      return errs;
    },
  },

  licence_federation: {
    label: "Licence (autre fédération)",
    requires: ["federation", "licence"],
    normalize: (p = {}) => ({
      federation: String(p.federation || "").trim(),
      licence: String(p.licence || "").trim(),
      season: p.season ? String(p.season).trim() : undefined,
    }),
    validate: (payload) => {
      const errs = [];
      if (!payload.federation) errs.push("Licence fédération: fédération requise.");
      if (!payload.licence) errs.push("Licence fédération: numéro requis.");
      return errs;
    },
  },

  certificat_medical: {
    label: "Certificat médical",
    requires: ["filePath"],
    normalize: (p = {}) => ({
      filePath: String(p.filePath || "").trim(),
      fileName: p.fileName ? String(p.fileName) : undefined,
      mimeType: p.mimeType ? String(p.mimeType) : undefined,
      issuedAt: p.issuedAt ? String(p.issuedAt) : undefined,
      notes: p.notes ? String(p.notes) : undefined,
    }),
    validate: (payload) => {
      const errs = [];
      if (!payload.filePath) errs.push("Certificat médical: fichier requis.");
      return errs;
    },
  },

  autorisation_parentale: {
    label: "Autorisation parentale",
    requires: ["filePath"],
    normalize: (p = {}) => ({
      filePath: String(p.filePath || "").trim(),
      signedAt: p.signedAt ? String(p.signedAt) : undefined,
      responsable: p.responsable ? String(p.responsable) : undefined,
    }),
    validate: (payload) => {
      const errs = [];
      if (!payload.filePath) errs.push("Autorisation parentale: fichier requis.");
      return errs;
    },
  },

  piece_identite: {
    label: "Pièce d’identité",
    requires: ["filePath"],
    normalize: (p = {}) => ({
      filePath: String(p.filePath || "").trim(),
      docType: p.docType ? String(p.docType) : undefined,
      country: p.country ? String(p.country) : undefined,
    }),
    validate: (payload) => {
      const errs = [];
      if (!payload.filePath) errs.push("Pièce d’identité: fichier requis.");
      return errs;
    },
  },
};

export function normalizeJustificatif(value) {
  const type = (value?.type || "none").toLowerCase();
  const def = JUSTIFICATIF_TYPES[type] || JUSTIFICATIF_TYPES.none;
  const payload = def.normalize ? def.normalize(value?.payload || {}) : (value?.payload || {});
  return { type, payload };
}

export function validateJustificatif(value, { required = true } = {}) {
  const v = normalizeJustificatif(value);
  if (!required && v.type === "none") return { ok: true, errors: [], value: v };

  if (required && (v.type === "none" || !v.type)) {
    return { ok: false, errors: ["Justificatif requis."], value: v };
  }

  const def = JUSTIFICATIF_TYPES[v.type];
  if (!def) return { ok: false, errors: ["Type justificatif inconnu."], value: v };

  const errs = def.validate ? def.validate(v.payload) : [];
  return { ok: errs.length === 0, errors: errs, value: v };
}

// src/components/JustificatifRulesEngine.jsx
import { useMemo } from "react";

/**
 * Types supportés (doivent matcher JustificatifTypes.js)
 */
export const TYPE_PPS = "PPS";
export const TYPE_LICENCE_FFA = "LICENCE_FFA";
export const TYPE_LICENCE_AUTRE = "LICENCE_AUTRE";
export const TYPE_CERTIF_MEDICAL = "CERTIF_MEDICAL";
export const TYPE_AUTRE_DOC = "AUTRE_DOC";

/**
 * Helpers
 */
const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));
const isBlank = (s) => !s || !String(s).trim();
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

/**
 * computeJustificatifRules(ctx)
 *
 * ctx:
 * - country?: "FR" | "..."
 * - sportCode?: "trail" | "running" | "vtt" | "cycling" | "triathlon" | ...
 * - age?: number | null
 * - federationCode?: string (ex: "FFA", "FFC", "FFTRI", "UFOLEP", ...)
 * - policy?: {
 *     // override dur : si fourni, c'est la source de vérité
 *     accepted_types?: string[],
 *
 *     // toggles
 *     enable_upload?: boolean,       // autorise CERTIF_MEDICAL / AUTRE_DOC
 *     allow_certif_medical?: boolean,// autorise CERTIF_MEDICAL
 *     allow_other_doc?: boolean,     // autorise AUTRE_DOC
 *
 *     // exigences
 *     require_expiry_for_pps?: boolean, // PPS doit avoir une date d'expiration
 *     require_justificatif?: boolean,   // si false -> allowedTypes peut être vide
 *
 *     // mineurs
 *     minor_requires_parental_doc?: boolean, // ajoute un requirement "AUTRE_DOC" recommandé
 *   }
 *
 * return:
 * {
 *   allowedTypes: string[],
 *   requiredFieldsByType: {
 *     [type]: string[] // fields à remplir dans value
 *   },
 *   recommendations?: { primaryType?: string, notes?: string[] },
 *   validate: (value) => { ok:boolean, errors:string[] }
 * }
 */
export function computeJustificatifRules(ctx = {}) {
  const {
    country = "FR",
    sportCode = "running",
    age = null,
    federationCode = "",
    policy = {},
  } = ctx;

  const p = {
    require_justificatif: policy.require_justificatif !== false,
    enable_upload: policy.enable_upload !== false, // true par défaut
    allow_certif_medical: !!policy.allow_certif_medical, // false par défaut (safe)
    allow_other_doc: policy.allow_other_doc !== false, // true par défaut
    require_expiry_for_pps: !!policy.require_expiry_for_pps,
    minor_requires_parental_doc: !!policy.minor_requires_parental_doc,
    accepted_types: Array.isArray(policy.accepted_types) ? policy.accepted_types : null,
  };

  // Si on ne requiert aucun justificatif
  if (!p.require_justificatif) {
    return {
      allowedTypes: [],
      requiredFieldsByType: {},
      recommendations: { notes: ["Justificatif non requis (policy)."] },
      validate: () => ({ ok: true, errors: [] }),
    };
  }

  // --- Base par sport / pays (par défaut: conservateur et configurable) ---
  // IMPORTANT : ici, on ne “fige” pas la loi. On donne une base logique, et
  // la policy permet d’override.
  let allowed = [];

  const sport = (sportCode || "").toLowerCase();
  const ctry = (country || "").toUpperCase();

  if (ctry === "FR") {
    if (sport === "running" || sport === "trail" || sport === "route") {
      // France (course à pied) : on privilégie PPS + licences
      allowed = [TYPE_PPS, TYPE_LICENCE_FFA, TYPE_LICENCE_AUTRE];
      // certif médical : OFF par défaut, activable via policy
      if (p.enable_upload && p.allow_certif_medical) allowed.push(TYPE_CERTIF_MEDICAL);
      if (p.enable_upload && p.allow_other_doc) allowed.push(TYPE_AUTRE_DOC);
    } else if (sport === "vtt" || sport === "cycling" || sport === "velo") {
      // VTT / vélo : on reste flexible (licence autre + uploads)
      allowed = [TYPE_LICENCE_AUTRE];
      if (p.enable_upload && p.allow_certif_medical) allowed.push(TYPE_CERTIF_MEDICAL);
      if (p.enable_upload && p.allow_other_doc) allowed.push(TYPE_AUTRE_DOC);
    } else if (sport === "triathlon" || sport === "tri") {
      allowed = [TYPE_LICENCE_AUTRE];
      if (p.enable_upload && p.allow_certif_medical) allowed.push(TYPE_CERTIF_MEDICAL);
      if (p.enable_upload && p.allow_other_doc) allowed.push(TYPE_AUTRE_DOC);
    } else {
      // sports “inconnus” : flexible
      allowed = [TYPE_LICENCE_AUTRE];
      if (p.enable_upload && p.allow_certif_medical) allowed.push(TYPE_CERTIF_MEDICAL);
      if (p.enable_upload && p.allow_other_doc) allowed.push(TYPE_AUTRE_DOC);
    }
  } else {
    // Hors FR : plus permissif (licence + uploads)
    allowed = [TYPE_LICENCE_AUTRE];
    if (p.enable_upload && p.allow_certif_medical) allowed.push(TYPE_CERTIF_MEDICAL);
    if (p.enable_upload && p.allow_other_doc) allowed.push(TYPE_AUTRE_DOC);
  }

  // Override dur si policy.accepted_types est fourni
  if (p.accepted_types && p.accepted_types.length > 0) {
    allowed = [...p.accepted_types];
  }

  allowed = uniq(allowed);

  // --- Required fields par type ---
  const requiredFieldsByType = {
    [TYPE_PPS]: ["pps_identifier"],
    [TYPE_LICENCE_FFA]: ["numero_licence"],
    [TYPE_LICENCE_AUTRE]: ["numero_licence", "federation_code"],
    [TYPE_CERTIF_MEDICAL]: ["justificatif_url"],
    [TYPE_AUTRE_DOC]: ["justificatif_url"],
  };

  if (p.require_expiry_for_pps) {
    requiredFieldsByType[TYPE_PPS] = uniq([
      ...(requiredFieldsByType[TYPE_PPS] || []),
      "pps_expiry_date",
    ]);
  }

  // --- Mineurs : ajout d’un requirement “recommandé” (pas bloquant par défaut)
  const minor = Number.isFinite(age) ? age < 18 : false;
  const notes = [];
  if (minor && p.minor_requires_parental_doc) {
    notes.push("Mineur : un document complémentaire (autorisation) peut être requis.");
    // On n’impose pas un type unique, mais on recommande AUTRE_DOC si disponible
    if (!allowed.includes(TYPE_AUTRE_DOC) && p.enable_upload && p.allow_other_doc) {
      allowed = uniq([...allowed, TYPE_AUTRE_DOC]);
    }
  }

  // --- Recommandation du type principal (UX) ---
  let primaryType = allowed[0] || null;

  // Heuristique : si FR running/trail -> PPS prioritaire
  if (ctry === "FR" && (sport === "running" || sport === "trail" || sport === "route")) {
    if (allowed.includes(TYPE_PPS)) primaryType = TYPE_PPS;
    else if (allowed.includes(TYPE_LICENCE_FFA)) primaryType = TYPE_LICENCE_FFA;
    else primaryType = allowed[0] || null;
  }

  // Si federation connue : recommande licence autre (préremplissage)
  const fed = (federationCode || "").toUpperCase();
  if (fed && allowed.includes(TYPE_LICENCE_AUTRE)) {
    // garde PPS prioritaire si running FR
    if (!(ctry === "FR" && (sport === "running" || sport === "trail" || sport === "route") && allowed.includes(TYPE_PPS))) {
      primaryType = TYPE_LICENCE_AUTRE;
    }
  }

  // --- Validation ---
  function validate(value = {}) {
    const errors = [];

    const type = value.justificatif_type || primaryType;
    if (!type) return { ok: true, errors: [] };

    if (!allowed.includes(type)) {
      errors.push("Type de justificatif non autorisé pour ce contexte.");
      return { ok: false, errors };
    }

    const req = requiredFieldsByType[type] || [];
    req.forEach((field) => {
      if (field === "pps_identifier" && isBlank(value.pps_identifier)) {
        errors.push("Code PPS requis.");
      }
      if (field === "pps_expiry_date" && isBlank(value.pps_expiry_date)) {
        errors.push("Date d’expiration PPS requise.");
      }
      if (field === "numero_licence" && isBlank(value.numero_licence)) {
        errors.push("Numéro de licence requis.");
      }
      if (field === "federation_code" && isBlank(value.federation_code)) {
        errors.push("Fédération requise.");
      }
      if (field === "justificatif_url" && isBlank(value.justificatif_url)) {
        errors.push("Document justificatif requis (upload).");
      }
    });

    return { ok: errors.length === 0, errors };
  }

  return {
    allowedTypes: allowed,
    requiredFieldsByType,
    recommendations: { primaryType, notes },
    validate,
  };
}

/**
 * Hook pratique
 */
export function useJustificatifRules(ctx) {
  return useMemo(() => computeJustificatifRules(ctx), [
    ctx?.country,
    ctx?.sportCode,
    ctx?.age,
    ctx?.federationCode,
    // policy deps (si tu changes la policy, recrée l'objet pour refresh)
    ctx?.policy,
  ]);
}

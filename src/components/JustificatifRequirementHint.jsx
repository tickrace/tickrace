// src/components/JustificatifRequirementHint.jsx
import React, { useMemo } from "react";
import {
  JUSTIFICATIF_LABELS,
  JUSTIFICATIF_TYPES,
  getJustificatifRequirementProfile,
  validateJustificatif,
} from "../lib/justificatifs";

function Badge({ tone = "neutral", children }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-800 ring-amber-200"
      : tone === "error"
      ? "bg-red-50 text-red-700 ring-red-200"
      : "bg-neutral-50 text-neutral-700 ring-neutral-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1 ${cls}`}>
      {children}
    </span>
  );
}

export default function JustificatifRequirementHint({
  // contexte (optionnel)
  sportCode,
  federationCode,
  countryCode = "FR",

  // state actuel (ce que l'utilisateur a déjà renseigné)
  justificatifState,

  // override possible si tu veux forcer depuis un format/course plus tard
  requirementOverride, // { required, allowed, defaultType, label }

  // UI
  title = "Justificatif",
  compact = false,
  showAllowedList = true,
}) {
  const profile = useMemo(() => {
    const base = getJustificatifRequirementProfile({
      sport_code: sportCode,
      federation_code: federationCode,
      country_code: countryCode,
    });
    return { ...base, ...(requirementOverride || {}) };
  }, [sportCode, federationCode, countryCode, requirementOverride]);

  const status = useMemo(() => {
    const res = validateJustificatif(justificatifState, { required: profile.required });
    if (res.ok) return { tone: "ok", label: "Justificatif fourni" };
    if (!profile.required) return { tone: "neutral", label: "Optionnel" };
    return { tone: "warn", label: "Justificatif manquant" };
  }, [justificatifState, profile.required]);

  const typeLabel = useMemo(() => {
    const t = justificatifState?.justificatif_type || profile.defaultType || JUSTIFICATIF_TYPES.PPS;
    return JUSTIFICATIF_LABELS[t] || "Justificatif";
  }, [justificatifState, profile.defaultType]);

  const allowedLabels = useMemo(() => {
    const list = profile.allowed || [];
    return list.map((t) => JUSTIFICATIF_LABELS[t] || t);
  }, [profile.allowed]);

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        <span className="text-xs text-neutral-600">
          Type : <b className="text-neutral-900">{typeLabel}</b>
          {profile.required ? " • requis" : " • optionnel"}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="p-5 border-b border-neutral-100 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm text-neutral-600 mt-1">
            {profile.label || "Règles de justificatif"}
            {profile.required ? " (requis)" : " (optionnel)"}
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <div className="p-5 space-y-2">
        <div className="text-sm text-neutral-700">
          Type sélectionné : <b className="text-neutral-900">{typeLabel}</b>
        </div>

        {showAllowedList && Array.isArray(profile.allowed) && profile.allowed.length > 0 && (
          <div className="text-sm text-neutral-700">
            Types acceptés :{" "}
            <span className="text-neutral-900">
              {allowedLabels.join(" / ")}
            </span>
          </div>
        )}

        {profile.required && status.tone !== "ok" && (
          <div className="text-xs text-amber-700">
            ⚠️ Un justificatif valide est requis pour finaliser l’inscription.
          </div>
        )}
      </div>
    </div>
  );
}

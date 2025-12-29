// src/components/JustificatifTypeSelector.jsx
import React, { useEffect, useMemo } from "react";
import {
  JUSTIFICATIF_LABELS,
  JUSTIFICATIF_TYPES,
  getJustificatifRequirementProfile,
  mergeJustificatifState,
} from "../lib/justificatifs";

function OptionCard({ active, title, desc, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "w-full text-left rounded-2xl border p-4 transition shadow-sm",
        disabled
          ? "bg-neutral-50 border-neutral-200 text-neutral-400 cursor-not-allowed"
          : active
          ? "bg-black text-white border-black"
          : "bg-white border-neutral-200 hover:bg-neutral-50",
      ].join(" ")}
    >
      <div className="font-semibold">{title}</div>
      {desc ? (
        <div className={["mt-1 text-sm", active ? "text-white/80" : "text-neutral-600"].join(" ")}>
          {desc}
        </div>
      ) : null}
    </button>
  );
}

export default function JustificatifTypeSelector({
  // Contexte (sert à calculer les types autorisés)
  sportCode,
  federationCode,
  countryCode = "FR",

  // Etat courant
  value, // { justificatif_type, pps_identifier, numero_licence, justificatif_url, ... }

  // Callback
  onChange,

  // Overrides
  requirementOverride, // { allowed, defaultType, required, label }

  // UI
  title = "Type de justificatif",
  subtitle = "Choisis le type que tu vas fournir. Les champs seront adaptés automatiquement.",
  disabled = false,
  layout = "grid", // "grid" | "list"
}) {
  const profile = useMemo(() => {
    const base = getJustificatifRequirementProfile({
      sport_code: sportCode,
      federation_code: federationCode,
      country_code: countryCode,
    });
    return { ...base, ...(requirementOverride || {}) };
  }, [sportCode, federationCode, countryCode, requirementOverride]);

  const allowed = useMemo(() => profile.allowed || [], [profile.allowed]);

  // si aucun type autorisé renvoyé, on fallback sur PPS/FFA (safe)
  const safeAllowed = useMemo(() => {
    if (Array.isArray(allowed) && allowed.length > 0) return allowed;
    return [JUSTIFICATIF_TYPES.PPS, JUSTIFICATIF_TYPES.LICENCE_FFA];
  }, [allowed]);

  const currentType = value?.justificatif_type || profile.defaultType || safeAllowed[0];

  // S’assure que le type courant est autorisé (sinon on “snap” sur le default)
  useEffect(() => {
    if (!safeAllowed.includes(currentType)) {
      const nextType = profile.defaultType && safeAllowed.includes(profile.defaultType)
        ? profile.defaultType
        : safeAllowed[0];
      const next = mergeJustificatifState(value || {}, { justificatif_type: nextType });
      onChange?.(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeAllowed.join("|")]);

  const items = useMemo(() => {
    // Tu pourras enrichir plus tard (descriptions spécifiques)
    const desc = {
      [JUSTIFICATIF_TYPES.PPS]: "Code PPS (France) + date de validité. Recommandé si tu n’as pas de licence.",
      [JUSTIFICATIF_TYPES.LICENCE_FFA]: "Numéro de licence FFA. Si tu es licencié(e), c’est le plus simple.",
      [JUSTIFICATIF_TYPES.LICENCE_AUTRE]: "Licence autre fédération (selon règlement).",
      [JUSTIFICATIF_TYPES.CERTIFICAT_MEDICAL]: "Certificat médical (si accepté par le règlement).",
      [JUSTIFICATIF_TYPES.ASSURANCE]: "Attestation d’assurance (si demandée).",
      [JUSTIFICATIF_TYPES.AUTORISATION_PARENTALE]: "Autorisation parentale (mineur).",
      [JUSTIFICATIF_TYPES.PIECE_IDENTITE]: "Pièce d’identité (si demandée).",
      [JUSTIFICATIF_TYPES.AUTRE]: "Autre justificatif (document).",
    };

    return safeAllowed.map((t) => ({
      type: t,
      label: JUSTIFICATIF_LABELS[t] || t,
      desc: desc[t] || "",
    }));
  }, [safeAllowed]);

  function selectType(nextType) {
    if (disabled) return;
    const next = mergeJustificatifState(value || {}, { justificatif_type: nextType });
    onChange?.(next);
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="p-5 border-b border-neutral-100">
        <h3 className="text-base font-semibold">{title}</h3>
        {subtitle ? <p className="text-sm text-neutral-500 mt-1">{subtitle}</p> : null}
        {profile.label ? (
          <p className="mt-2 text-xs text-neutral-500">
            Règle : <span className="text-neutral-700">{profile.label}</span>
            {profile.required ? " • requis" : " • optionnel"}
          </p>
        ) : null}
      </div>

      <div className="p-5">
        <div
          className={[
            layout === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 gap-3"
              : "flex flex-col gap-3",
          ].join(" ")}
        >
          {items.map((it) => (
            <OptionCard
              key={it.type}
              active={currentType === it.type}
              title={it.label}
              desc={it.desc}
              disabled={disabled}
              onClick={() => selectType(it.type)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

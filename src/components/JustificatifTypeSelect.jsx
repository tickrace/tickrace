// src/components/JustificatifTypeSelect.jsx
import React, { useMemo } from "react";
import {
  JUSTIFICATIF_TYPES,
  JUSTIFICATIF_LABELS,
  JUSTIFICATIF_GROUPS,
} from "../lib/justificatifs";

/**
 * JustificatifTypeSelect
 * Select "propre" (groupé) pour choisir le type de justificatif.
 *
 * Props:
 * - value: string (justificatif_type)
 * - onChange: (nextType: string) => void
 * - allowed: string[] (optionnel) => restreindre les types affichés
 * - disabled: boolean
 * - required: boolean
 * - label, hint
 */
export default function JustificatifTypeSelect({
  value,
  onChange,
  allowed = null,
  disabled = false,
  required = false,
  label = "Type de justificatif",
  hint = "Choisis le type correspondant. Les champs s’adaptent automatiquement.",
}) {
  const allowedSet = useMemo(() => {
    if (!allowed || !Array.isArray(allowed) || allowed.length === 0) return null;
    return new Set(allowed);
  }, [allowed]);

  const groups = useMemo(() => {
    const g = JUSTIFICATIF_GROUPS || [];
    if (!allowedSet) return g;

    // Filtre des groupes + types
    return g
      .map((grp) => ({
        ...grp,
        items: (grp.items || []).filter((t) => allowedSet.has(t)),
      }))
      .filter((grp) => (grp.items || []).length > 0);
  }, [allowedSet]);

  const flat = useMemo(() => {
    // fallback si pas de groups
    const all = Object.values(JUSTIFICATIF_TYPES || {});
    const list = allowedSet ? all.filter((t) => allowedSet.has(t)) : all;
    return list
      .map((t) => ({ value: t, label: JUSTIFICATIF_LABELS[t] || t }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [allowedSet]);

  const hasGroups = Array.isArray(groups) && groups.length > 0;

  return (
    <div className="space-y-1">
      <label className="block">
        <span className="text-sm font-medium text-neutral-800">
          {label} {required ? <span className="text-red-600">*</span> : null}
        </span>

        <select
          className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black bg-white"
          value={value || ""}
          disabled={disabled}
          required={required}
          onChange={(e) => onChange?.(e.target.value)}
        >
          <option value="">{required ? "— Sélection obligatoire —" : "— Sélectionner —"}</option>

          {hasGroups
            ? groups.map((grp) => (
                <optgroup key={grp.key || grp.label} label={grp.label}>
                  {(grp.items || []).map((t) => (
                    <option key={t} value={t}>
                      {JUSTIFICATIF_LABELS[t] || t}
                    </option>
                  ))}
                </optgroup>
              ))
            : flat.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
        </select>
      </label>

      {hint ? <p className="text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}

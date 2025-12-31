import React, { useMemo } from "react";
import { JUSTIF_TYPES } from "../../lib/justificatifs";

const Field = ({ label, children, hint }) => (
  <div className="space-y-1">
    <div className="text-sm font-semibold text-neutral-800">{label}</div>
    {children}
    {hint ? <div className="text-xs text-neutral-500">{hint}</div> : null}
  </div>
);

const Select = (props) => (
  <select
    {...props}
    className={`w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200 ${props.className || ""}`}
  />
);

const Toggle = ({ checked, onChange, label, hint }) => (
  <label className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-1 h-4 w-4 accent-orange-600"
    />
    <div className="min-w-0">
      <div className="text-sm font-semibold text-neutral-900">{label}</div>
      {hint ? <div className="text-xs text-neutral-500 mt-0.5">{hint}</div> : null}
    </div>
  </label>
);

export default function JustificatifCourseSettings({ value, onChange }) {
  const v = value || {};

  const options = useMemo(() => JUSTIF_TYPES, []);

  const patch = (p) => onChange?.({ ...v, ...p });

  return (
    <div className="rounded-3xl bg-white shadow-sm ring-1 ring-neutral-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-extrabold text-neutral-900">Justificatif (niveau course)</div>
          <div className="text-sm text-neutral-600 mt-1">
            Configure ici ce que les coureurs devront fournir. (Plus de gestion par formats.)
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Toggle
          checked={v.justif_block_if_missing}
          onChange={(checked) => patch({ justif_block_if_missing: checked })}
          label="Bloquer l’inscription si justificatif manquant"
          hint="Si activé, le bouton de paiement/validation sera désactivé tant que le justificatif n’est pas renseigné."
        />

        <Toggle
          checked={v.parent_authorization_enabled}
          onChange={(checked) => patch({ parent_authorization_enabled: checked })}
          label="Activer l’autorisation parentale"
          hint="Affiche un champ dédié pour les mineurs (upload de l’autorisation)."
        />

        <Field
          label="1er type accepté"
          hint="Le coureur choisira un type parmi ceux que tu actives."
        >
          <Select
            value={v.justif_type_1 || ""}
            onChange={(e) => patch({ justif_type_1: e.target.value })}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="2e type accepté">
          <Select
            value={v.justif_type_2 || ""}
            onChange={(e) => patch({ justif_type_2: e.target.value })}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="3e type accepté">
          <Select
            value={v.justif_type_3 || ""}
            onChange={(e) => patch({ justif_type_3: e.target.value })}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-4 rounded-2xl bg-neutral-50 border border-neutral-200 p-4 text-sm text-neutral-700">
        Astuce : laisse “— Aucun —” si tu ne veux pas proposer 2e/3e option.
      </div>
    </div>
  );
}

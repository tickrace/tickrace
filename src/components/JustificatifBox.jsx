// src/components/JustificatifBox.jsx
import React, { useEffect, useMemo } from "react";
import {
  TYPE_PPS,
  TYPE_LICENCE_FFA,
  TYPE_LICENCE_AUTRE,
  TYPE_CERTIF_MEDICAL,
  TYPE_AUTRE_DOC,
} from "./JustificatifRulesEngine";

/**
 * JustificatifBox
 * Wrapper UI/UX : titres + sélection type + rendu champs (slots) + erreurs
 *
 * Props:
 * - value: {
 *    justificatif_type?: string,
 *    numero_licence?: string,
 *    pps_identifier?: string,
 *    pps_expiry_date?: string,
 *    federation_code?: string,
 *    justificatif_url?: string,
 *   }
 * - onChange: (nextValue) => void
 * - rules: result de computeJustificatifRules()
 *   { allowedTypes, recommendations, validate, requiredFieldsByType }
 * - title?: string
 * - subtitle?: string
 * - compact?: boolean (pour table équipes)
 * - disabled?: boolean
 *
 * Slots (facultatifs) : tu peux rendre tes composants existants dedans
 * - renderPps?: ({ value, onChange, disabled }) => ReactNode
 * - renderLicenceFfa?: (...)
 * - renderLicenceAutre?: (...)
 * - renderUpload?: ({ kind, value, onChange, disabled }) => ReactNode
 *
 * Si tu ne fournis pas de renderX, Box affiche des champs simples (inputs).
 */

const LABELS = {
  [TYPE_PPS]: "PPS",
  [TYPE_LICENCE_FFA]: "Licence FFA",
  [TYPE_LICENCE_AUTRE]: "Licence (autre fédé)",
  [TYPE_CERTIF_MEDICAL]: "Certificat médical",
  [TYPE_AUTRE_DOC]: "Autre document",
};

const DESCS = {
  [TYPE_PPS]: "Saisis ton code PPS (ou scanne-le).",
  [TYPE_LICENCE_FFA]: "Saisis ton numéro de licence FFA.",
  [TYPE_LICENCE_AUTRE]: "Choisis la fédération et saisis le numéro.",
  [TYPE_CERTIF_MEDICAL]: "Téléverse un certificat médical (si accepté).",
  [TYPE_AUTRE_DOC]: "Téléverse un document (si accepté).",
};

function Pill({ active, children, onClick, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border transition",
        active
          ? "bg-neutral-900 text-white border-neutral-900"
          : "bg-white text-neutral-800 border-neutral-200 hover:bg-neutral-50",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Input({ className = "", ...props }) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black",
        className,
      ].join(" ")}
    />
  );
}

function Select({ className = "", children, ...props }) {
  return (
    <select
      {...props}
      className={[
        "w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black",
        className,
      ].join(" ")}
    >
      {children}
    </select>
  );
}

export default function JustificatifBox({
  value,
  onChange,
  rules,
  title = "Justificatif",
  subtitle = "Sélectionne un type et complète les champs requis.",
  compact = false,
  disabled = false,

  renderPps,
  renderLicenceFfa,
  renderLicenceAutre,
  renderUpload,
}) {
  const allowed = rules?.allowedTypes || [];
  const primary = rules?.recommendations?.primaryType || allowed[0] || "";
  const currentType = value?.justificatif_type || primary;

  // auto-set type au premier rendu si vide
  useEffect(() => {
    if (!value) return;
    if (!value.justificatif_type && primary) {
      onChange?.({ ...value, justificatif_type: primary });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primary]);

  const validation = useMemo(() => {
    if (!rules?.validate) return { ok: true, errors: [] };
    return rules.validate({ ...value, justificatif_type: currentType });
  }, [rules, value, currentType]);

  if (!allowed || allowed.length === 0) {
    return null;
  }

  function setField(field, v) {
    onChange?.({ ...(value || {}), justificatif_type: currentType, [field]: v });
  }

  function setType(t) {
    // on garde les champs mais on peut vider ceux qui deviennent inutiles si tu veux plus tard
    onChange?.({ ...(value || {}), justificatif_type: t });
  }

  const notes = rules?.recommendations?.notes || [];
  const desc = DESCS[currentType] || "";

  return (
    <section
      className={[
        "rounded-2xl border border-neutral-200 bg-white shadow-sm",
        compact ? "" : "",
      ].join(" ")}
    >
      <div className="p-5 border-b border-neutral-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className={compact ? "text-base font-semibold" : "text-lg font-semibold"}>
              {title}
            </h2>
            {!compact && (
              <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Types autorisés */}
        <div className="mt-3 flex flex-wrap gap-2">
          {allowed.map((t) => (
            <Pill
              key={t}
              active={t === currentType}
              disabled={disabled}
              onClick={() => setType(t)}
            >
              {LABELS[t] || t}
            </Pill>
          ))}
        </div>

        {/* Notes / hint */}
        {(desc || notes.length > 0) && (
          <div className="mt-3 text-xs text-neutral-600 space-y-1">
            {desc && <div>{desc}</div>}
            {notes.map((n, i) => (
              <div key={i} className="text-neutral-500">
                • {n}
              </div>
            ))}
          </div>
        )}

        {/* Erreurs */}
        {!validation.ok && validation.errors?.length > 0 && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
            <div className="text-sm font-semibold text-red-800">À corriger</div>
            <ul className="mt-1 text-sm text-red-700 list-disc pl-5">
              {validation.errors.map((e, idx) => (
                <li key={idx}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="p-5">
        {/* Render slots si fournis, sinon fallback inputs */}
        {currentType === TYPE_PPS ? (
          renderPps ? (
            renderPps({
              value,
              disabled,
              onChange: (patch) => onChange?.({ ...(value || {}), ...patch, justificatif_type: TYPE_PPS }),
            })
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold text-neutral-600 mb-1">
                  Code PPS *
                </div>
                <Input
                  disabled={disabled}
                  value={value?.pps_identifier || ""}
                  onChange={(e) => setField("pps_identifier", e.target.value)}
                  placeholder="Ex: ABCD-1234-..."
                />
              </div>
              <div>
                <div className="text-xs font-semibold text-neutral-600 mb-1">
                  Date d’expiration (si demandé)
                </div>
                <Input
                  disabled={disabled}
                  type="date"
                  value={value?.pps_expiry_date || ""}
                  onChange={(e) => setField("pps_expiry_date", e.target.value)}
                />
              </div>
            </div>
          )
        ) : currentType === TYPE_LICENCE_FFA ? (
          renderLicenceFfa ? (
            renderLicenceFfa({
              value,
              disabled,
              onChange: (patch) =>
                onChange?.({ ...(value || {}), ...patch, justificatif_type: TYPE_LICENCE_FFA }),
            })
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <div className="text-xs font-semibold text-neutral-600 mb-1">
                  Numéro de licence FFA *
                </div>
                <Input
                  disabled={disabled}
                  value={value?.numero_licence || ""}
                  onChange={(e) => setField("numero_licence", e.target.value)}
                  placeholder="Ex: 1234567A"
                />
              </div>
            </div>
          )
        ) : currentType === TYPE_LICENCE_AUTRE ? (
          renderLicenceAutre ? (
            renderLicenceAutre({
              value,
              disabled,
              onChange: (patch) =>
                onChange?.({ ...(value || {}), ...patch, justificatif_type: TYPE_LICENCE_AUTRE }),
            })
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold text-neutral-600 mb-1">
                  Fédération *
                </div>
                <Select
                  disabled={disabled}
                  value={value?.federation_code || ""}
                  onChange={(e) => setField("federation_code", e.target.value)}
                >
                  <option value="">Sélectionner</option>
                  <option value="FFC">FFC</option>
                  <option value="FFTRI">FFTRI</option>
                  <option value="UFOLEP">UFOLEP</option>
                  <option value="FSGT">FSGT</option>
                  <option value="AUTRE">Autre</option>
                </Select>
              </div>
              <div>
                <div className="text-xs font-semibold text-neutral-600 mb-1">
                  Numéro de licence *
                </div>
                <Input
                  disabled={disabled}
                  value={value?.numero_licence || ""}
                  onChange={(e) => setField("numero_licence", e.target.value)}
                  placeholder="Numéro"
                />
              </div>
            </div>
          )
        ) : currentType === TYPE_CERTIF_MEDICAL || currentType === TYPE_AUTRE_DOC ? (
          renderUpload ? (
            renderUpload({
              kind: currentType,
              value,
              disabled,
              onChange: (patch) =>
                onChange?.({ ...(value || {}), ...patch, justificatif_type: currentType }),
            })
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold text-neutral-600 mb-1">
                  Lien du document (URL) *
                </div>
                <Input
                  disabled={disabled}
                  value={value?.justificatif_url || ""}
                  onChange={(e) => setField("justificatif_url", e.target.value)}
                  placeholder="https://..."
                />
                <div className="text-xs text-neutral-500 mt-1">
                  (Fallback : tu remplaceras par un vrai uploader Supabase dans JustificatifManager)
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="text-sm text-neutral-600">
            Type non géré : {currentType}
          </div>
        )}
      </div>
    </section>
  );
}

// src/components/justificatifs/JustificatifField.jsx
import React, { useMemo, useState } from "react";
import JustificatifStateAdapter from "./JustificatifStateAdapter";

// Adapte ces imports à TES fichiers (#3 wrapper + router)
import JustificatifBox from "./JustificatifBox";
import JustificatifRouter from "./JustificatifRouter";

function Badge({ children, tone = "neutral" }) {
  const map = {
    neutral: "bg-neutral-100 text-neutral-700 ring-neutral-200",
    ok: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    warn: "bg-amber-50 text-amber-800 ring-amber-200",
    danger: "bg-red-50 text-red-800 ring-red-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1 ${map[tone]}`}>
      {children}
    </span>
  );
}

function computeStatus(value) {
  const type = (value?.type || "").toLowerCase();
  const payload = value?.payload || {};
  if (!type) return { tone: "warn", label: "Non sélectionné" };

  if (type === "pps") {
    const ok = !!String(payload?.ppsCode || "").trim();
    return ok ? { tone: "ok", label: "PPS renseigné" } : { tone: "warn", label: "PPS manquant" };
  }
  if (type === "licence_ffa" || type === "ffa") {
    const ok = !!String(payload?.licence || "").trim();
    return ok ? { tone: "ok", label: "Licence renseignée" } : { tone: "warn", label: "Licence manquante" };
  }

  // Par défaut : “présence de payload”
  const hasAny = Object.values(payload || {}).some((v) => String(v || "").trim());
  return hasAny ? { tone: "ok", label: "Justificatif renseigné" } : { tone: "warn", label: "Justificatif incomplet" };
}

/**
 * Composant réutilisable :
 * - legacy: ton objet formulaire (ex: inscription)
 * - setLegacy: setState (ex: setInscription)
 *
 * Ce composant n’écrit pas en DB : il synchronise juste l’état du form.
 */
export default function JustificatifField({
  legacy,
  setLegacy,
  title = "Justificatif (FFA / PPS)",
  subtitle = "Choisis le type et renseigne les informations requises.",
  defaultType = "pps",
  allowedTypes, // optionnel: ["pps","licence_ffa",...]
  required = true,
  showDebug = false,
  // tu peux passer des mappers custom si tu as d’autres types
  mappers = {},
}) {
  const [debugOpen, setDebugOpen] = useState(false);

  return (
    <JustificatifStateAdapter
      legacy={legacy}
      setLegacy={setLegacy}
      defaultType={defaultType}
      typeKey="justificatif_type"
      payloadKey="justificatif_payload"
      clearOnTypeSwitch={true}
      writeJson={true}
      mappers={mappers}
    >
      {({ value, onChange }) => {
        const status = computeStatus(value);

        const filteredValue = useMemo(() => {
          if (!allowedTypes?.length) return value;
          const t = (value?.type || "").toLowerCase();
          if (allowedTypes.includes(t)) return value;
          return { type: allowedTypes[0], payload: {} };
        }, [value, allowedTypes]);

        return (
          <JustificatifBox
            title={title}
            subtitle={subtitle}
            required={required}
            rightSlot={<Badge tone={status.tone}>{status.label}</Badge>}
          >
            <div className="space-y-3">
              <JustificatifRouter
                value={filteredValue}
                onChange={onChange}
                allowedTypes={allowedTypes}
                required={required}
              />

              {(showDebug || debugOpen) && (
                <pre className="text-xs bg-neutral-50 border border-neutral-200 rounded-xl p-3 overflow-auto">
{JSON.stringify(
  { router: filteredValue, legacy: legacy },
  null,
  2
)}
                </pre>
              )}

              <button
                type="button"
                onClick={() => setDebugOpen((p) => !p)}
                className="text-xs text-neutral-600 hover:text-neutral-900 underline"
              >
                {debugOpen ? "Masquer le debug" : "Afficher le debug"}
              </button>
            </div>
          </JustificatifBox>
        );
      }}
    </JustificatifStateAdapter>
  );
}

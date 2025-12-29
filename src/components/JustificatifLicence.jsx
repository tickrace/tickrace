// src/components/JustificatifLicence.jsx
import React, { useMemo } from "react";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { normalizeJustificatif } from "./JustificatifTypes";
import {
  validateJustificatif,
  TYPE_LICENCE_FFA,
  TYPE_LICENCE_AUTRE,
} from "./JustificatifRulesEngine";

/**
 * UI Licence :
 * - FFA : un champ "numéro de licence"
 * - Autre fédération : code fédé + numéro
 *
 * Props:
 * - type: TYPE_LICENCE_FFA | TYPE_LICENCE_AUTRE
 */
export default function JustificatifLicence({
  value,
  onChange,
  type = TYPE_LICENCE_FFA,
  required = true,
  disabled = false,
  className = "",
}) {
  const v = normalizeJustificatif(value);

  const computed = useMemo(() => {
    return validateJustificatif(type, {
      justificatif_type: type,
      numero_licence: v.numero_licence,
      federation_code: v.federation_code,
    });
  }, [type, v.numero_licence, v.federation_code]);

  const status = computed?.status || "unknown";
  const message = computed?.message || "";

  const statusUi = (() => {
    if (status === "ok")
      return {
        icon: <ShieldCheck className="h-4 w-4" />,
        pill: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
        label: "Licence valide",
      };
    if (status === "missing")
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        pill: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
        label: required ? "Requis" : "Non renseigné",
      };
    if (status === "invalid")
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        pill: "bg-red-50 text-red-700 ring-1 ring-red-200",
        label: "Invalide",
      };
    if (status === "warn")
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        pill: "bg-orange-50 text-orange-800 ring-1 ring-orange-200",
        label: "À vérifier",
      };
    return {
      icon: <AlertCircle className="h-4 w-4" />,
      pill: "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200",
      label: "Licence",
    };
  })();

  const isOther = type === TYPE_LICENCE_AUTRE;

  return (
    <div className={["rounded-2xl border border-neutral-200 bg-white shadow-sm", className].join(" ")}>
      <div className="p-5 border-b border-neutral-100 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">
            {isOther ? "Licence (autre fédération)" : "Licence FFA"}
          </h3>
          <p className="text-sm text-neutral-500">
            {isOther
              ? "Renseigne le code fédération et le numéro de licence."
              : "Renseigne ton numéro de licence FFA."}
          </p>
        </div>
        <span className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", statusUi.pill].join(" ")}>
          {statusUi.icon}
          {statusUi.label}
        </span>
      </div>

      <div className="p-5 space-y-3">
        {isOther && (
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">
              Code fédération {required ? "*" : ""}
            </span>
            <input
              value={v.federation_code || ""}
              onChange={(e) =>
                onChange?.({
                  ...v,
                  justificatif_type: type,
                  federation_code: (e.target.value || "").toUpperCase(),
                })
              }
              disabled={disabled}
              placeholder="Ex : FFC, FFTri, UFOLEP..."
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black"
            />
          </label>
        )}

        <label className="block">
          <span className="text-xs font-semibold text-neutral-600">
            Numéro de licence {required ? "*" : ""}
          </span>
          <input
            value={v.numero_licence || ""}
            onChange={(e) =>
              onChange?.({
                ...v,
                justificatif_type: type,
                numero_licence: (e.target.value || "").trim(),
              })
            }
            disabled={disabled}
            placeholder="Ex : 1234567"
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black"
          />
        </label>

        {message && (
          <div
            className={[
              "rounded-xl px-3 py-2 text-sm",
              status === "ok"
                ? "bg-emerald-50 text-emerald-800"
                : status === "invalid"
                ? "bg-red-50 text-red-700"
                : status === "missing"
                ? "bg-amber-50 text-amber-800"
                : "bg-neutral-50 text-neutral-700",
            ].join(" ")}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

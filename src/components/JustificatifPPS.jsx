// src/components/JustificatifPPS.jsx
import React, { useEffect, useMemo, useState } from "react";
import { ShieldCheck, AlertCircle, ScanLine, Copy, Check } from "lucide-react";
import { normalizeJustificatif } from "./JustificatifTypes";
import { validateJustificatif, TYPE_PPS } from "./JustificatifRulesEngine";

/**
 * UI PPS (sans dépendre d'InscriptionCourse).
 * - Saisie du code PPS
 * - Affichage état (valide / invalide)
 * - Callback onChange(value)
 *
 * Note: le scan caméra / QR PPS sera branché plus tard (bouton stub).
 */
export default function JustificatifPPS({
  value,
  onChange,
  required = true,
  disabled = false,
  className = "",
  showScanHint = true,
}) {
  const v = normalizeJustificatif(value);
  const [copied, setCopied] = useState(false);

  const computed = useMemo(() => {
    const res = validateJustificatif(TYPE_PPS, {
      justificatif_type: TYPE_PPS,
      pps_identifier: v.pps_identifier,
      pps_expiry_date: v.pps_expiry_date,
    });
    return res;
  }, [v.pps_identifier, v.pps_expiry_date]);

  // Auto-nettoyage / formatage léger
  useEffect(() => {
    const raw = (v.pps_identifier || "").trim();
    if (!raw) return;
    // On upper + enlève espaces (sans imposer un format strict)
    const cleaned = raw.replace(/\s+/g, "").toUpperCase();
    if (cleaned !== raw) {
      onChange?.({ ...v, justificatif_type: TYPE_PPS, pps_identifier: cleaned });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = computed?.status || "unknown"; // "ok" | "missing" | "invalid" | "warn" | ...
  const message = computed?.message || "";

  const statusUi = (() => {
    if (status === "ok")
      return {
        icon: <ShieldCheck className="h-4 w-4" />,
        pill: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
        label: "PPS valide",
      };
    if (status === "missing")
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        pill: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
        label: required ? "PPS requis" : "PPS non renseigné",
      };
    if (status === "invalid")
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        pill: "bg-red-50 text-red-700 ring-1 ring-red-200",
        label: "PPS invalide",
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
      label: "PPS",
    };
  })();

  async function copyCode() {
    try {
      if (!v.pps_identifier) return;
      await navigator.clipboard.writeText(v.pps_identifier);
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {
      // ignore
    }
  }

  return (
    <div className={["rounded-2xl border border-neutral-200 bg-white shadow-sm", className].join(" ")}>
      <div className="p-5 border-b border-neutral-100 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">PPS</h3>
          <p className="text-sm text-neutral-500">
            Saisis le code PPS (ou scanne le QR code) pour valider ton justificatif.
          </p>
        </div>
        <span className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", statusUi.pill].join(" ")}>
          {statusUi.icon}
          {statusUi.label}
        </span>
      </div>

      <div className="p-5 space-y-3">
        <label className="block">
          <span className="text-xs font-semibold text-neutral-600">
            Code PPS {required ? "*" : ""}
          </span>
          <div className="mt-1 flex gap-2">
            <input
              value={v.pps_identifier || ""}
              onChange={(e) =>
                onChange?.({
                  ...v,
                  justificatif_type: TYPE_PPS,
                  pps_identifier: (e.target.value || "").replace(/\s+/g, "").toUpperCase(),
                })
              }
              disabled={disabled}
              placeholder="Ex : ABCD1234..."
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black"
            />
            <button
              type="button"
              onClick={copyCode}
              disabled={disabled || !v.pps_identifier}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
              title="Copier"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
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

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              // Stub : on branchera plus tard le scan caméra / QR
              alert("Scan PPS : à brancher (caméra / QR) dans la prochaine étape.");
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            <ScanLine className="h-4 w-4" />
            Scanner le QR PPS
          </button>

          {showScanHint && (
            <span className="text-xs text-neutral-500">
              Astuce : tu peux aussi coller directement le code.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

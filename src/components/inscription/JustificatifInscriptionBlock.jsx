// src/components/inscription/JustificatifInscriptionBlock.jsx
import React, { useMemo } from "react";

/**
 * Bloc d’UI pour la saisie justificatif côté inscription
 *
 * Props attendues :
 * - policy: { is_required, allow_medical_upload, allowed_types[], notes }
 * - allowedTypeLabels: [{code,label}] (optionnel)
 * - showFfaPps: bool (optionnel) => sinon auto via allowed_types
 * - value: { numero_licence, pps_identifier, justificatif_url }
 * - onChange: (patch) => void
 * - onUpload: (file) => Promise<void> | void
 * - uploading: bool
 * - title: string
 */
export default function JustificatifInscriptionBlock({
  policy,
  allowedTypeLabels = [],
  showFfaPps,
  value,
  onChange,
  onUpload,
  uploading = false,
  title = "Justificatifs",
}) {
  const p = policy || { is_required: false, allow_medical_upload: true, allowed_types: [], notes: "" };
  const v = value || {};

  const allowedCodes = useMemo(() => (Array.isArray(p.allowed_types) ? p.allowed_types : []), [p.allowed_types]);

  const inferredShowFfaPps = useMemo(() => {
    if (typeof showFfaPps === "boolean") return showFfaPps;
    if (!allowedCodes || allowedCodes.length === 0) return true;
    return allowedCodes.some((c) => /pps|ffa|licence/i.test(String(c)));
  }, [showFfaPps, allowedCodes]);

  const hasLicence = !!String(v.numero_licence || "").trim();
  const hasPps = !!String(v.pps_identifier || "").trim();
  const hasUpload = !!String(v.justificatif_url || "").trim();

  const ok = useMemo(() => {
    if (!p.is_required) return true;
    if (hasLicence || hasPps) return true;
    if (p.allow_medical_upload && hasUpload) return true;
    return false;
  }, [p.is_required, p.allow_medical_upload, hasLicence, hasPps, hasUpload]);

  const badge = ok ? (
    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">ok</span>
  ) : (
    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">à compléter</span>
  );

  const canUpload = !!p.allow_medical_upload;

  return (
    <div className="pt-4 border-t border-neutral-200">
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-neutral-900">{title}</div>
              {badge}
            </div>
            <div className="text-xs text-neutral-600">
              {p.is_required ? "Obligatoire" : "Optionnel"}
              {canUpload ? " · Upload autorisé" : " · Upload désactivé"}
            </div>
          </div>

          {allowedTypeLabels.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1">
              {allowedTypeLabels.slice(0, 6).map((t) => (
                <span key={t.code} className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-neutral-200">
                  {t.label}
                </span>
              ))}
              {allowedTypeLabels.length > 6 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-neutral-200">
                  +{allowedTypeLabels.length - 6}
                </span>
              )}
            </div>
          )}
        </div>

        {p.notes ? <div className="mt-2 text-xs text-neutral-700 whitespace-pre-wrap">{p.notes}</div> : null}

        {/* PPS / Licence */}
        {inferredShowFfaPps && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-700">N° licence (ex: FFA)</label>
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                value={v.numero_licence || ""}
                onChange={(e) => onChange?.({ numero_licence: e.target.value })}
                placeholder="Ex: 1234567A"
              />
              <div className="mt-1 text-[11px] text-neutral-500">Optionnel si PPS ou upload.</div>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700">Code PPS</label>
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                value={v.pps_identifier || ""}
                onChange={(e) => onChange?.({ pps_identifier: e.target.value })}
                placeholder="Ex: ABCD-1234-EFGH"
              />
              <div className="mt-1 text-[11px] text-neutral-500">Optionnel si licence ou upload.</div>
            </div>
          </div>
        )}

        {/* Upload */}
        {canUpload && (
          <div className="mt-4">
            <div className="text-sm font-medium text-neutral-800">Importer un justificatif (photo/PDF)</div>

            <div className="mt-2 flex items-center gap-3">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => onUpload?.(e.target.files?.[0])}
                className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-xl file:border file:border-neutral-200 file:bg-white file:px-3 file:py-2 hover:file:bg-neutral-50"
                disabled={uploading}
              />
              {v.justificatif_url ? (
                <button
                  type="button"
                  onClick={() => onChange?.({ justificatif_url: "" })}
                  className="shrink-0 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-neutral-50"
                >
                  Retirer
                </button>
              ) : null}
            </div>

            {v.justificatif_url ? (
              <div className="mt-2 text-xs text-neutral-700 break-all">
                Fichier importé :{" "}
                <a className="underline" href={v.justificatif_url} target="_blank" rel="noreferrer">
                  {v.justificatif_url}
                </a>
              </div>
            ) : (
              <div className="mt-1 text-xs text-neutral-500">Formats acceptés : image ou PDF.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

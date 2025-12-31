// src/components/inscription/JustificatifInscriptionBlock.jsx
import React, { useMemo } from "react";

/**
 * Props:
 * - policy: { is_required, allow_medical_upload, allowed_types, notes }
 * - types:  [{ code, label, input_mode, is_medical, ... }] (table justificatif_types)
 * - value:  objet inscription / membre (doit contenir: justificatif_type, numero_licence, pps_identifier, justificatif_url)
 * - onPatch: (patchObj) => void
 * - onUploadFile?: async (file) => void (si upload géré côté page)
 * - uploading?: boolean
 * - disableUpload?: boolean (ex: équipe)
 */
export default function JustificatifInscriptionBlock({
  policy,
  types,
  value,
  onPatch,
  onUploadFile,
  uploading = false,
  disableUpload = false,
  title = "Justificatif",
}) {
  const v = value || {};
  const pol = policy || { is_required: false, allow_medical_upload: true, allowed_types: [], notes: "" };

  const allowed = useMemo(() => {
    const codes = Array.isArray(pol.allowed_types) ? pol.allowed_types.filter(Boolean) : [];
    return codes.map(String);
  }, [pol.allowed_types]);

  const activeTypes = useMemo(() => {
    const rows = Array.isArray(types) ? types : [];
    const map = new Map(rows.map((t) => [String(t.code), t]));
    const list = allowed.length ? allowed.map((c) => map.get(c)).filter(Boolean) : rows;
    // fallback minimal si table vide
    return list.length
      ? list
      : [
          { code: "pps", label: "PPS" },
          { code: "ffa_licence", label: "Licence FFA" },
          { code: "medical_certificate", label: "Certificat médical" },
        ];
  }, [types, allowed]);

  const selectedType = String(v.justificatif_type || "").trim();

  const typeMeta = useMemo(() => {
    const map = new Map(activeTypes.map((t) => [String(t.code), t]));
    return map.get(selectedType) || null;
  }, [activeTypes, selectedType]);

  // heuristiques simples par code (robuste même si input_mode pas rempli)
  const isPps = /pps/i.test(selectedType);
  const isLicence = /licen|ffa/i.test(selectedType);
  const isMedical = !!typeMeta?.is_medical || /medical|certif/i.test(selectedType);

  const canUpload = !!pol.allow_medical_upload && !disableUpload;

  const showTypeSelect = allowed.length > 0; // si allowed_types est configuré, on force un type

  const typeLabel = (code) => {
    const t = activeTypes.find((x) => String(x.code) === String(code));
    return t?.label || code;
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-neutral-900">{title}</div>
          <div className="text-xs text-neutral-600">
            {pol.is_required ? "Obligatoire" : "Optionnel"}
            {pol.allow_medical_upload ? " · Upload autorisé" : " · Upload désactivé"}
          </div>
        </div>

        {allowed.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1">
            {allowed.slice(0, 6).map((c) => (
              <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-neutral-200">
                {typeLabel(c)}
              </span>
            ))}
            {allowed.length > 6 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-neutral-200">
                +{allowed.length - 6}
              </span>
            )}
          </div>
        )}
      </div>

      {pol.notes ? <div className="mt-2 text-xs text-neutral-700 whitespace-pre-wrap">{pol.notes}</div> : null}

      {/* Type (si policy configurée) */}
      {showTypeSelect && (
        <div className="mt-3">
          <label className="text-xs font-semibold text-neutral-700">Type</label>
          <select
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
            value={selectedType}
            onChange={(e) => {
              const next = e.target.value || "";
              // reset champs non pertinents à changement de type
              onPatch?.({
                justificatif_type: next,
                ...( /pps/i.test(next) ? {} : { pps_identifier: "" } ),
                ...( /licen|ffa/i.test(next) ? {} : { numero_licence: "" } ),
              });
            }}
          >
            <option value="">{pol.is_required ? "— Sélectionner —" : "— Aucun —"}</option>
            {activeTypes.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label || t.code}
              </option>
            ))}
          </select>

          {pol.is_required && !selectedType && (
            <div className="mt-1 text-xs text-red-600">Sélectionne un type de justificatif.</div>
          )}
        </div>
      )}

      {/* PPS / Licence : affichage si (type sélectionné) OU (pas de select => fallback) */}
      {(!showTypeSelect || (showTypeSelect && selectedType && isPps)) && (
        <div className="mt-3">
          <label className="text-xs font-semibold text-neutral-700">Code PPS</label>
          <input
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
            placeholder="PPS (ex: ABCD-1234…)"
            value={v.pps_identifier || ""}
            onChange={(e) => onPatch?.({ pps_identifier: e.target.value })}
          />
        </div>
      )}

      {(!showTypeSelect || (showTypeSelect && selectedType && isLicence)) && (
        <div className="mt-3">
          <label className="text-xs font-semibold text-neutral-700">Numéro de licence</label>
          <input
            className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
            placeholder="Licence"
            value={v.numero_licence || ""}
            onChange={(e) => onPatch?.({ numero_licence: e.target.value })}
          />
        </div>
      )}

      {/* Upload */}
      {canUpload && (!showTypeSelect || (selectedType && (isMedical || !isPps || !isLicence))) && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-neutral-700">Importer un justificatif (photo/PDF)</div>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => onUploadFile?.(e.target.files?.[0])}
              className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-xl file:border file:border-neutral-200 file:bg-white file:px-3 file:py-2 hover:file:bg-neutral-50"
              disabled={uploading}
            />
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

      {/* Hint si upload désactivé */}
      {disableUpload && pol.allow_medical_upload && (
        <div className="mt-2 text-xs text-neutral-500">(Upload désactivé pour les équipes dans cette V1.)</div>
      )}
    </div>
  );
}

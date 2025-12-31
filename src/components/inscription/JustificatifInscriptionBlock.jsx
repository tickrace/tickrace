// src/components/inscription/JustificatifInscriptionBlock.jsx
import React, { useMemo } from "react";

function labelFor(types, code) {
  const c = String(code || "").trim();
  if (!c) return "";
  const hit = (types || []).find((t) => String(t.code || "").trim() === c);
  return hit?.label || c;
}

export default function JustificatifInscriptionBlock({
  course,
  types = [],
  value,
  onPatch,
  onUploadFile,
  uploading = false,
  disableUpload = false,

  // Autorisation parentale (optionnel)
  showParentAuthorization = false,
  onUploadParentFile,
  parentUploading = false,
}) {
  const required = !!course?.justif_block_if_missing;

  const allowedTypes = useMemo(() => {
    const arr = [course?.justif_type_1, course?.justif_type_2, course?.justif_type_3]
      .map((x) => String(x || "").trim())
      .filter(Boolean);
    return Array.from(new Set(arr));
  }, [course?.justif_type_1, course?.justif_type_2, course?.justif_type_3]);

  const type = String(value?.justificatif_type || "").trim();

  const showLicence = type === "FFA_LICENCE";
  const showPps = type === "FFA_PPS";
  const showUpload = type === "MEDICAL_CERT" || type === "AUTRE_DOC";

  const licenceVal = String(value?.justificatif_licence_numero || value?.numero_licence || "").trim();
  const ppsVal = String(value?.pps_identifier || "").trim();
  const url = String(value?.justificatif_url || "").trim();

  const parentUrl = String(value?.autorisation_parentale_url || "").trim();

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-neutral-900">Justificatif</div>
          <div className="text-xs text-neutral-500">
            {required ? "Obligatoire" : "Optionnel"}
            {allowedTypes.length > 0 ? ` · Types autorisés : ${allowedTypes.map((c) => labelFor(types, c)).join(", ")}` : ""}
          </div>
        </div>

        {required && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 whitespace-nowrap">requis</span>
        )}
      </div>

      {/* Type */}
      <div>
        <label className="text-sm font-medium">Type de justificatif{required ? " *" : ""}</label>
        <select
          className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
          value={type}
          onChange={(e) => onPatch?.({ justificatif_type: e.target.value })}
        >
          <option value="">-- Choisir --</option>
          {(allowedTypes.length > 0 ? allowedTypes : (types || []).map((t) => t.code)).map((code) => (
            <option key={code} value={code}>
              {labelFor(types, code)}
            </option>
          ))}
        </select>
      </div>

      {/* Licence */}
      {showLicence && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">N° licence</label>
            <input
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
              value={licenceVal}
              onChange={(e) =>
                onPatch?.({
                  justificatif_licence_numero: e.target.value,
                  // compat legacy si tu utilises encore numero_licence ailleurs
                  numero_licence: e.target.value,
                })
              }
              placeholder="Ex : 1234567A"
            />
            <p className="mt-1 text-xs text-neutral-500">Saisis le numéro de licence (pas de fichier à importer).</p>
          </div>
        </div>
      )}

      {/* PPS */}
      {showPps && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Identifiant PPS</label>
            <input
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
              value={ppsVal}
              onChange={(e) => onPatch?.({ pps_identifier: e.target.value })}
              placeholder="Ex : PPS-XXXX-XXXX"
            />
            <p className="mt-1 text-xs text-neutral-500">Saisis l’identifiant PPS (pas de fichier à importer).</p>
          </div>
        </div>
      )}

      {/* Upload (certificat médical / autre doc) */}
      {showUpload && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <div className="text-sm font-medium">
            {type === "MEDICAL_CERT" ? "Certificat médical" : "Autre justificatif"} (photo/PDF)
          </div>

          {url ? (
            <div className="mt-2 text-sm">
              <a className="text-blue-700 underline" href={url} target="_blank" rel="noreferrer">
                Voir le fichier importé
              </a>
              <button
                type="button"
                className="ml-3 text-xs text-neutral-600 underline"
                onClick={() => onPatch?.({ justificatif_url: "", justificatif_path: "" })}
              >
                Retirer
              </button>
            </div>
          ) : (
            <div className="mt-2">
              <input
                type="file"
                accept="image/*,application/pdf"
                disabled={disableUpload || uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadFile?.(f);
                  e.target.value = "";
                }}
              />
              <div className="mt-1 text-xs text-neutral-500">
                {disableUpload ? "Upload désactivé." : uploading ? "Upload en cours…" : "Importe une photo ou un PDF."}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Autorisation parentale */}
      {showParentAuthorization && (
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <div className="font-semibold text-neutral-900">Autorisation parentale</div>
          <div className="text-xs text-neutral-500">Requise pour les mineurs sur cette course.</div>

          {parentUrl ? (
            <div className="mt-2 text-sm">
              <a className="text-blue-700 underline" href={parentUrl} target="_blank" rel="noreferrer">
                Voir le fichier importé
              </a>
              <button
                type="button"
                className="ml-3 text-xs text-neutral-600 underline"
                onClick={() => onPatch?.({ autorisation_parentale_url: "", autorisation_parentale_path: "" })}
              >
                Retirer
              </button>
            </div>
          ) : (
            <div className="mt-2">
              <input
                type="file"
                accept="image/*,application/pdf"
                disabled={disableUpload || parentUploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadParentFile?.(f);
                  e.target.value = "";
                }}
              />
              <div className="mt-1 text-xs text-neutral-500">{parentUploading ? "Upload en cours…" : "Importe une photo ou un PDF."}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

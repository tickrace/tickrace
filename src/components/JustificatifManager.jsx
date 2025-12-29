// src/components/JustificatifManager.jsx
import React, { useMemo } from "react";
import JustificatifTypeSelector from "./JustificatifTypeSelector";
import JustificatifUploader from "./JustificatifUploader";
import JustificatifLicenceAutre from "./JustificatifLicenceAutre";
import { JUSTIF_TYPES } from "./JustificatifTypes";

/**
 * Value normalisée (à stocker dans inscriptions / profils / membres équipe):
 * {
 *   justificatif_type: "PPS" | "LICENCE_FFA" | "LICENCE_AUTRE" | "CERTIF_MEDICAL" | "AUTRE_DOC",
 *   numero_licence: string,
 *   pps_identifier: string,
 *   pps_expiry_date?: string (YYYY-MM-DD) optionnel,
 *   justificatif_url: string,
 *   federation_code?: string
 * }
 *
 * Props:
 * - value: object (voir ci-dessus)
 * - onChange: (nextValue) => void
 * - allowedTypes?: array of codes (si tu veux restreindre selon sport/format/policy)
 * - bucket?: string (default ppsjustificatifs)
 * - title?: string
 */
export default function JustificatifManager({
  value,
  onChange,
  allowedTypes,
  bucket = "ppsjustificatifs",
  title = "Justificatif",
}) {
  const v = value || {};
  const types = useMemo(() => {
    const base = JUSTIF_TYPES;
    if (!allowedTypes || allowedTypes.length === 0) return base;
    return base.filter((t) => allowedTypes.includes(t.code));
  }, [allowedTypes]);

  const type = v.justificatif_type || (types[0]?.code || "PPS");

  function patch(next) {
    onChange?.({
      justificatif_type: type,
      numero_licence: v.numero_licence || "",
      pps_identifier: v.pps_identifier || "",
      pps_expiry_date: v.pps_expiry_date || "",
      justificatif_url: v.justificatif_url || "",
      federation_code: v.federation_code || "",
      ...next,
    });
  }

  const currentHelp = types.find((t) => t.code === type)?.help || "";

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="p-5 border-b border-neutral-100">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-neutral-500">
          Choisis le type de justificatif et complète les informations.
        </p>

        <div className="mt-4">
          <div className="text-sm font-medium mb-2">Type de justificatif</div>
          <JustificatifTypeSelector
            value={type}
            onChange={(code) => {
              // reset "propre" quand on change de type
              onChange?.({
                justificatif_type: code,
                numero_licence: "",
                pps_identifier: "",
                pps_expiry_date: "",
                justificatif_url: "",
                federation_code: "",
              });
            }}
            types={types}
          />
          {currentHelp ? (
            <div className="mt-2 text-sm text-neutral-600">{currentHelp}</div>
          ) : null}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* PPS */}
        {type === "PPS" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Code PPS</label>
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                value={v.pps_identifier || ""}
                onChange={(e) => patch({ pps_identifier: e.target.value })}
                placeholder="Ex : PPS-XXXX-XXXX-XXXX"
              />
              <p className="mt-1 text-xs text-neutral-500">
                (Optionnel) tu peux garder une date d’expiration si tu l’as.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Date d’expiration (optionnel)</label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                value={v.pps_expiry_date || ""}
                onChange={(e) => patch({ pps_expiry_date: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* LICENCE FFA */}
        {type === "LICENCE_FFA" && (
          <div>
            <label className="text-sm font-medium">Numéro de licence FFA</label>
            <input
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
              value={v.numero_licence || ""}
              onChange={(e) => patch({ numero_licence: e.target.value })}
              placeholder="Ex : 1234567"
            />
          </div>
        )}

        {/* LICENCE AUTRE */}
        {type === "LICENCE_AUTRE" && (
          <JustificatifLicenceAutre
            federationCode={v.federation_code || "AUTRE"}
            licence={v.numero_licence || ""}
            onChange={({ federationCode, licence }) =>
              patch({ federation_code: federationCode, numero_licence: licence })
            }
          />
        )}

        {/* CERTIF MEDICAL */}
        {type === "CERTIF_MEDICAL" && (
          <JustificatifUploader
            bucket={bucket}
            value={v.justificatif_url || ""}
            onChange={(url) => patch({ justificatif_url: url })}
            label="Certificat médical (upload)"
            helper="Importe une photo nette ou un PDF."
            required={true}
          />
        )}

        {/* AUTRE DOC */}
        {type === "AUTRE_DOC" && (
          <JustificatifUploader
            bucket={bucket}
            value={v.justificatif_url || ""}
            onChange={(url) => patch({ justificatif_url: url })}
            label="Document justificatif (upload)"
            helper="Importe une photo ou un PDF."
            required={true}
          />
        )}
      </div>
    </section>
  );
}

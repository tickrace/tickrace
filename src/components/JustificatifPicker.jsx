// src/components/JustificatifPicker.jsx
import React, { useEffect, useMemo } from "react";
import JustificatifBox from "./JustificatifBox";
import JustificatifFfaPps from "./JustificatifFfaPps";
import JustificatifUpload from "./JustificatifUpload";

const TYPES = [
  {
    code: "pps",
    label: "PPS (Parcours Prévention Santé)",
    desc: "Saisis ton identifiant PPS (ex: après scan QR).",
  },
  {
    code: "licence_ffa",
    label: "Licence FFA",
    desc: "Saisis ton numéro de licence FFA.",
  },
  {
    code: "certificat_medical",
    label: "Certificat médical",
    desc: "Importe une image ou un PDF du certificat.",
  },
  {
    code: "autre",
    label: "Autre justificatif",
    desc: "Importe un document (image/PDF).",
  },
];

/**
 * JustificatifPicker
 *
 * Props:
 * - justificatif_type: string
 * - numero_licence: string
 * - pps_identifier: string
 * - justificatif_url: string | null
 * - onChange: (patch) => void  // patch = { justificatif_type?, numero_licence?, pps_identifier?, justificatif_url? }
 * - required?: boolean
 * - bucket?: string (default: "ppsjustificatifs") // bucket storage pour l’upload
 * - context?: { courseId?, formatId?, inscriptionId?, userId? } // pour ranger les fichiers
 */
export default function JustificatifPicker({
  justificatif_type,
  numero_licence,
  pps_identifier,
  justificatif_url,
  onChange,
  required = false,
  bucket = "ppsjustificatifs",
  context = {},
}) {
  const selected = useMemo(() => {
    const found = TYPES.find((t) => t.code === justificatif_type);
    return found || TYPES[0];
  }, [justificatif_type]);

  // Si aucun type n'est défini, on initialise à PPS (choix par défaut)
  useEffect(() => {
    if (!justificatif_type) {
      onChange?.({ justificatif_type: "pps" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = useMemo(() => {
    const t = justificatif_type || "pps";
    if (t === "pps") return !!(pps_identifier && String(pps_identifier).trim());
    if (t === "licence_ffa") return !!(numero_licence && String(numero_licence).trim());
    if (t === "certificat_medical" || t === "autre") return !!(justificatif_url && String(justificatif_url).trim());
    return false;
  }, [justificatif_type, numero_licence, pps_identifier, justificatif_url]);

  function setType(nextType) {
    // On change de type et on nettoie ce qui n'est pas pertinent pour éviter les mélanges
    if (nextType === "pps") {
      onChange?.({
        justificatif_type: "pps",
        numero_licence: "",
        justificatif_url: null,
      });
      return;
    }
    if (nextType === "licence_ffa") {
      onChange?.({
        justificatif_type: "licence_ffa",
        pps_identifier: "",
        justificatif_url: null,
      });
      return;
    }
    if (nextType === "certificat_medical") {
      onChange?.({
        justificatif_type: "certificat_medical",
        numero_licence: "",
        pps_identifier: "",
      });
      return;
    }
    if (nextType === "autre") {
      onChange?.({
        justificatif_type: "autre",
        numero_licence: "",
        pps_identifier: "",
      });
      return;
    }
    onChange?.({ justificatif_type: nextType });
  }

  return (
    <JustificatifBox
      title={
        <>
          Justificatif {required ? <span className="text-red-600">*</span> : null}
        </>
      }
      subtitle="Choisis ton type de justificatif puis renseigne les informations demandées."
      status={status ? "ok" : required ? "warn" : "idle"}
      statusLabel={status ? "fourni" : required ? "requis" : "optionnel"}
    >
      {/* Choix type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TYPES.map((t) => {
          const active = (justificatif_type || "pps") === t.code;
          return (
            <button
              key={t.code}
              type="button"
              onClick={() => setType(t.code)}
              className={[
                "text-left rounded-2xl border p-4 transition",
                active
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white hover:bg-neutral-50",
              ].join(" ")}
            >
              <div className="font-semibold">{t.label}</div>
              <div className={active ? "text-sm text-white/80 mt-1" : "text-sm text-neutral-600 mt-1"}>
                {t.desc}
              </div>
            </button>
          );
        })}
      </div>

      <div className="h-px bg-neutral-200 my-5" />

      {/* Contenu dynamique */}
      {selected.code === "pps" || selected.code === "licence_ffa" ? (
        <div className="space-y-3">
          <div className="text-sm text-neutral-700">
            {selected.code === "pps"
              ? "Saisie PPS : tu peux scanner ton QR code sur la page dédiée, puis coller ici l’identifiant."
              : "Saisie Licence FFA : renseigne ton numéro de licence."}
          </div>

          {/* On réutilise ton composant existant pour contrôler le format */}
          <JustificatifFfaPps
            key={selected.code}
            licenceFfa={numero_licence || ""}
            ppsCode={pps_identifier || ""}
            onChange={({ licenceFfa, ppsCode }) => {
              if (selected.code === "pps") {
                onChange?.({
                  pps_identifier: ppsCode,
                  // on évite la double info
                  numero_licence: "",
                  justificatif_url: null,
                });
              } else {
                onChange?.({
                  numero_licence: licenceFfa,
                  pps_identifier: "",
                  justificatif_url: null,
                });
              }
            }}
          />

          {!status && required && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Ce justificatif est requis : {selected.code === "pps" ? "PPS" : "Licence FFA"} manquant.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <JustificatifUpload
            value={justificatif_url || null}
            onChange={(url) => onChange?.({ justificatif_url: url })}
            bucket={bucket}
            label={selected.code === "certificat_medical" ? "Certificat médical" : "Justificatif (autre)"}
            help="Importe une image (JPG/PNG) ou un PDF. Clique sur l’aperçu pour ouvrir."
            required={required}
            accept="image/*,application/pdf"
            pathPrefix="justificatifs"
            courseId={context.courseId}
            formatId={context.formatId}
            inscriptionId={context.inscriptionId}
            userId={context.userId}
            maxMB={8}
          />

          {!status && required && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Ce justificatif est requis : document manquant.
            </div>
          )}
        </div>
      )}

      {/* Debug/infos */}
      <div className="mt-4 text-[11px] text-neutral-500">
        Type sélectionné : <span className="font-mono">{justificatif_type || "pps"}</span>
      </div>
    </JustificatifBox>
  );
}

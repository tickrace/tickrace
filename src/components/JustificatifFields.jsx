// src/components/JustificatifFields.jsx
import React, { useMemo, useState } from "react";
import { supabase } from "../supabase";
import JustificatifFfaPps from "./JustificatifFfaPps";
import {
  JUSTIFICATIF_TYPES,
  JUSTIFICATIF_LABELS,
} from "../lib/justificatifs";

/**
 * JustificatifFields
 * Affiche les champs adaptés AU TYPE de justificatif sélectionné.
 *
 * Props:
 * - value: { justificatif_type, numero_licence, pps_identifier, justificatif_url, ... }
 * - onChange(nextValue)
 * - context: { userId, courseId, inscriptionId } (optionnel, pour nommage fichier)
 * - upload: { enabled, bucket, folderPrefix, accept, maxMB, useSignedUrl, signedUrlSeconds }
 * - disabled
 */
export default function JustificatifFields({
  value,
  onChange,
  context = {},
  upload = {},
  disabled = false,

  title = "Justificatif",
  subtitle = "Les champs affichés dépendent du type sélectionné.",
}) {
  const justificatifType = value?.justificatif_type || "";

  const cfg = useMemo(() => {
    return {
      enabled: upload.enabled ?? true,
      bucket: upload.bucket || "ppsjustificatifs",
      folderPrefix: upload.folderPrefix || "justificatifs",
      accept: upload.accept || ".pdf,.png,.jpg,.jpeg",
      maxMB: Number.isFinite(Number(upload.maxMB)) ? Number(upload.maxMB) : 8,
      useSignedUrl: upload.useSignedUrl ?? true,
      signedUrlSeconds: Number.isFinite(Number(upload.signedUrlSeconds))
        ? Number(upload.signedUrlSeconds)
        : 60 * 60, // 1h
    };
  }, [upload]);

  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const [fileErr, setFileErr] = useState("");

  const showFfaPps =
    justificatifType === JUSTIFICATIF_TYPES.PPS ||
    justificatifType === JUSTIFICATIF_TYPES.LICENCE_FFA;

  const showLicenceAutre = justificatifType === JUSTIFICATIF_TYPES.LICENCE_AUTRE;

  const requiresUpload = useMemo(() => {
    if (!justificatifType) return false;
    // Pour l’instant: tous sauf PPS/FFA passent par upload
    return !showFfaPps;
  }, [justificatifType, showFfaPps]);

  async function refreshUrlFromPath(path) {
    if (!path) {
      setFileUrl("");
      return;
    }

    // Tentative public URL (si bucket public)
    try {
      const { data: pub } = supabase.storage.from(cfg.bucket).getPublicUrl(path);
      if (pub?.publicUrl) {
        setFileUrl(pub.publicUrl);
        if (!cfg.useSignedUrl) return;
        // si bucket privé, le publicUrl peut ne pas fonctionner. On tente un signedUrl.
      }
    } catch {
      // ignore
    }

    // Signed URL (si bucket privé)
    try {
      const { data, error } = await supabase.storage
        .from(cfg.bucket)
        .createSignedUrl(path, cfg.signedUrlSeconds);

      if (error) {
        setFileUrl("");
        return;
      }
      setFileUrl(data?.signedUrl || "");
    } catch {
      setFileUrl("");
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset input
    setFileErr("");
    if (!file) return;

    const maxBytes = cfg.maxMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setFileErr(`Fichier trop volumineux (max ${cfg.maxMB} MB).`);
      return;
    }

    if (!cfg.enabled) return;

    setUploading(true);
    try {
      const userId = context.userId || value?.coureur_id || "anonymous";
      const courseId = context.courseId || value?.course_id || "course";
      const inscriptionId = context.inscriptionId || value?.id || "inscription";

      const safeName = (file.name || "justificatif")
        .toLowerCase()
        .replace(/[^\w.-]+/g, "-")
        .slice(0, 80);

      const ext = (safeName.split(".").pop() || "").slice(0, 10);
      const basename = safeName.replace(/\.[^.]+$/, "");

      const filename = `${basename || "justificatif"}-${Date.now()}${
        ext ? "." + ext : ""
      }`;

      const path = `${cfg.folderPrefix}/${courseId}/${inscriptionId}/${userId}/${filename}`;

      const { error } = await supabase.storage
        .from(cfg.bucket)
        .upload(path, file, {
          upsert: true,
          contentType: file.type || "application/octet-stream",
        });

      if (error) {
        console.error("❌ upload justificatif:", error);
        setFileErr("Erreur lors de l’upload du fichier.");
        return;
      }

      const next = { ...(value || {}) };

      // On stocke le PATH (plus robuste que l’URL) dans justificatif_url
      // (tu pourras renommer champ plus tard si besoin: justificatif_path)
      next.justificatif_url = path;

      // Bonus metadata (si tes colonnes existent, sinon ignoré côté insert)
      next.justificatif_filename = file.name;
      next.justificatif_mime = file.type;
      next.justificatif_size = file.size;

      onChange?.(next);
      await refreshUrlFromPath(path);
    } finally {
      setUploading(false);
    }
  }

  // Si le parent a déjà un path dans justificatif_url, on propose le lien
  const currentPath = value?.justificatif_url || "";
  const currentLabel = justificatifType
    ? JUSTIFICATIF_LABELS[justificatifType] || justificatifType
    : "—";

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="p-5 border-b border-neutral-100">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>
        <div className="mt-2 text-xs text-neutral-500">
          Type actuel : <span className="text-neutral-800 font-medium">{currentLabel}</span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* 1) PPS / Licence FFA (champs dédiés) */}
        {showFfaPps && (
          <div className="rounded-2xl border border-neutral-200 p-4">
            <JustificatifFfaPps
              licenceFfa={value?.numero_licence || ""}
              ppsCode={value?.pps_identifier || ""}
              onChange={({ licenceFfa, ppsCode }) => {
                const next = { ...(value || {}) };
                next.numero_licence = licenceFfa || "";
                next.pps_identifier = ppsCode || "";
                onChange?.(next);
              }}
            />

            {/* Upload optionnel du scan PPS (si tu veux le laisser possible même en PPS/FFA) */}
            {cfg.enabled && (
              <div className="mt-4">
                <div className="text-sm font-medium">Scan / document (optionnel)</div>
                <p className="text-xs text-neutral-500 mt-1">
                  Formats acceptés : {cfg.accept} • Max {cfg.maxMB} MB
                </p>
                <input
                  type="file"
                  accept={cfg.accept}
                  disabled={disabled || uploading}
                  onChange={handleFile}
                  className="mt-2 block w-full text-sm"
                />
                {uploading && (
                  <p className="mt-2 text-xs text-neutral-500">Upload en cours…</p>
                )}
                {fileErr && (
                  <p className="mt-2 text-xs text-red-600">{fileErr}</p>
                )}
                {currentPath && (
                  <div className="mt-2 text-xs text-neutral-600">
                    Fichier :{" "}
                    <span className="font-mono break-all">{currentPath}</span>
                    <div className="mt-1 flex gap-2">
                      <button
                        type="button"
                        className="rounded-lg border px-2 py-1"
                        onClick={() => refreshUrlFromPath(currentPath)}
                      >
                        Générer un lien
                      </button>
                      {fileUrl ? (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border px-2 py-1 hover:bg-neutral-50"
                        >
                          Ouvrir
                        </a>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2) Licence autre fédération (num + upload) */}
        {showLicenceAutre && (
          <div className="rounded-2xl border border-neutral-200 p-4 space-y-3">
            <div>
              <div className="text-sm font-medium">Numéro de licence</div>
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                placeholder="Numéro de licence"
                value={value?.numero_licence || ""}
                disabled={disabled}
                onChange={(e) => {
                  const next = { ...(value || {}) };
                  next.numero_licence = e.target.value;
                  onChange?.(next);
                }}
              />
              <p className="text-xs text-neutral-500 mt-1">
                À utiliser si le règlement accepte une licence non-FFA.
              </p>
            </div>

            {cfg.enabled && (
              <UploadBlock
                disabled={disabled}
                uploading={uploading}
                onFile={handleFile}
                accept={cfg.accept}
                maxMB={cfg.maxMB}
                fileErr={fileErr}
                currentPath={currentPath}
                fileUrl={fileUrl}
                onRefreshUrl={() => refreshUrlFromPath(currentPath)}
              />
            )}
          </div>
        )}

        {/* 3) Tous les autres types : upload (certificat, assurance, autorisation parentale, etc.) */}
        {!showFfaPps && !showLicenceAutre && requiresUpload && (
          <div className="rounded-2xl border border-neutral-200 p-4 space-y-3">
            <p className="text-sm text-neutral-700">
              Merci de joindre le document correspondant au type sélectionné.
            </p>

            {cfg.enabled ? (
              <UploadBlock
                disabled={disabled}
                uploading={uploading}
                onFile={handleFile}
                accept={cfg.accept}
                maxMB={cfg.maxMB}
                fileErr={fileErr}
                currentPath={currentPath}
                fileUrl={fileUrl}
                onRefreshUrl={() => refreshUrlFromPath(currentPath)}
              />
            ) : (
              <p className="text-sm text-neutral-500">Upload désactivé.</p>
            )}
          </div>
        )}

        {!justificatifType && (
          <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4 text-sm text-neutral-600">
            Sélectionne d’abord un type de justificatif pour afficher les champs.
          </div>
        )}
      </div>
    </section>
  );
}

function UploadBlock({
  disabled,
  uploading,
  onFile,
  accept,
  maxMB,
  fileErr,
  currentPath,
  fileUrl,
  onRefreshUrl,
}) {
  return (
    <div>
      <div className="text-sm font-medium">Document</div>
      <p className="text-xs text-neutral-500 mt-1">
        Formats acceptés : {accept} • Max {maxMB} MB
      </p>

      <input
        type="file"
        accept={accept}
        disabled={disabled || uploading}
        onChange={onFile}
        className="mt-2 block w-full text-sm"
      />

      {uploading && <p className="mt-2 text-xs text-neutral-500">Upload en cours…</p>}
      {fileErr && <p className="mt-2 text-xs text-red-600">{fileErr}</p>}

      {currentPath ? (
        <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-3">
          <div className="text-xs text-neutral-600">
            Stocké : <span className="font-mono break-all">{currentPath}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border px-2 py-1 text-sm hover:bg-neutral-50"
              onClick={onRefreshUrl}
            >
              Générer un lien
            </button>
            {fileUrl ? (
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border px-2 py-1 text-sm hover:bg-neutral-50"
              >
                Ouvrir
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

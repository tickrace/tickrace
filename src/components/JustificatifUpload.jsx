// src/components/JustificatifUpload.jsx
import React, { useMemo, useState } from "react";
import { supabase } from "../supabase";
import { v4 as uuidv4 } from "uuid";

/**
 * JustificatifUpload
 * - Upload image/PDF vers Supabase Storage
 * - Retourne une URL publique via onChange(url)
 *
 * Props:
 * - value: string | null (url publique)
 * - onChange: (nextUrl: string | null) => void
 * - bucket?: string (default: "ppsjustificatifs")
 * - label?: string
 * - help?: string
 * - required?: boolean
 * - accept?: string (default: "image/*,application/pdf")
 * - pathPrefix?: string (default: "justificatifs")
 * - courseId?, formatId?, inscriptionId?, userId?: string (optionnel, pour ranger les fichiers)
 * - maxMB?: number (default: 8)
 */
export default function JustificatifUpload({
  value,
  onChange,
  bucket = "ppsjustificatifs",
  label = "Importer un justificatif",
  help = "Formats acceptés : image (JPG/PNG) ou PDF.",
  required = false,
  accept = "image/*,application/pdf",
  pathPrefix = "justificatifs",
  courseId,
  formatId,
  inscriptionId,
  userId,
  maxMB = 8,
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  const isPdf = useMemo(() => {
    if (!value) return false;
    return value.toLowerCase().includes(".pdf");
  }, [value]);

  const prettyName = useMemo(() => {
    if (!value) return "";
    try {
      const u = new URL(value);
      const last = u.pathname.split("/").pop() || "";
      return decodeURIComponent(last);
    } catch {
      const last = String(value).split("/").pop() || "";
      return last;
    }
  }, [value]);

  function clampExt(file) {
    const name = (file?.name || "").toLowerCase();
    const ext = name.includes(".") ? name.split(".").pop() : "";
    if (ext && ext.length <= 6) return ext;

    // fallback: mime
    const mime = (file?.type || "").toLowerCase();
    if (mime.includes("pdf")) return "pdf";
    if (mime.includes("png")) return "png";
    if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
    if (mime.includes("webp")) return "webp";
    return "bin";
  }

  function buildPath(file) {
    const ext = clampExt(file);
    const parts = [
      pathPrefix,
      courseId ? `course_${courseId}` : null,
      formatId ? `format_${formatId}` : null,
      inscriptionId ? `inscription_${inscriptionId}` : null,
      userId ? `user_${userId}` : null,
    ].filter(Boolean);

    const fname = `justif-${Date.now()}-${uuidv4()}.${ext}`;
    return `${parts.join("/")}/${fname}`;
  }

  function publicUrlForPath(path) {
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  function tryExtractStoragePathFromPublicUrl(url) {
    // Format typique:
    // https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
    try {
      const u = new URL(url);
      const marker = `/storage/v1/object/public/${bucket}/`;
      const idx = u.pathname.indexOf(marker);
      if (idx === -1) return null;
      return decodeURIComponent(u.pathname.slice(idx + marker.length));
    } catch {
      return null;
    }
  }

  async function handlePickFile(e) {
    setErr("");
    const file = e.target.files?.[0];
    if (!file) return;

    // taille max
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxMB) {
      setErr(`Fichier trop volumineux (${sizeMB.toFixed(1)} MB). Max: ${maxMB} MB.`);
      e.target.value = "";
      return;
    }

    // type mime simple
    const mime = (file.type || "").toLowerCase();
    const ok =
      mime.startsWith("image/") ||
      mime === "application/pdf" ||
      // certains navigateurs peuvent mettre vide pour certains fichiers
      accept.includes("application/pdf") ||
      accept.includes("image/*");

    if (!ok) {
      setErr("Type de fichier non supporté.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const path = buildPath(file);

      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
        cacheControl: "3600",
      });

      if (upErr) throw upErr;

      const url = publicUrlForPath(path);
      onChange?.(url);
    } catch (e2) {
      console.error("❌ upload justificatif:", e2);
      setErr(e2?.message || "Erreur upload.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleReset() {
    setErr("");
    // On tente de supprimer le fichier côté storage, sans bloquer si ça échoue.
    try {
      if (value) {
        const path = tryExtractStoragePathFromPublicUrl(value);
        if (path) {
          await supabase.storage.from(bucket).remove([path]);
        }
      }
    } catch (e) {
      // non bloquant
      console.warn("⚠️ remove storage failed (non bloquant):", e);
    } finally {
      onChange?.(null);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="p-5 border-b border-neutral-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              {label} {required ? <span className="text-red-600">*</span> : null}
            </h2>
            {help ? <p className="text-sm text-neutral-500 mt-1">{help}</p> : null}
          </div>

          {value ? (
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-800">
              fourni
            </span>
          ) : (
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800">
              manquant
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-3">
        {/* Input */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <label className="inline-flex items-center gap-2">
            <input
              type="file"
              accept={accept}
              disabled={uploading}
              onChange={handlePickFile}
              className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-xl file:border file:border-neutral-200 file:bg-white file:px-3 file:py-2 hover:file:bg-neutral-50"
            />
          </label>

          {value ? (
            <button
              type="button"
              onClick={handleReset}
              disabled={uploading}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-70"
            >
              Supprimer / remplacer
            </button>
          ) : null}
        </div>

        {/* Erreur */}
        {err ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        {/* Preview */}
        {uploading ? (
          <div className="text-sm text-neutral-500">Upload en cours…</div>
        ) : value ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <div className="text-sm font-medium text-neutral-900">Fichier actuel</div>
            <div className="text-xs text-neutral-600 break-all mt-1">{prettyName}</div>

            <div className="mt-3">
              {isPdf ? (
                <a
                  href={value}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                >
                  Ouvrir le PDF
                </a>
              ) : (
                <a href={value} target="_blank" rel="noreferrer" className="block">
                  <img
                    src={value}
                    alt="Justificatif"
                    className="w-full max-w-md rounded-xl border border-neutral-200 bg-white"
                  />
                </a>
              )}
            </div>

            <div className="mt-2 text-[11px] text-neutral-500 break-all">
              URL : {value}
            </div>
          </div>
        ) : (
          <div className="text-sm text-neutral-600">
            Aucun fichier importé pour le moment.
          </div>
        )}

        <div className="text-[11px] text-neutral-500">
          Bucket: <span className="font-mono">{bucket}</span>
        </div>
      </div>
    </section>
  );
}

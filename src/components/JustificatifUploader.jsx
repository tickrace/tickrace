// src/components/JustificatifUploader.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { Upload, FileText, Trash2, ExternalLink, Loader2 } from "lucide-react";

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  const v = bytes / Math.pow(1024, i);
  return `${v.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

/**
 * JustificatifUploader
 * Props:
 * - bucket: string (default: "ppsjustificatifs")
 * - value: string (URL) (nullable)
 * - onChange: (url: string) => void
 * - label?: string
 * - helper?: string
 * - required?: boolean
 * - accept?: string (default: "image/*,application/pdf")
 * - maxMb?: number (default: 10)
 */
export default function JustificatifUploader({
  bucket = "ppsjustificatifs",
  value = "",
  onChange,
  label = "Importer un justificatif",
  helper = "Formats acceptés : image ou PDF.",
  required = false,
  accept = "image/*,application/pdf",
  maxMb = 10,
}) {
  const [uploading, setUploading] = useState(false);
  const [meta, setMeta] = useState(null); // { name, size, type }
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!value) setMeta(null);
  }, [value]);

  const maxBytes = useMemo(() => Math.floor(Number(maxMb) * 1024 * 1024), [maxMb]);

  async function uploadFile(file) {
    setErrorMsg("");
    if (!file) return;

    if (file.size > maxBytes) {
      setErrorMsg(`Fichier trop volumineux (${formatBytes(file.size)}). Max ${maxMb} MB.`);
      return;
    }

    setUploading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const user = sess?.session?.user;
      if (!user) {
        setErrorMsg("Veuillez vous connecter pour importer un justificatif.");
        setUploading(false);
        return;
      }

      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${Date.now()}_${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          upsert: false,
          contentType: file.type || undefined,
        });

      if (upErr) {
        console.error("❌ upload error:", upErr);
        setErrorMsg("Impossible d’uploader le fichier (bucket privé ? RLS ?).");
        setUploading(false);
        return;
      }

      // 1) Tentative URL publique
      const pub = supabase.storage.from(bucket).getPublicUrl(path);
      let url = pub?.data?.publicUrl || "";

      // 2) Fallback: signed URL (utile si bucket privé)
      if (!url) {
        const { data: signed, error: signErr } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 jours
        if (!signErr && signed?.signedUrl) url = signed.signedUrl;
      }

      if (!url) {
        setErrorMsg("Upload OK, mais impossible de générer une URL (bucket privé).");
        setUploading(false);
        return;
      }

      setMeta({ name: file.name, size: file.size, type: file.type });
      onChange?.(url);
    } finally {
      setUploading(false);
    }
  }

  function clear() {
    setErrorMsg("");
    setMeta(null);
    onChange?.("");
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white">
      <div className="p-4 border-b border-neutral-100">
        <div className="flex items-center justify-between gap-3">
          <div className="font-semibold">
            {label} {required ? <span className="text-red-600">*</span> : null}
          </div>
          {uploading ? (
            <span className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-neutral-100 text-neutral-700">
              <Loader2 className="h-3 w-3 animate-spin" />
              Upload…
            </span>
          ) : null}
        </div>
        <div className="text-sm text-neutral-500 mt-1">{helper}</div>
      </div>

      <div className="p-4 space-y-3">
        {!value ? (
          <label className="block">
            <input
              type="file"
              accept={accept}
              onChange={(e) => uploadFile(e.target.files?.[0])}
              disabled={uploading}
              className="hidden"
            />
            <div
              className={`cursor-pointer rounded-xl border border-dashed px-4 py-4 text-sm flex items-center justify-between gap-3
              ${uploading ? "bg-neutral-50 text-neutral-400" : "bg-neutral-50 hover:bg-neutral-100"}`}
            >
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                <span>Choisir un fichier…</span>
              </div>
              <span className="text-xs text-neutral-500">Max {maxMb} MB</span>
            </div>
          </label>
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4" />
              <div className="leading-tight">
                <div className="font-medium">
                  {meta?.name || "Justificatif importé"}
                </div>
                {meta?.size ? (
                  <div className="text-xs text-neutral-500">
                    {formatBytes(meta.size)} • {meta.type || "fichier"}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={value}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border bg-white px-2 py-1 text-sm inline-flex items-center gap-2 hover:bg-neutral-100"
              >
                Voir <ExternalLink className="h-4 w-4 opacity-70" />
              </a>
              <button
                type="button"
                onClick={clear}
                className="rounded-lg border bg-white px-2 py-1 text-sm inline-flex items-center gap-2 hover:bg-neutral-100"
              >
                Supprimer <Trash2 className="h-4 w-4 opacity-70" />
              </button>
            </div>
          </div>
        )}

        {errorMsg ? (
          <div className="text-sm rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">
            {errorMsg}
          </div>
        ) : null}
      </div>
    </div>
  );
}

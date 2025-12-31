import React, { useEffect, useMemo, useState } from "react";
import { getAllowedCourseJustifs, getJustifMeta } from "../../lib/justificatifs";
import { supabase } from "../../supabase";

const JUSTIF_BUCKET = "ppsjustificatifs"; // ✅ tu peux renommer plus tard si tu veux un bucket "justificatifs"

const Field = ({ label, children, hint }) => (
  <div className="space-y-1">
    <div className="text-sm font-semibold text-neutral-800">{label}</div>
    {children}
    {hint ? <div className="text-xs text-neutral-500">{hint}</div> : null}
  </div>
);

const Select = (props) => (
  <select
    {...props}
    className={`w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200 ${props.className || ""}`}
  />
);

const Input = (props) => (
  <input
    {...props}
    className={`w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200 ${props.className || ""}`}
  />
);

function isMinor(dateNaissance) {
  if (!dateNaissance) return false;
  const d = new Date(dateNaissance);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const age = now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
  return age < 18;
}

export default function JustificatifInscriptionBlock({
  course,
  form,
  setForm,
  dateNaissance, // string YYYY-MM-DD
  onValidityChange,
}) {
  const allowed = useMemo(() => getAllowedCourseJustifs(course), [course]);
  const mustBlock = !!course?.justif_block_if_missing;

  const minor = useMemo(() => !!course?.parent_authorization_enabled && isMinor(dateNaissance), [course, dateNaissance]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedMeta = useMemo(() => getJustifMeta(form?.justificatif_type || ""), [form?.justificatif_type]);

  const canValidate = useMemo(() => {
    // Si aucun type configuré -> rien à fournir
    if (!allowed.length) return true;

    // Si l’orga ne bloque pas, on considère valide même si vide
    if (!mustBlock) return true;

    // Si blocage: il faut un type choisi + la donnée requise
    if (!form?.justificatif_type) return false;

    if (selectedMeta.requiresUpload && !form?.justificatif_url) return false;
    if (selectedMeta.requiresLicence && !form?.justificatif_licence_numero) return false;

    if (minor && !form?.autorisation_parentale_url) return false;

    return true;
  }, [allowed.length, mustBlock, form, selectedMeta, minor]);

  useEffect(() => {
    onValidityChange?.(canValidate);
  }, [canValidate, onValidityChange]);

  const uploadFile = async (file, kind) => {
    setError("");
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const path = `justificatifs/${course?.id || "course"}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage.from(JUSTIF_BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from(JUSTIF_BUCKET).getPublicUrl(path);
      const url = data?.publicUrl || "";

      if (kind === "main") {
        setForm((p) => ({ ...p, justificatif_url: url, justificatif_path: path }));
      } else if (kind === "parent") {
        setForm((p) => ({ ...p, autorisation_parentale_url: url, autorisation_parentale_path: path }));
      }
    } catch (e) {
      setError(e?.message || "Upload impossible.");
    } finally {
      setBusy(false);
    }
  };

  if (!allowed.length && !course?.parent_authorization_enabled) {
    return (
      <div className="rounded-3xl bg-white shadow-sm ring-1 ring-neutral-200 p-5">
        <div className="text-lg font-extrabold text-neutral-900">Justificatif</div>
        <div className="text-sm text-neutral-600 mt-2">Aucun justificatif n’est demandé pour cette épreuve.</div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white shadow-sm ring-1 ring-neutral-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-extrabold text-neutral-900">Justificatif</div>
          <div className="text-sm text-neutral-600 mt-1">
            Choisis un type accepté par l’organisateur et renseigne le document demandé.
          </div>
        </div>
        {busy ? (
          <div className="text-xs font-semibold text-orange-700 rounded-full bg-orange-50 ring-1 ring-orange-200 px-3 py-1">
            Upload en cours…
          </div>
        ) : null}
      </div>

      {allowed.length ? (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Field label="Type de justificatif">
            <Select
              value={form?.justificatif_type || ""}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  justificatif_type: e.target.value,
                  // reset des champs dépendants
                  justificatif_url: "",
                  justificatif_path: "",
                  justificatif_licence_numero: "",
                }))
              }
            >
              <option value="">— Sélectionner —</option>
              {allowed.map((v) => (
                <option key={v} value={v}>
                  {getJustifMeta(v).label}
                </option>
              ))}
            </Select>
          </Field>

          {selectedMeta.requiresLicence ? (
            <Field label="Numéro de licence">
              <Input
                value={form?.justificatif_licence_numero || ""}
                onChange={(e) => setForm((p) => ({ ...p, justificatif_licence_numero: e.target.value }))}
                placeholder="Ex: 123456"
              />
            </Field>
          ) : null}

          {selectedMeta.requiresUpload ? (
            <Field
              label="Fichier (PDF / JPG / PNG)"
              hint="Le fichier sera envoyé à l’organisateur."
            >
              <Input
                type="file"
                accept=".pdf,image/*"
                disabled={!form?.justificatif_type || busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f, "main");
                }}
              />
              {form?.justificatif_url ? (
                <div className="text-xs text-neutral-600 mt-2 break-all">
                  ✅ Fichier ajouté : {form.justificatif_url}
                </div>
              ) : null}
            </Field>
          ) : null}
        </div>
      ) : null}

      {minor ? (
        <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-sm font-bold text-neutral-900">Autorisation parentale (mineur)</div>
          <div className="text-xs text-neutral-600 mt-1">
            L’organisateur a activé cette option. Merci d’ajouter l’autorisation signée.
          </div>

          <div className="mt-3">
            <Input
              type="file"
              accept=".pdf,image/*"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f, "parent");
              }}
            />
            {form?.autorisation_parentale_url ? (
              <div className="text-xs text-neutral-600 mt-2 break-all">
                ✅ Autorisation ajoutée : {form.autorisation_parentale_url}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {mustBlock && !canValidate ? (
        <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
          ⚠️ Justificatif requis : complète les champs ci-dessus pour pouvoir valider l’inscription.
        </div>
      ) : null}
    </div>
  );
}

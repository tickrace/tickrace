// src/components/inscription/JustificatifInscriptionBlock.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";

/**
 * Props (compat + nouvelle logique)
 * - courseId: uuid (recommandé) => le composant lit directement la table courses
 * - course: optionnel => si tu as déjà l’objet course en parent
 * - policy/types: optionnel => compat avec ancienne logique (course_justificatif_policies + justificatif_types)
 *
 * - value: objet (inscription ou member) contenant au minimum :
 *   { justificatif_type, numero_licence, pps_identifier, justificatif_url }
 * - onPatch(patch): (required) => patch atomique {field: value}
 *
 * Upload:
 * - disableUpload: bool (default false)
 * - onUploadFile(file): optionnel => si fourni, le composant délègue l’upload au parent
 * - uploading: optionnel => état d’upload venant du parent
 *
 * UI:
 * - title: string
 */
export default function JustificatifInscriptionBlock({
  courseId,
  course: courseProp,
  policy,
  types,
  value,
  onPatch,
  title = "Justificatif",
  disableUpload = false,
  onUploadFile,
  uploading: uploadingProp,
}) {
  const [course, setCourse] = useState(courseProp || null);
  const [loadingCourse, setLoadingCourse] = useState(false);
  const [uploadingLocal, setUploadingLocal] = useState(false);

  // ---------- Load course if needed ----------
  useEffect(() => {
    let abort = false;

    async function loadCourse() {
      if (courseProp) {
        setCourse(courseProp);
        return;
      }
      if (!courseId) return;

      setLoadingCourse(true);
      const { data, error } = await supabase
        .from("courses")
        .select("id, justif_block_if_missing, justif_type_1, justif_type_2, justif_type_3, parent_authorization_enabled")
        .eq("id", courseId)
        .maybeSingle();

      if (abort) return;

      if (error) {
        console.error("❌ JustificatifInscriptionBlock: load course error", error);
        setCourse(null);
      } else {
        setCourse(data || null);
      }
      setLoadingCourse(false);
    }

    loadCourse();
    return () => {
      abort = true;
    };
  }, [courseId, courseProp]);

  // ---------- Labels ----------
  const LABEL_FALLBACK = useMemo(
    () => ({
      FFA_PPS: "FFA / PPS",
      FFA_LICENCE: "Licence FFA",
      MEDICAL_CERT: "Certificat médical",
      OTHER: "Autre justificatif",
      AUTRE: "Autre justificatif",
      PPS: "PPS",
    }),
    []
  );

  const typesLabelMap = useMemo(() => {
    const map = new Map();
    (types || []).forEach((t) => {
      if (t?.code) map.set(String(t.code), t.label || t.code);
    });
    return map;
  }, [types]);

  const labelOf = (code) => {
    if (!code) return "";
    const c = String(code);
    return typesLabelMap.get(c) || LABEL_FALLBACK[c] || c;
  };

  // ---------- Source of truth : policy OR course columns ----------
  const effectiveRequired = useMemo(() => {
    if (policy && typeof policy.is_required === "boolean") return policy.is_required;
    if (course && typeof course.justif_block_if_missing === "boolean") return course.justif_block_if_missing;
    return false;
  }, [policy, course]);

  const effectiveAllowedTypes = useMemo(() => {
    // 1) policy.allowed_types si fourni
    if (policy && Array.isArray(policy.allowed_types) && policy.allowed_types.length > 0) {
      return policy.allowed_types.map(String).filter(Boolean);
    }
    // 2) courses.justif_type_1/2/3
    const arr = [course?.justif_type_1, course?.justif_type_2, course?.justif_type_3]
      .map((x) => (x ? String(x) : ""))
      .filter(Boolean);
    // si rien => fallback (ne bloque pas l’UI)
    return arr.length > 0 ? arr : ["FFA_PPS", "MEDICAL_CERT"];
  }, [policy, course]);

  const allowUpload = useMemo(() => {
    // si policy existe, elle décide; sinon on autorise l’upload (tu veux pouvoir uploader le certif médical)
    if (policy && typeof policy.allow_medical_upload === "boolean") return policy.allow_medical_upload;
    return true;
  }, [policy]);

  const uploading = Boolean(uploadingProp || uploadingLocal);

  // ---------- Current values ----------
  const currentType = String(value?.justificatif_type || "").trim();
  const currentLicence = String(value?.numero_licence || "").trim();
  const currentPps = String(value?.pps_identifier || "").trim();
  const currentUrl = String(value?.justificatif_url || "").trim();

  // ---------- Helpers ----------
  const typeIsAllowed = (t) => effectiveAllowedTypes.includes(String(t));

  // si un type n’est pas choisi mais obligatoire + 1 seul type => auto-select
  useEffect(() => {
    if (!effectiveRequired) return;
    if (currentType) return;
    if ((effectiveAllowedTypes || []).length === 1) {
      onPatch?.({ justificatif_type: effectiveAllowedTypes[0] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRequired, effectiveAllowedTypes]);

  // ---------- Upload ----------
  async function uploadViaComponent(file) {
    if (!file) return;
    if (!courseId) {
      alert("Upload impossible : courseId manquant.");
      return;
    }
    setUploadingLocal(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const user = sess?.session?.user;
      if (!user) {
        alert("Connecte-toi pour importer un justificatif.");
        return;
      }

      const bucket = "ppsjustificatifs";
      const safeName = String(file.name || "justificatif").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
      const path = `justif/${courseId}/${user.id}/${Date.now()}-${safeName}`;

      const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (error) throw error;

      const publicUrl = supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
      onPatch?.({ justificatif_url: publicUrl });
    } catch (e) {
      console.error("❌ upload justificatif (block):", e);
      alert("Erreur lors de l’upload du justificatif.");
    } finally {
      setUploadingLocal(false);
    }
  }

  const canShowUpload = useMemo(() => {
    if (disableUpload) return false;
    if (!allowUpload) return false;

    // On veut explicitement permettre l’upload du certificat médical :
    // => on l’affiche si MEDICAL_CERT est autorisé, ou si aucun type choisi mais MEDICAL_CERT existe
    if (typeIsAllowed("MEDICAL_CERT")) return true;

    // si le parcours autorise upload mais pas MEDICAL_CERT dans la liste,
    // on reste conservateur => on n'affiche pas (évite incohérences)
    return false;
  }, [disableUpload, allowUpload, effectiveAllowedTypes]);

  const hint = useMemo(() => {
    const chips = (effectiveAllowedTypes || []).slice(0, 6).map((c) => labelOf(c));
    return chips.join(" · ");
  }, [effectiveAllowedTypes, typesLabelMap]);

  // ---------- Render ----------
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-neutral-900">{title}</div>
          <div className="text-xs text-neutral-600">{effectiveRequired ? "Obligatoire" : "Optionnel"}</div>
          {hint ? <div className="mt-1 text-xs text-neutral-500">{hint}</div> : null}
        </div>
        {(loadingCourse || !courseId) && !policy ? (
          <div className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-neutral-200 text-neutral-700">
            {loadingCourse ? "Chargement…" : ""}
          </div>
        ) : null}
      </div>

      {/* Choix du type */}
      <div className="mt-3">
        <label className="text-sm font-medium text-neutral-800">Type de justificatif {effectiveRequired ? "*" : ""}</label>
        <select
          className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black"
          value={currentType}
          onChange={(e) => {
            const t = e.target.value;
            onPatch?.({
              justificatif_type: t,
              // reset des champs si on change de type
              numero_licence: t === "FFA_LICENCE" ? currentLicence : "",
              pps_identifier: t === "FFA_PPS" ? currentPps : "",
              justificatif_url: t === "MEDICAL_CERT" ? currentUrl : "",
            });
          }}
        >
          <option value="">{effectiveRequired ? "-- Choisir un type * --" : "-- Choisir un type --"}</option>
          {effectiveAllowedTypes.map((t) => (
            <option key={t} value={t}>
              {labelOf(t)}
            </option>
          ))}
        </select>
        {effectiveRequired && effectiveAllowedTypes.length > 0 && currentType && !typeIsAllowed(currentType) ? (
          <div className="mt-2 text-xs text-red-600">Type non autorisé pour cette course.</div>
        ) : null}
      </div>

      {/* Champs selon type */}
      <div className="mt-4 space-y-3">
        {(currentType === "FFA_PPS" || (!currentType && effectiveAllowedTypes.includes("FFA_PPS"))) && (
          <div>
            <label className="text-sm font-medium text-neutral-800">Code PPS</label>
            <input
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
              placeholder="Ex : ABCD-1234-EFGH-5678"
              value={currentPps}
              onChange={(e) => onPatch?.({ pps_identifier: e.target.value })}
            />
            <div className="mt-1 text-xs text-neutral-500">Renseigne le code PPS si tu choisis “FFA / PPS”.</div>
          </div>
        )}

        {(currentType === "FFA_LICENCE" || (!currentType && effectiveAllowedTypes.includes("FFA_LICENCE"))) && (
          <div>
            <label className="text-sm font-medium text-neutral-800">N° licence FFA</label>
            <input
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
              placeholder="Ex : 123456"
              value={currentLicence}
              onChange={(e) => onPatch?.({ numero_licence: e.target.value })}
            />
            <div className="mt-1 text-xs text-neutral-500">Renseigne ton numéro de licence si tu choisis “Licence FFA”.</div>
          </div>
        )}

        {/* Upload certificat médical */}
        {canShowUpload && (
          <div className="rounded-xl border border-neutral-200 bg-white p-3">
            <div className="text-sm font-medium text-neutral-800">Importer un certificat médical (photo/PDF)</div>
            <div className="mt-2">
              <input
                type="file"
                accept="image/*,application/pdf"
                disabled={uploading || disableUpload}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (onUploadFile) onUploadFile(file);
                  else uploadViaComponent(file);
                }}
                className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-xl file:border file:border-neutral-200 file:bg-white file:px-3 file:py-2 hover:file:bg-neutral-50"
              />
            </div>

            {currentUrl ? (
              <div className="mt-2 text-xs text-neutral-700 break-all">
                Fichier importé :{" "}
                <a className="underline" href={currentUrl} target="_blank" rel="noreferrer">
                  {currentUrl}
                </a>
              </div>
            ) : (
              <div className="mt-2 text-xs text-neutral-500">Formats acceptés : image ou PDF.</div>
            )}

            {uploading ? <div className="mt-2 text-xs text-neutral-500">Upload en cours…</div> : null}
          </div>
        )}
      </div>

      {/* Petit rappel si obligatoire */}
      {effectiveRequired ? (
        <div className="mt-3 text-xs text-neutral-600">
          Le justificatif est requis : choisis un type et renseigne le champ correspondant (ou importe le certificat si “Certificat médical”).
        </div>
      ) : null}
    </div>
  );
}

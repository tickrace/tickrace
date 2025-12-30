// src/pages/OrganisateurTest.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { useJustificatifConfig } from "../hooks/useJustificatifConfig";

export default function OrganisateurTest() {
  const [courseId, setCourseId] = useState("");
  const [formats, setFormats] = useState([]);
  const [formatId, setFormatId] = useState(""); // "" = global course
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  // Hook config (utilisé surtout pour catalogue + debug)
  const { loading, catalogue, allowedTypes, isRequired, allowMedicalUpload, notes, refresh, debug } =
    useJustificatifConfig({
      courseId: courseId || null,
      formatId: formatId || null,
      enabled: Boolean(courseId),
      defaults: { required: true, allowMedicalUpload: false, allowedTypes: [] },
    });

  // Local editable state (pour ne pas écraser le hook)
  const [form, setForm] = useState({
    is_required: true,
    allow_medical_upload: false,
    allowed_types: [],
    notes: "",
  });

  const activeCatalogue = useMemo(
    () => (catalogue || []).filter((t) => t.is_active !== false),
    [catalogue]
  );

  // Charger formats de la course (pour dropdown)
  useEffect(() => {
    let abort = false;
    async function loadFormats() {
      setFormats([]);
      if (!courseId) return;

      const { data, error } = await supabase
        .from("formats")
        .select("id, nom, type_epreuve, date")
        .eq("course_id", courseId)
        .order("created_at", { ascending: true });

      if (abort) return;
      if (error) {
        console.error("OrganisateurTest load formats error:", error);
        return;
      }
      setFormats(data || []);
    }
    loadFormats();
    return () => {
      abort = true;
    };
  }, [courseId]);

  // Sync local form quand la config change (hook)
  useEffect(() => {
    if (!courseId) return;
    setForm({
      is_required: Boolean(isRequired),
      allow_medical_upload: Boolean(allowMedicalUpload),
      allowed_types: Array.isArray(allowedTypes) ? allowedTypes : [],
      notes: notes || "",
    });
  }, [courseId, formatId, isRequired, allowMedicalUpload, allowedTypes, notes]);

  const toggleAllowed = (code) => {
    setForm((p) => {
      const set = new Set(p.allowed_types || []);
      if (set.has(code)) set.delete(code);
      else set.add(code);
      return { ...p, allowed_types: Array.from(set) };
    });
  };

  async function handleSave() {
    if (!courseId) {
      alert("Renseigne un courseId.");
      return;
    }
    setSaving(true);
    setStatus("");

    try {
      // 1) cherche si row existe déjà (format spécifique ou global)
      let existing = null;

      if (formatId) {
        const { data } = await supabase
          .from("course_justificatif_policies")
          .select("id")
          .eq("course_id", courseId)
          .eq("format_id", formatId)
          .maybeSingle();
        existing = data || null;
      } else {
        const { data } = await supabase
          .from("course_justificatif_policies")
          .select("id")
          .eq("course_id", courseId)
          .is("format_id", null)
          .maybeSingle();
        existing = data || null;
      }

      const payload = {
        course_id: courseId,
        format_id: formatId || null,
        is_required: Boolean(form.is_required),
        allow_medical_upload: Boolean(form.allow_medical_upload),
        allowed_types: Array.isArray(form.allowed_types) ? form.allowed_types.filter(Boolean) : [],
        notes: form.notes || "",
        updated_at: new Date().toISOString(),
      };

      if (existing?.id) {
        const { error } = await supabase
          .from("course_justificatif_policies")
          .update(payload)
          .eq("id", existing.id);

        if (error) throw error;
        setStatus("✅ Policy mise à jour.");
      } else {
        const { error } = await supabase.from("course_justificatif_policies").insert([payload]);
        if (error) throw error;
        setStatus("✅ Policy créée.");
      }

      await refresh?.();
    } catch (e) {
      console.error("OrganisateurTest save error:", e);
      setStatus("❌ Erreur lors de l’enregistrement (console).");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold">OrganisateurTest — Justificatifs (config)</h1>
      <p className="text-sm text-neutral-600 mt-1">
        Cette page simule la config justificatifs côté organisateur (UpsertCourse), en écrivant dans{" "}
        <code className="px-1 rounded bg-neutral-100">course_justificatif_policies</code>.
      </p>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="p-5 border-b border-neutral-100">
              <h2 className="text-lg font-semibold">Ciblage</h2>
              <p className="text-sm text-neutral-500">
                Global course (format vide) ou spécifique à un format.
              </p>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-sm font-medium">courseId</label>
                <input
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                  placeholder="uuid course"
                />
              </div>

              <div>
                <label className="text-sm font-medium">format</label>
                <select
                  value={formatId}
                  onChange={(e) => setFormatId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                  disabled={!courseId}
                >
                  <option value="">(Global course)</option>
                  {formats.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nom} {f.type_epreuve ? `— ${f.type_epreuve}` : ""} {f.date ? `— ${f.date}` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-neutral-500 mt-1">
                  Astuce : commence par global course, puis override un format si besoin.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => refresh?.()}
                  disabled={!courseId || loading}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-50"
                >
                  Recharger
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!courseId || saving}
                  className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
                >
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>

              {status && (
                <div className="text-sm mt-2">
                  {status}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="p-5 border-b border-neutral-100">
              <h2 className="text-lg font-semibold">Policy</h2>
              <p className="text-sm text-neutral-500">Ces valeurs alimentent le client (Inscription).</p>
            </div>

            <div className="p-5 space-y-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!form.is_required}
                  onChange={(e) => setForm((p) => ({ ...p, is_required: e.target.checked }))}
                />
                Justificatif requis
              </label>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!form.allow_medical_upload}
                  onChange={(e) => setForm((p) => ({ ...p, allow_medical_upload: e.target.checked }))}
                />
                Autoriser l’upload (photo/PDF)
              </label>

              <div>
                <div className="text-sm font-medium">Types autorisés (allowed_types)</div>
                <p className="text-xs text-neutral-500">
                  Si vide → “tous les types actifs” côté client (comportement du hook).
                </p>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeCatalogue.map((t) => {
                    const c = String(t.code || "").toLowerCase();
                    const checked = (form.allowed_types || []).includes(c);
                    return (
                      <label
                        key={c}
                        className="flex items-start gap-2 rounded-xl border border-neutral-200 p-3 bg-neutral-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAllowed(c)}
                          className="mt-1"
                        />
                        <div>
                          <div className="text-sm font-semibold">{t.label || c}</div>
                          <div className="text-xs text-neutral-600">{c}</div>
                          {t.description ? <div className="text-xs text-neutral-500 mt-1">{t.description}</div> : null}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Notes</div>
                <textarea
                  value={form.notes || ""}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  className="mt-1 w-full min-h-[110px] rounded-xl border border-neutral-300 px-3 py-2"
                  placeholder="Texte d’aide affiché côté coureur…"
                />
              </div>
            </div>
          </section>
        </div>

        <aside className="lg:col-span-1">
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm sticky top-6">
            <div className="p-5 border-b border-neutral-100">
              <h3 className="text-lg font-semibold">Debug</h3>
              <p className="text-sm text-neutral-500">Infos utiles pour vérifier la config.</p>
            </div>

            <div className="p-5 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-neutral-600">Catalogue</span>
                <b>{debug?.catalogueTable || "—"}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Policy DB</span>
                <b>{debug?.dbPolicyTable || "—"}</b>
              </div>
              <div className="h-px bg-neutral-200 my-2" />
              <div className="text-xs text-neutral-600">Allowed types effectifs</div>
              <div className="flex flex-wrap gap-1">
                {(allowedTypes || []).slice(0, 12).map((c) => (
                  <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 border">
                    {c}
                  </span>
                ))}
                {(allowedTypes || []).length > 12 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 border">
                    +{(allowedTypes || []).length - 12}
                  </span>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

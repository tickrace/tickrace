// src/components/course/JustificatifCourseSettings.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";
import { JUSTIF_TYPES, mergeJustificatifState, normalizeJustificatifState } from "../../lib/justificatifs";

/**
 * Paramétrage des justificatifs pour une course (policy globale) ou un format (optionnel).
 *
 * DB attendue:
 * - table course_justificatif_policies:
 *   course_id uuid
 *   format_id uuid null
 *   is_required bool
 *   allow_medical_upload bool
 *   allowed_types text[]
 *   notes text
 */
export default function JustificatifCourseSettings({
  courseId,
  formatId = null, // null => policy globale course
  title = "Justificatifs",
  className = "",
  onSaved,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [typesDb, setTypesDb] = useState([]);
  const [policy, setPolicy] = useState(
    normalizeJustificatifState({
      is_required: false,
      allow_medical_upload: true,
      allowed_types: [],
      notes: "",
    })
  );

  const typesCatalogue = useMemo(() => {
    const rows = (typesDb && typesDb.length > 0 ? typesDb : JUSTIF_TYPES)
      .filter((t) => t?.code)
      .map((t) => ({
        code: String(t.code),
        label: t.label || t.code,
        federation_code: t.federation_code ?? null,
        input_mode: t.input_mode ?? null,
        is_medical: !!t.is_medical,
        sort_order: Number(t.sort_order ?? 999),
      }))
      .sort((a, b) => a.sort_order - b.sort_order);

    // dédoublonnage par code
    const seen = new Set();
    return rows.filter((r) => {
      if (seen.has(r.code)) return false;
      seen.add(r.code);
      return true;
    });
  }, [typesDb]);

  const allowed = useMemo(() => new Set(policy.allowed_types || []), [policy.allowed_types]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!courseId) return;

      setLoading(true);
      setErr("");

      // 1) types actifs (DB)
      try {
        const { data: jt, error: jtErr } = await supabase
          .from("justificatif_types")
          .select("code,label,federation_code,input_mode,is_medical,sort_order,is_active")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        if (!jtErr && mounted) setTypesDb(jt || []);
      } catch (e) {
        // fallback silencieux sur JUSTIF_TYPES
      }

      // 2) policy
      try {
        const q = supabase
          .from("course_justificatif_policies")
          .select("*")
          .eq("course_id", courseId);

        const { data: pol, error: polErr } = formatId ? await q.eq("format_id", formatId).maybeSingle() : await q.is("format_id", null).maybeSingle();

        if (polErr) throw polErr;

        if (mounted) {
          if (pol) {
            setPolicy(
              normalizeJustificatifState({
                is_required: pol.is_required !== false,
                allow_medical_upload: !!pol.allow_medical_upload,
                allowed_types: Array.isArray(pol.allowed_types) ? pol.allowed_types.filter(Boolean) : [],
                notes: pol.notes || "",
              })
            );
          } else {
            // defaults si pas de ligne
            setPolicy(
              normalizeJustificatifState({
                is_required: false,
                allow_medical_upload: true,
                allowed_types: [],
                notes: "",
              })
            );
          }
        }
      } catch (e) {
        if (mounted) setErr("Impossible de charger la configuration des justificatifs.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [courseId, formatId]);

  function toggleAllowed(code) {
    setPolicy((prev) => {
      const p = normalizeJustificatifState(prev);
      const cur = new Set(p.allowed_types || []);
      if (cur.has(code)) cur.delete(code);
      else cur.add(code);
      return mergeJustificatifState(p, { allowed_types: Array.from(cur) });
    });
  }

  function setField(name, value) {
    setPolicy((prev) => mergeJustificatifState(prev, { [name]: value }));
  }

  async function save() {
    if (!courseId) return;
    setSaving(true);
    setErr("");

    try {
      const payload = {
        course_id: courseId,
        format_id: formatId,
        is_required: policy.is_required !== false,
        allow_medical_upload: !!policy.allow_medical_upload,
        allowed_types: Array.isArray(policy.allowed_types) ? policy.allowed_types.filter(Boolean) : [],
        notes: policy.notes || "",
      };

      // upsert sur (course_id, format_id)
      const { error } = await supabase.from("course_justificatif_policies").upsert(payload, {
        onConflict: "course_id,format_id",
      });

      if (error) throw error;

      onSaved?.(payload);
    } catch (e) {
      console.error("❌ save justificatif policy:", e);
      setErr("Erreur lors de l’enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  const presets = [
    {
      label: "Aucun",
      apply: () => setPolicy(normalizeJustificatifState({ is_required: false, allow_medical_upload: true, allowed_types: [], notes: "" })),
    },
    {
      label: "FFA (PPS + licence) + upload",
      apply: () =>
        setPolicy(
          normalizeJustificatifState({
            is_required: true,
            allow_medical_upload: true,
            allowed_types: ["pps", "licence_ffa", "certificat_medical"],
            notes: "",
          })
        ),
    },
    {
      label: "PPS uniquement",
      apply: () =>
        setPolicy(
          normalizeJustificatifState({
            is_required: true,
            allow_medical_upload: false,
            allowed_types: ["pps"],
            notes: "",
          })
        ),
    },
  ];

  if (loading) {
    return (
      <section className={`rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`}>
        <div className="p-5 border-b border-neutral-100">
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="p-5 text-sm text-neutral-500">Chargement…</div>
      </section>
    );
  }

  return (
    <section className={`rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`}>
      <div className="p-5 border-b border-neutral-100 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-neutral-500">
            Configure si un justificatif est requis (PPS / licence / upload). (Policy {formatId ? "format" : "course"})
          </p>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${saving ? "bg-neutral-400" : "bg-neutral-900 hover:bg-black"}`}
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      <div className="p-5 space-y-5">
        {err ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div> : null}

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={p.apply}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Required + Upload */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 p-3">
            <div>
              <div className="text-sm font-semibold text-neutral-900">Justificatif requis</div>
              <div className="text-xs text-neutral-600">Si activé, un PPS/licence (ou upload si autorisé) sera demandé.</div>
            </div>
            <input type="checkbox" checked={policy.is_required} onChange={(e) => setField("is_required", e.target.checked)} />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 p-3">
            <div>
              <div className="text-sm font-semibold text-neutral-900">Upload médical autorisé</div>
              <div className="text-xs text-neutral-600">Permet l’import d’un fichier (photo/PDF) si nécessaire.</div>
            </div>
            <input type="checkbox" checked={policy.allow_medical_upload} onChange={(e) => setField("allow_medical_upload", e.target.checked)} />
          </label>
        </div>

        {/* Allowed types */}
        <div>
          <div className="text-sm font-semibold text-neutral-900">Types autorisés</div>
          <div className="text-xs text-neutral-600">
            Laisse vide pour “auto” (PPS + licence par défaut côté UI). Sinon, coche précisément les types acceptés.
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {typesCatalogue.map((t) => {
              const active = allowed.has(t.code);
              return (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => toggleAllowed(t.code)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50"
                  }`}
                >
                  {t.label}
                  {t.federation_code ? <span className="ml-2 opacity-80">({t.federation_code})</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div>
          <div className="text-sm font-semibold text-neutral-900">Notes / instructions</div>
          <div className="text-xs text-neutral-600">Affichées aux coureurs au moment de l’inscription.</div>
          <textarea
            className="mt-2 w-full min-h-[90px] rounded-xl border border-neutral-300 px-3 py-2 text-sm"
            value={policy.notes || ""}
            onChange={(e) => setField("notes", e.target.value)}
            placeholder="Ex: PPS obligatoire (QR code) ou licence FFA valide. Aucun certificat médical accepté…"
          />
        </div>
      </div>
    </section>
  );
}

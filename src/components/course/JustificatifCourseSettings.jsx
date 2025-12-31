// src/components/course/JustificatifCourseSettings.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";

const FALLBACK_TYPES = [
  { code: "pps", label: "PPS (France)" },
  { code: "ffa_licence", label: "Licence FFA" },
  { code: "medical_certificate", label: "Certificat médical" },
  { code: "licence_autre", label: "Licence / fédération (autre)" },
];

export default function JustificatifCourseSettings({ value, onChange }) {
  const course = value || {};
  const patch = (p) => onChange?.({ ...course, ...p });

  const [types, setTypes] = useState(FALLBACK_TYPES);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoadingTypes(true);
      setLoadError(null);
      try {
        const { data, error } = await supabase
          .from("justificatif_types")
          .select("code,label,is_active,sort_order")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        if (!alive) return;

        if (error) {
          // RLS / table absente / etc -> fallback
          console.warn("JustificatifCourseSettings: load justificatif_types failed:", error);
          setLoadError(error.message || "Erreur de chargement");
          setTypes(FALLBACK_TYPES);
          return;
        }

        const rows = (data || [])
          .map((r) => ({
            code: r.code,
            label: r.label || r.code,
          }))
          .filter((r) => r.code);

        // Si table vide -> fallback
        setTypes(rows.length ? rows : FALLBACK_TYPES);
      } catch (e) {
        if (!alive) return;
        console.warn("JustificatifCourseSettings: exception:", e);
        setLoadError(e?.message || "Erreur");
        setTypes(FALLBACK_TYPES);
      } finally {
        if (alive) setLoadingTypes(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const options = useMemo(() => {
    // Sécurise l’unicité des codes
    const map = new Map();
    (types || []).forEach((t) => {
      if (!t?.code) return;
      map.set(t.code, t.label || t.code);
    });
    return Array.from(map.entries()).map(([code, label]) => ({ code, label }));
  }, [types]);

  return (
    <section className="mt-6 rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="p-5 border-b border-neutral-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Justificatifs</h3>
            <p className="text-sm text-neutral-500">
              Configuration globale (au niveau de l’épreuve).{" "}
              <span className="text-neutral-600">Pas de règles par format.</span>
            </p>
          </div>

          <div className="text-right">
            {loadingTypes ? (
              <div className="text-xs text-neutral-500">Chargement des types…</div>
            ) : loadError ? (
              <div className="text-xs text-amber-700">Fallback activé</div>
            ) : (
              <div className="text-xs text-emerald-700">Types chargés</div>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Bloquer si manquant */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!course.justif_block_if_missing}
            onChange={(e) => patch({ justif_block_if_missing: e.target.checked })}
          />
          <span className="font-medium">Bloquer l’inscription si justificatif manquant</span>
        </label>

        {/* Types autorisés (jusqu’à 3) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="text-xs font-semibold text-neutral-600 mb-1">Type 1</div>
            <select
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
              value={course.justif_type_1 || ""}
              onChange={(e) => patch({ justif_type_1: e.target.value || "" })}
            >
              <option value="">— Aucun —</option>
              {options.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs font-semibold text-neutral-600 mb-1">Type 2</div>
            <select
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
              value={course.justif_type_2 || ""}
              onChange={(e) => patch({ justif_type_2: e.target.value || "" })}
            >
              <option value="">— Aucun —</option>
              {options.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs font-semibold text-neutral-600 mb-1">Type 3</div>
            <select
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
              value={course.justif_type_3 || ""}
              onChange={(e) => patch({ justif_type_3: e.target.value || "" })}
            >
              <option value="">— Aucun —</option>
              {options.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Autorisation parentale */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!course.parent_authorization_enabled}
            onChange={(e) => patch({ parent_authorization_enabled: e.target.checked })}
          />
          <span className="font-medium">Activer l’autorisation parentale (mineurs)</span>
        </label>

        {loadError ? (
          <div className="text-xs text-neutral-500">
            Note : impossible de charger <code className="px-1 py-0.5 rounded bg-neutral-100">justificatif_types</code>{" "}
            ({String(loadError)}). Le bloc utilise une liste fallback.
          </div>
        ) : null}
      </div>
    </section>
  );
}

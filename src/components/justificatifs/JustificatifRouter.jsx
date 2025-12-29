// src/components/justificatifs/JustificatifRouter.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useJustificatifConfig } from "../../hooks/useJustificatifConfig";
import JustificatifBox from "./JustificatifBox";
import * as Registry from "./JustificatifRegistry";

/**
 * Value contract (souple) :
 * - value peut être:
 *   { type: "pps"|"licence_ffa"|..., payload: {...} }
 *   OU un objet libre; dans ce cas on stocke type/payload côté router.
 *
 * onChange(nextValue) renvoie toujours { type, payload } (forme stable)
 */
export default function JustificatifRouter({
  course = null,
  format = null,
  courseId = null,
  formatId = null,

  value = null,
  onChange,

  disabled = false,
  title = "Justificatif",
  subtitle = "Choisis ton type de justificatif puis renseigne les informations demandées.",

  // si true, affiche le sélecteur de type même si un seul type autorisé
  forcePicker = false,

  // debug optionnel
  showDebug = false,
}) {
  const {
    loading,
    error,
    catalogue,
    allowedTypes,
    isRequired,
    notes,
    allowMedicalUpload,
    debug,
  } = useJustificatifConfig({
    course,
    format,
    courseId,
    formatId,
    enabled: true,
    // defaults de base (peuvent être écrasés par course/format/db policy)
    defaults: {
      required: true,
      allowMedicalUpload: false,
      notes: "",
      allowedTypes: [],
    },
  });

  // Normalise value -> {type, payload}
  const normalized = useMemo(() => {
    if (value && typeof value === "object" && ("type" in value || "payload" in value)) {
      return {
        type: value.type || "",
        payload: value.payload || {},
      };
    }
    // ancienne forme / valeur brute
    return { type: "", payload: value || {} };
  }, [value]);

  const allowedActiveCatalogue = useMemo(() => {
    const mapByCode = new Map(
      (catalogue || [])
        .filter((t) => t && t.is_active !== false)
        .map((t) => [String(t.code || "").toLowerCase(), t])
    );

    const codes = (allowedTypes || [])
      .map((c) => String(c || "").toLowerCase())
      .filter(Boolean);

    // Si pas de catalogue en base, on tente via registry
    if (!mapByCode.size) {
      const regObj = Registry.REGISTRY || Registry.registry || Registry.default || {};
      return codes.map((code) => ({
        code,
        label: (regObj?.[code]?.label || regObj?.[code]?.meta?.label || code).toString(),
        description: regObj?.[code]?.description || regObj?.[code]?.meta?.description || "",
        is_active: true,
      }));
    }

    return codes
      .map((code) => mapByCode.get(code))
      .filter(Boolean);
  }, [catalogue, allowedTypes]);

  const firstAllowed = allowedActiveCatalogue?.[0]?.code || "";

  const [activeType, setActiveType] = useState(normalized.type || firstAllowed);

  // Garde activeType cohérent quand allowedTypes changent
  useEffect(() => {
    const codes = (allowedActiveCatalogue || []).map((t) => t.code);
    const current = String(activeType || "").toLowerCase();

    if (!codes.length) {
      setActiveType("");
      return;
    }
    if (!current || !codes.includes(current)) {
      setActiveType(codes[0]);
    }
  }, [allowedActiveCatalogue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Si parent pousse un type explicite, on le respecte
  useEffect(() => {
    const incoming = String(normalized.type || "").toLowerCase();
    if (incoming && incoming !== String(activeType || "").toLowerCase()) {
      setActiveType(incoming);
    }
  }, [normalized.type]); // eslint-disable-line react-hooks/exhaustive-deps

  // Emit vers parent (forme stable)
  const emit = (next) => {
    const safe = {
      type: String(next?.type || activeType || "").toLowerCase(),
      payload: next?.payload && typeof next.payload === "object" ? next.payload : {},
    };
    onChange?.(safe);
  };

  // Récup composant depuis Registry (supporte plusieurs styles d’export)
  const ResolvedComp = useMemo(() => {
    const code = String(activeType || "").toLowerCase();
    if (!code) return null;

    const regGetter =
      Registry.getJustificatifComponent ||
      Registry.getComponent ||
      Registry.resolveComponent ||
      null;

    if (typeof regGetter === "function") {
      return regGetter(code) || null;
    }

    const regObj = Registry.REGISTRY || Registry.registry || Registry.default || {};
    // Deux styles possibles:
    // - { code: Component }
    // - { code: { Component, meta } }
    const entry = regObj?.[code];
    if (!entry) return null;

    if (typeof entry === "function") return entry;
    if (entry && typeof entry.Component === "function") return entry.Component;

    return null;
  }, [activeType]);

  const activeMeta = useMemo(() => {
    const code = String(activeType || "").toLowerCase();
    const row = (allowedActiveCatalogue || []).find(
      (t) => String(t.code || "").toLowerCase() === code
    );

    const regObj = Registry.REGISTRY || Registry.registry || Registry.default || {};
    const entry = regObj?.[code];
    const regMeta = entry?.meta || entry || {};

    return {
      code,
      label: row?.label || regMeta?.label || code,
      description: row?.description || regMeta?.description || "",
    };
  }, [activeType, allowedActiveCatalogue]);

  const showPicker = forcePicker || (allowedActiveCatalogue?.length || 0) > 1;

  return (
    <JustificatifBox
      title={title}
      subtitle={subtitle}
      required={isRequired}
      notes={notes}
      loading={loading}
      error={error}
    >
      {/* Erreur chargement */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Impossible de charger la configuration justificatif.
        </div>
      )}

      {/* Sélecteur de type */}
      {showPicker && !loading && (allowedActiveCatalogue?.length || 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          {allowedActiveCatalogue.map((t) => {
            const code = String(t.code || "").toLowerCase();
            const isOn = code === String(activeType || "").toLowerCase();
            return (
              <button
                key={code}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setActiveType(code);
                  // reset payload quand on change de type (évite collisions)
                  emit({ type: code, payload: {} });
                }}
                className={[
                  "px-3 py-1.5 rounded-xl border text-sm font-medium transition",
                  isOn
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "bg-white hover:bg-neutral-50 border-neutral-200",
                  disabled ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
                title={t.description || ""}
              >
                {t.label || code}
              </button>
            );
          })}
        </div>
      )}

      {/* Info type sélectionné */}
      {!loading && activeMeta?.label && (
        <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <div className="text-sm font-semibold text-neutral-900">
            {activeMeta.label}
          </div>
          {activeMeta.description ? (
            <div className="text-sm text-neutral-600 mt-1">{activeMeta.description}</div>
          ) : null}
          {allowMedicalUpload ? (
            <div className="text-xs text-neutral-500 mt-2">
              Upload médical autorisé (si requis par ce type).
            </div>
          ) : null}
        </div>
      )}

      {/* Rendu du composant réel */}
      <div className="mt-4">
        {loading ? (
          <div className="text-sm text-neutral-500">Chargement…</div>
        ) : !activeType ? (
          <div className="text-sm text-neutral-500">
            Aucun type de justificatif n’est disponible.
          </div>
        ) : !ResolvedComp ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Type <b>{activeType}</b> non supporté côté UI (registry manquant).
          </div>
        ) : (
          <ResolvedComp
            disabled={disabled}
            required={isRequired}
            allowMedicalUpload={allowMedicalUpload}
            // payload spécifique au type
            value={normalized.payload || {}}
            onChange={(payload) => emit({ type: activeType, payload: payload || {} })}
            // infos utiles
            course={course}
            format={format}
            courseId={courseId || course?.id || null}
            formatId={formatId || format?.id || null}
          />
        )}
      </div>

      {showDebug && (
        <div className="mt-4 text-xs text-neutral-500">
          <div>allowedTypes: {(allowedTypes || []).join(", ") || "—"}</div>
          <div>catalogueTable: {debug?.catalogueTable || "—"}</div>
          <div>dbPolicyTable: {debug?.dbPolicyTable || "—"}</div>
        </div>
      )}
    </JustificatifBox>
  );
}

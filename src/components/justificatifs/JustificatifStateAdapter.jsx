// src/components/justificatifs/JustificatifStateAdapter.jsx
import React, { useMemo, useCallback } from "react";

/**
 * Mapping par défaut entre "type" et champs legacy existants.
 * Tu peux l'étendre via prop `mappers`.
 *
 * Payload standardisé côté UI :
 * - pps: { ppsCode }
 * - licence_ffa: { licence }
 *
 * Important: ce fichier n'impose PAS de schéma DB.
 * Il ne fait que synchroniser vers/depuis un objet legacy.
 */

/* --------------------------- Helpers --------------------------- */
const lower = (v) => String(v || "").trim().toLowerCase();

function hasOwn(obj, key) {
  return obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function pickFirstTypeFromLegacy(legacy, defaultType) {
  const t = lower(legacy?.justificatif_type || legacy?.type || "");
  if (t) return t;

  // Heuristique : si le champ PPS est rempli => pps ; sinon si licence => licence_ffa
  if (legacy?.pps_identifier && String(legacy.pps_identifier).trim()) return "pps";
  if (legacy?.numero_licence && String(legacy.numero_licence).trim()) return "licence_ffa";

  return lower(defaultType || "") || "";
}

/* ------------------- Default mappers (legacy <-> payload) ------------------- */
const DEFAULT_MAPPERS = {
  pps: {
    fromLegacy: (legacy) => ({
      ppsCode: legacy?.pps_identifier || "",
      // on supporte aussi d'autres clés si tu les utilises déjà
      // ppsScanUrl: legacy?.pps_scan_url || legacy?.pps_justificatif_url || "",
    }),
    toLegacy: (payload) => ({
      pps_identifier: payload?.ppsCode || payload?.code || payload?.pps_identifier || "",
      // pps_scan_url: payload?.ppsScanUrl || payload?.pps_scan_url || "",
    }),
  },

  licence_ffa: {
    fromLegacy: (legacy) => ({
      licence: legacy?.numero_licence || "",
    }),
    toLegacy: (payload) => ({
      numero_licence: payload?.licence || payload?.numero_licence || "",
    }),
  },

  // Alias "ffa" fréquent
  ffa: {
    fromLegacy: (legacy) => ({
      licence: legacy?.numero_licence || "",
    }),
    toLegacy: (payload) => ({
      numero_licence: payload?.licence || payload?.numero_licence || "",
    }),
  },

  // Tu peux ajouter ici d'autres types (#4..#16) plus tard,
  // ou les passer via prop `mappers`.
};

/**
 * Hook : transforme un objet legacy en {type,payload}
 * et renvoie une fonction pour écrire dans legacy depuis {type,payload}.
 */
export function useJustificatifLegacyAdapter({
  legacy,
  setLegacy, // (updater) => void  OR  (nextObj) => void
  defaultType = "pps",
  typeKey = "justificatif_type",
  payloadKey = "justificatif_payload",
  clearOnTypeSwitch = true,
  writeJson = true, // si true, écrit {type,payload} dans typeKey/payloadKey quand possible
  mappers = {},
}) {
  const mapperTable = useMemo(
    () => ({ ...DEFAULT_MAPPERS, ...mappers }),
    [mappers]
  );

  const routerValue = useMemo(() => {
    const type = pickFirstTypeFromLegacy(legacy, defaultType);

    // payload json stocké éventuellement
    const jsonPayload =
      legacy &&
      (legacy[payloadKey] && typeof legacy[payloadKey] === "object"
        ? legacy[payloadKey]
        : null);

    const map = mapperTable[type];
    const payload =
      jsonPayload ||
      (map?.fromLegacy ? map.fromLegacy(legacy) : {}) ||
      {};

    return { type, payload };
  }, [legacy, defaultType, mapperTable, payloadKey]);

  const setRouterValue = useCallback(
    (next) => {
      const nextType = lower(next?.type || "");
      const nextPayload =
        next?.payload && typeof next.payload === "object" ? next.payload : {};

      const map = mapperTable[nextType];

      const patchFromMapper = map?.toLegacy ? map.toLegacy(nextPayload) : {};

      const patchJson = {};
      if (writeJson) {
        // On écrit seulement si le legacy contient déjà ces keys,
        // OU si tu veux forcer l’écriture (ici: writeJson=true -> on écrit)
        patchJson[typeKey] = nextType;
        patchJson[payloadKey] = nextPayload;
      } else {
        // fallback : on tente au moins le typeKey s'il existe
        if (hasOwn(legacy || {}, typeKey)) patchJson[typeKey] = nextType;
        if (hasOwn(legacy || {}, payloadKey)) patchJson[payloadKey] = nextPayload;
      }

      const updater = (prev) => {
        const prevObj = prev && typeof prev === "object" ? prev : (legacy || {});
        const prevType = lower(prevObj?.[typeKey] || "");

        // optionnel : nettoyage des champs incongrus quand on change de type
        let cleared = {};
        if (clearOnTypeSwitch && prevType && prevType !== nextType) {
          // on nettoie licence + pps par défaut (tu peux étendre si besoin)
          cleared = {
            numero_licence: "",
            pps_identifier: "",
            // pps_scan_url: "",
          };
        }

        return {
          ...prevObj,
          ...cleared,
          ...patchFromMapper,
          ...patchJson,
        };
      };

      // setLegacy supporte (fn) ou (obj)
      if (typeof setLegacy === "function") {
        try {
          // si setLegacy accepte un updater
          setLegacy(updater);
        } catch {
          // sinon on calcule et on envoie un objet
          setLegacy(updater(legacy || {}));
        }
      }
    },
    [
      setLegacy,
      legacy,
      mapperTable,
      clearOnTypeSwitch,
      writeJson,
      typeKey,
      payloadKey,
    ]
  );

  return { routerValue, setRouterValue };
}

/**
 * Composant wrapper (render-prop)
 * Usage:
 * <JustificatifStateAdapter legacy={inscription} setLegacy={setInscription}>
 *   {({ value, onChange }) => (
 *     <JustificatifRouter value={value} onChange={onChange} ... />
 *   )}
 * </JustificatifStateAdapter>
 */
export default function JustificatifStateAdapter({
  legacy,
  setLegacy,
  defaultType = "pps",
  typeKey = "justificatif_type",
  payloadKey = "justificatif_payload",
  clearOnTypeSwitch = true,
  writeJson = true,
  mappers = {},
  children,
}) {
  const { routerValue, setRouterValue } = useJustificatifLegacyAdapter({
    legacy,
    setLegacy,
    defaultType,
    typeKey,
    payloadKey,
    clearOnTypeSwitch,
    writeJson,
    mappers,
  });

  if (typeof children === "function") {
    return children({ value: routerValue, onChange: setRouterValue });
  }

  // Si jamais tu veux l’utiliser sans render-prop, on ne rend rien par défaut
  return null;
}

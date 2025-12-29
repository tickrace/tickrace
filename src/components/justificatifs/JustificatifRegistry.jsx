// src/components/justificatifs/JustificatifRegistry.jsx
import React from "react";

/**
 * Convention (recommandée) pour chaque composant dans:
 *   src/components/justificatifs/types/*.jsx
 *
 * Il doit exporter par défaut un composant React + un code:
 *
 * export const CODE = "ffc_licence";
 * export default function JustificatifFfcLicence({ value, onChange, meta }) { ... }
 *
 * Si CODE n'est pas présent, on utilisera le nom de fichier (basename) comme code.
 */

function normalizeCode(code) {
  return String(code || "").trim().toLowerCase();
}

// Vite: charge tous les types (eager = sync)
const modules = import.meta.glob("./types/*.jsx", { eager: true });

function buildMapFromModules(mods) {
  const map = {};
  Object.entries(mods || {}).forEach(([path, mod]) => {
    const Comp = mod?.default;
    if (!Comp) return;

    // 1) CODE exporté
    const exportedCode = mod?.CODE || mod?.JustificatifCode || mod?.JUSTIFICATIF_CODE;

    // 2) fallback: basename du fichier
    const basename = String(path)
      .split("/")
      .pop()
      .replace(/\.jsx$/i, "");

    const code = normalizeCode(exportedCode || basename);
    if (!code) return;

    map[code] = Comp;
  });
  return map;
}

// Singleton (stable)
const _customRenderers = buildMapFromModules(modules);

/**
 * Retourne le mapping code -> composant,
 * à passer au <JustificatifRouter customRenderers={...} />
 */
export function getJustificatifCustomRenderers() {
  return _customRenderers;
}

/**
 * Petit helper debug (optionnel)
 */
export function listJustificatifRenderers() {
  return Object.keys(_customRenderers).sort();
}

/**
 * Composant debug (optionnel)
 * <JustificatifRegistryDebug />
 */
export function JustificatifRegistryDebug() {
  const codes = listJustificatifRenderers();
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="text-sm font-semibold">Justificatif Registry</div>
      <div className="mt-2 text-xs text-neutral-600">
        {codes.length ? (
          <ul className="list-disc pl-4">
            {codes.map((c) => (
              <li key={c}>
                <span className="font-mono">{c}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div>Aucun renderer détecté dans ./types/*.jsx</div>
        )}
      </div>
    </div>
  );
}

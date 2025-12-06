// src/components/JustificatifFfaPps.jsx
import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

/**
 * Validation "soft" du numéro de licence FFA :
 * - uniquement des chiffres
 * - longueur 6 ou 7
 */
function validateFfaLicence(value) {
  if (!value) return false;
  const cleaned = value.replace(/\s+/g, "");
  return /^\d{6,7}$/.test(cleaned);
}

/**
 * Validation "soft" du code PPS :
 * - lettres A-Z + chiffres
 * - longueur 8 à 20
 *
 * Exemples réels : PD62E6DDDB0 (11 caractères).
 * On reste volontairement souple car la FFA ne documente pas
 * officiellement la structure exacte du code PPS.
 */
function validatePpsCode(value) {
  if (!value) return false;
  const cleaned = value.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z0-9]{8,20}$/.test(cleaned);
}

/**
 * JustificatifFfaPps
 *
 * Props:
 * - licenceFfa?: string
 * - ppsCode?: string
 * - disabled?: boolean
 * - onChange?: (payload) => void
 *
 * payload = {
 *   licenceFfa,
 *   licenceFfaValid,
 *   ppsCode,
 *   ppsValid,
 * }
 */
export default function JustificatifFfaPps({
  licenceFfa: initialLicenceFfa = "",
  ppsCode: initialPpsCode = "",
  disabled = false,
  onChange,
}) {
  const [licenceFfa, setLicenceFfa] = useState(initialLicenceFfa);
  const [ppsCode, setPpsCode] = useState(initialPpsCode);

  const licenceFfaValid = validateFfaLicence(licenceFfa);
  const ppsValid = validatePpsCode(ppsCode);

  useEffect(() => {
    if (onChange) {
      onChange({
        licenceFfa,
        licenceFfaValid,
        ppsCode,
        ppsValid,
      });
    }
  }, [licenceFfa, licenceFfaValid, ppsCode, ppsValid, onChange]);

  const baseInputClass =
    "block w-full rounded-xl border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 transition";

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
      {/* En-tête / info */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-blue-50 p-1.5 text-blue-600">
          <Info className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">
            Justificatif fédéral (Licence FFA ou code PPS)
          </h3>
          <p className="text-xs text-neutral-500">
            Tickrace vérifie uniquement le{" "}
            <span className="font-medium">format</span> du numéro de licence
            FFA et du code PPS. La validation officielle (licence valide, PPS
            authentique) reste réalisée par la FFA.
          </p>
        </div>
      </div>

      {/* Licence FFA */}
      <div className="space-y-1">
        <label className="flex items-center justify-between text-xs font-medium text-neutral-700">
          <span>Numéro de licence FFA</span>
          <span className="text-[11px] font-normal text-neutral-400">
            6 à 7 chiffres
          </span>
        </label>

        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            disabled={disabled}
            value={licenceFfa}
            onChange={(e) => setLicenceFfa(e.target.value)}
            placeholder="Ex : 1234567"
            className={`${baseInputClass} ${
              licenceFfa.length === 0
                ? "border-neutral-200 focus:border-blue-500 focus:ring-blue-500/30"
                : licenceFfaValid
                ? "border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/30"
                : "border-rose-400 focus:border-rose-500 focus:ring-rose-500/30"
            } ${disabled ? "bg-neutral-50 text-neutral-400" : "bg-white"}`}
          />

          {licenceFfa.length > 0 && (
            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
              {licenceFfaValid ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-500" />
              )}
            </div>
          )}
        </div>

        {/* Message aide / erreur licence */}
        <p className="text-[11px] text-neutral-500">
          Le numéro doit contenir uniquement des chiffres, sans espaces, sur 6
          ou 7 caractères. En cas de doute, le coureur peut le retrouver sur son
          espace Athlé.
        </p>
        {licenceFfa.length > 0 && !licenceFfaValid && (
          <p className="flex items-center gap-1 text-[11px] font-medium text-rose-600">
            <AlertCircle className="h-3 w-3" />
            Format de licence FFA inhabituel. Vérifie le nombre de chiffres.
          </p>
        )}
      </div>

      {/* Séparateur */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-neutral-200" />
        <span className="text-[11px] uppercase tracking-wide text-neutral-400">
          ou
        </span>
        <div className="h-px flex-1 bg-neutral-200" />
      </div>

      {/* Code PPS */}
      <div className="space-y-1">
        <label className="flex items-center justify-between text-xs font-medium text-neutral-700">
          <span>Code / numéro PPS</span>
          <span className="text-[11px] font-normal text-neutral-400">
            Lettres + chiffres
          </span>
        </label>

        <div className="relative">
          <input
            type="text"
            autoComplete="off"
            disabled={disabled}
            value={ppsCode}
            onChange={(e) => setPpsCode(e.target.value.toUpperCase())}
            placeholder="Ex : PD62E6DDDB0"
            className={`${baseInputClass} uppercase ${
              ppsCode.length === 0
                ? "border-neutral-200 focus:border-blue-500 focus:ring-blue-500/30"
                : ppsValid
                ? "border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/30"
                : "border-rose-400 focus:border-rose-500 focus:ring-rose-500/30"
            } ${disabled ? "bg-neutral-50 text-neutral-400" : "bg-white"}`}
          />

          {ppsCode.length > 0 && (
            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
              {ppsValid ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-500" />
              )}
            </div>
          )}
        </div>

        {/* Message aide / erreur PPS */}
        <p className="text-[11px] text-neutral-500">
          Recopie exactement le code PPS affiché sur ton attestation officielle,
          par exemple{" "}
          <span className="font-mono text-[10px]">PD62E6DDDB0</span>{" "}
          (majuscules, lettres + chiffres, sans espaces). La validité réelle
          est vérifiée par l’organisateur ou via le QR code.
        </p>
        {ppsCode.length > 0 && !ppsValid && (
          <p className="flex items-center gap-1 text-[11px] font-medium text-rose-600">
            <AlertCircle className="h-3 w-3" />
            Format de code PPS inhabituel. Vérifie que tu n’as pas oublié un
            caractère ou ajouté un espace.
          </p>
        )}
      </div>

      {/* Note */}
      <p className="mt-2 text-[11px] text-neutral-400">
        À terme, Tickrace pourra se connecter aux API officielles (licence FFA,
        PPS) pour une vérification en temps réel. En attendant, ce contrôle
        couvre uniquement le format.
      </p>
    </div>
  );
}

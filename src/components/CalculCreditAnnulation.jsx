// src/components/CalculCreditAnnulation.jsx
import React, { useState } from "react";
import { supabase } from "../supabase";

/**
 * Simulation du crédit d'annulation pour une inscription donnée.
 *
 * Logique :
 * - Appel de calculer_credit_annulation(inscription_id) pour récupérer :
 *   - policy_tier, percent, days_before
 * - On applique percent sur le "Total théorique" (totalTheo) calculé dans MonInscription.jsx :
 *     remboursement_theorique = totalTheo * percent / 100
 *
 * Props :
 * - inscriptionId?: string
 * - inscription?: { id: string, ... }
 * - totalTheo?: number   // total théorique en euros (Tickrace)
 */

const euros = (n) => {
  if (n == null || isNaN(Number(n))) return "—";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(Number(n));
  } catch {
    return `${Number(n).toFixed(2)} €`;
  }
};

const POLICY_TIERS = [
  { id: "J-30+", minDays: 30, label: "Annulation 30 jours ou plus avant la course", percent: 90 },
  { id: "J-15-29", minDays: 15, label: "Annulation entre J-15 et J-29", percent: 70 },
  { id: "J-7-14", minDays: 7, label: "Annulation entre J-7 et J-14", percent: 50 },
  { id: "J-3-6", minDays: 3, label: "Annulation entre J-3 et J-6", percent: 30 },
  { id: "J-0-2", minDays: 0, label: "Annulation à moins de 3 jours de la course", percent: 0 },
];

export default function CalculCreditAnnulation({
  inscriptionId,
  inscription,
  totalTheo,
  onSimulated,
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // JSON de calculer_credit_annulation
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null); // infos sur la politique / cas particuliers

  const effectiveInscriptionId =
    inscriptionId || (inscription && inscription.id) || null;

  async function handleSimulate() {
    setError(null);
    setInfo(null);
    setResult(null);

    if (!effectiveInscriptionId) {
      setError(
        "Identifiant d'inscription manquant. Vérifie que l’objet 'insc' contient bien un champ 'id'."
      );
      return;
    }

    setLoading(true);

    try {
      const { data: credit, error: rpcError } = await supabase.rpc(
        "calculer_credit_annulation",
        { inscription_id: effectiveInscriptionId }
      );

      if (rpcError) {
        console.error("SIMULATION_RPC_ERROR", rpcError);
        setError(
          rpcError.message ||
            "Erreur lors du calcul du crédit d'annulation. Réessaie plus tard."
        );
        setLoading(false);
        return;
      }

      if (!credit) {
        setError(
          "Aucun résultat de calcul retourné pour cette inscription (no_credit_result)."
        );
        setLoading(false);
        return;
      }

      const percent = Number(credit.percent ?? 0);
      const policyTier = String(credit.policy_tier ?? "");
      const infoObj = {
        code: percent > 0 ? "ok" : "no_refund_allowed_policy",
        message:
          percent > 0
            ? "Un remboursement est possible selon la politique actuelle. Les montants ci-dessous sont donnés à titre indicatif."
            : "Selon la politique de remboursement appliquée (délai avant la course), le pourcentage de remboursement est de 0 %.",
        policyTier,
        percent,
      };

      setResult(credit);
      setInfo(infoObj);
      if (onSimulated) onSimulated(credit);
    } catch (e) {
      console.error("SIMULATION_FATAL", e);
      setError(
        "Erreur inattendue lors de la simulation. Vérifie la console pour plus de détails."
      );
    } finally {
      setLoading(false);
    }
  }

  const daysBefore = result?.days_before ?? null;
  const policyTier = result?.policy_tier ?? null;
  const percent = result?.percent ?? null;

  const hasTotalTheo =
    typeof totalTheo === "number" && !Number.isNaN(totalTheo);
  const theoreticalBaseEur = hasTotalTheo ? Number(totalTheo) : null;
  const theoreticalRefundEur =
    theoreticalBaseEur != null && percent != null
      ? (theoreticalBaseEur * percent) / 100
      : null;

  function renderPolicyLabel(tierId) {
    const found = POLICY_TIERS.find((t) => t.id === tierId);
    return found ? found.label : tierId || "Politique non déterminée";
  }

  return (
    <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 shadow-sm">
      <div className="p-4 border-b border-amber-100 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-amber-900">
            Simulation du crédit d&apos;annulation
          </h2>
          <p className="text-xs sm:text-sm text-amber-800">
            Utilise la même politique que le remboursement réel (délai avant la
            course), mais applique le pourcentage sur le{" "}
            <b>Total théorique</b> affiché dans le récapitulatif ci-dessus.
            Aucun remboursement réel n&apos;est déclenché.
          </p>
          {!effectiveInscriptionId && (
            <p className="mt-1 text-[11px] text-red-700">
              ⚠ Aucun identifiant d&apos;inscription disponible
              (<code className="bg-red-100 px-1 py-0.5 rounded ml-1">
                inscriptionId / inscription.id
              </code>{" "}
              est vide).
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleSimulate}
          disabled={loading || !effectiveInscriptionId}
          className={`inline-flex items-center justify-center rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white transition
            ${
              loading || !effectiveInscriptionId
                ? "bg-amber-300 cursor-not-allowed"
                : "bg-amber-600 hover:bg-amber-700"
            }`}
        >
          {loading ? "Calcul en cours…" : "Simuler maintenant"}
        </button>
      </div>

      <div className="p-4 space-y-3 text-sm">
        {error && (
          <div className="rounded-xl border border-red-300 bg-red-100 px-3 py-2 text-sm text-red-900">
            {error}
          </div>
        )}

        {info && (
          <div
            className={`rounded-xl px-3 py-2 text-xs sm:text-sm ${
              info.code === "ok"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border border-amber-300 bg-amber-100 text-amber-900"
            }`}
          >
            <p className="font-medium">{info.message}</p>
            {info.policyTier && (
              <p className="mt-1">
                Politique appliquée :{" "}
                <b>
                  {renderPolicyLabel(info.policyTier)} ({info.policyTier})
                </b>{" "}
                – {info.percent ?? 0}%.
              </p>
            )}
          </div>
        )}

        {!result && !error && !info && (
          <p className="text-xs sm:text-sm text-neutral-700">
            Clique sur <b>« Simuler maintenant »</b> pour voir le détail du
            calcul en fonction de ta situation actuelle.
          </p>
        )}

        {result && (
          <>
            {/* Résumé du cas actuel */}
            <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-xs sm:text-sm space-y-2">
              {daysBefore != null && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">
                    Jours restants avant la course
                  </span>
                  <span className="font-medium">
                    {daysBefore} jour{daysBefore > 1 ? "s" : ""}
                  </span>
                </div>
              )}

              {policyTier && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">Tranche appliquée</span>
                  <span className="font-medium">
                    {renderPolicyLabel(policyTier)} ({policyTier})
                  </span>
                </div>
              )}

              {percent != null && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">
                    Pourcentage de remboursement
                  </span>
                  <span className="font-medium">{percent} %</span>
                </div>
              )}
            </div>

            {/* Calcul théorique basé sur Total théorique */}
            <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-xs sm:text-sm space-y-2">
              <div className="text-sm font-semibold text-neutral-800 mb-1">
                Calcul théorique (basé sur le Total théorique Tickrace)
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Total théorique</span>
                <span className="font-medium">
                  {hasTotalTheo ? euros(theoreticalBaseEur) : "—"}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-neutral-600">Pourcentage appliqué</span>
                <span className="font-medium">
                  {percent != null ? `${percent} %` : "—"}
                </span>
              </div>

              <div className="h-px bg-neutral-200 my-1" />

              <div className="flex justify-between text-sm">
                <span className="font-semibold">
                  Remboursement théorique (simulation)
                </span>
                <span className="font-bold text-emerald-700">
                  {theoreticalRefundEur != null
                    ? euros(theoreticalRefundEur)
                    : "—"}
                </span>
              </div>
            </div>

            {/* Rappel complet de la politique d'annulation */}
            <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-xs sm:text-sm space-y-2">
              <div className="text-sm font-semibold text-neutral-800 mb-2">
                Rappel de la politique d&apos;annulation
              </div>
              <ul className="space-y-1.5">
                {POLICY_TIERS.map((tier) => {
                  const isCurrent = tier.id === policyTier;
                  return (
                    <li
                      key={tier.id}
                      className={`flex items-center justify-between rounded-lg px-2 py-1 ${
                        isCurrent
                          ? "bg-amber-50 ring-1 ring-amber-200"
                          : "bg-neutral-50"
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-neutral-800">
                          {tier.label}
                        </span>
                        <span className="text-[11px] text-neutral-500">
                          Code : {tier.id}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-semibold ${
                          isCurrent
                            ? "text-amber-800"
                            : "text-neutral-700"
                        }`}
                      >
                        {tier.percent} %
                        {isCurrent && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide">
                            (cas actuel)
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <details className="text-[11px] text-neutral-500">
              <summary className="cursor-pointer select-none">
                Détails techniques (JSON brut retourné par
                calculer_credit_annulation)
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-neutral-900 p-3 text-[10px] text-neutral-100">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </>
        )}
      </div>
    </section>
  );
}

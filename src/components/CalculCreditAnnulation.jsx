// src/components/CalculCreditAnnulation.jsx
import React, { useState } from "react";
import { supabase } from "../supabase";

/**
 * Simulation du crédit d'annulation pour une inscription donnée.
 *
 * Basé sur la même logique que l'Edge Function `refund-inscription` :
 * 1) Appel de calculer_credit_annulation(inscription_id)
 * 2) Contrôles :
 *    - pas de résultat -> "no_credit_result"
 *    - pas de paiement lié -> "no_payment_for_inscription"
 *    - refund_cents <= 0 ou percent <= 0 -> "no_refund_allowed"
 *
 * Props possibles :
 * - inscriptionId?: string (uuid de l'inscription)
 * - inscription?: { id: string, ... }  // utilisé si inscriptionId est absent
 * - format?: any            // gardé pour compat éventuelle (non utilisé ici)
 * - paiements?: any[]       // idem
 * - onSimulated?: (data) => void
 */
export default function CalculCreditAnnulation({
  inscriptionId,
  inscription,
  format,
  paiements,
  onSimulated,
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // JSON de calculer_credit_annulation
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null); // messages "no_refund_allowed", etc.

  // On accepte inscriptionId OU inscription.id
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
      // 1) Calcul de la politique + montants via la fonction SQL
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
        // même logique que "no_credit_result"
        setError(
          "Aucun résultat de calcul retourné pour cette inscription (no_credit_result)."
        );
        setLoading(false);
        return;
      }

      // Extraction des champs de la même façon que refund-inscription
      const refundCents = Number(credit.refund_cents ?? 0);
      const totalCents = Number(
        credit.base_cents ?? credit.amount_total_cents ?? 0
      );
      const percent = Number(credit.percent ?? 0);
      const policyTier = String(credit.policy_tier ?? "");
      const paiementId = credit.paiement_id
        ? String(credit.paiement_id)
        : "";

      // 1bis) Pas de paiement -> no_payment_for_inscription
      if (!paiementId) {
        setResult(credit);
        setInfo({
          code: "no_payment_for_inscription",
          message:
            "Aucun paiement validé n'est associé à cette inscription. La simulation de remboursement n'est pas possible.",
          policyTier,
          percent,
        });
        setLoading(false);
        if (onSimulated) onSimulated(credit);
        return;
      }

      // 2) Pas de remboursement autorisé -> no_refund_allowed
      if (refundCents <= 0 || totalCents <= 0 || percent <= 0) {
        setResult(credit);
        setInfo({
          code: "no_refund_allowed",
          message:
            "Selon la politique de remboursement appliquée, aucun remboursement n'est prévu pour cette inscription.",
          policyTier,
          percent,
        });
        setLoading(false);
        if (onSimulated) onSimulated(credit);
        return;
      }

      // 3) Cas normal : remboursement possible
      setResult(credit);
      setInfo({
        code: "ok",
        message: "Un remboursement est possible selon la politique actuelle.",
        policyTier,
        percent,
      });

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

  // Champs utiles pour l’affichage détaillé
  const daysBefore = result?.days_before ?? null;
  const policyTier = result?.policy_tier ?? null;
  const percent = result?.percent ?? null;

  const amountTotalCents = result?.amount_total_cents ?? null;
  const baseCents = result?.base_cents ?? null;
  const refundCents = result?.refund_cents ?? null;
  const nonRefCents = result?.non_refundable_cents ?? null;

  const paiementId = result?.paiement_id ?? null;

  const toEur = (cents) =>
    cents == null ? null : (Number(cents) / 100).toFixed(2);

  function renderPolicyLabel(tier) {
    switch (tier) {
      case "J-30+":
        return "Annulation 30 jours ou plus avant la course";
      case "J-15-29":
        return "Annulation entre J-15 et J-29";
      case "J-7-14":
        return "Annulation entre J-7 et J-14";
      case "J-3-6":
        return "Annulation entre J-3 et J-6";
      case "J-0-2":
        return "Annulation à moins de 3 jours de la course";
      default:
        return tier || "Politique non déterminée";
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 shadow-sm">
      <div className="p-4 border-b border-amber-100 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-amber-900">
            Simulation du crédit d&apos;annulation
          </h2>
          <p className="text-xs sm:text-sm text-amber-800">
            Utilise la même politique que le remboursement réel : la date de la
            course et le montant payé (inscription + options). Cette simulation
            ne déclenche <b>aucun remboursement</b>.
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
            {/* Résumé politique */}
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

            {/* Détail des montants */}
            <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-xs sm:text-sm space-y-2">
              {amountTotalCents != null && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">
                    Montant total payé (Stripe)
                  </span>
                  <span className="font-medium">
                    {toEur(amountTotalCents)} €
                  </span>
                </div>
              )}

              {baseCents != null && baseCents !== amountTotalCents && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">
                    Base de calcul (après ajustements)
                  </span>
                  <span className="font-medium">
                    {toEur(baseCents)} €
                  </span>
                </div>
              )}

              {refundCents != null && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">
                    Montant remboursable théorique
                  </span>
                  <span
                    className={`font-medium ${
                      refundCents > 0
                        ? "text-emerald-700"
                        : "text-neutral-700"
                    }`}
                  >
                    {toEur(refundCents)} €
                  </span>
                </div>
              )}

              {nonRefCents != null && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">
                    Part non remboursée (frais, etc.)
                  </span>
                  <span className="font-medium text-red-700">
                    {toEur(nonRefCents)} €
                  </span>
                </div>
              )}

              <div className="h-px bg-neutral-200 my-1" />

              {refundCents != null && amountTotalCents != null && (
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">
                    Crédit potentiel en cas d&apos;annulation
                  </span>
                  <span className="font-bold">
                    {toEur(refundCents)} €
                  </span>
                </div>
              )}
            </div>

            {/* Info paiement / debug */}
            {paiementId && (
              <p className="text-[11px] text-neutral-500">
                Paiement source : <code>{paiementId}</code>
              </p>
            )}

            <details className="text-[11px] text-neutral-500">
              <summary className="cursor-pointer select-none">
                Détails techniques (JSON brut retourné par calculer_credit_annulation)
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

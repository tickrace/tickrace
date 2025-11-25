// src/components/CalculCreditAnnulation.jsx
import React, { useState } from "react";
import { supabase } from "../supabase";

/**
 * Simulation du crédit d'annulation pour une inscription donnée.
 *
 * Fonction SQL:
 *   calculer_credit_annulation(inscription_id uuid) RETURNS jsonb :
 * {
 *   policy_tier: 'J-30+' | 'J-15-29' | 'J-7-14' | 'J-3-6' | 'J-0-2',
 *   percent: 90,
 *   days_before: 42,
 *   amount_total_cents: 12345,
 *   base_cents: 12345,
 *   refund_cents: 11111,
 *   non_refundable_cents: 1234,
 *   paiement_id: '...'
 * }
 *
 * Props possibles :
 * - inscriptionId?: string (uuid de l'inscription)
 * - inscription?: { id: string, ... }  (utilisé si inscriptionId est absent)
 * - format?: any            // pour affichage éventuel plus tard (pas utilisé ici)
 * - paiements?: any[]       // idem
 * - onSimulated?: (data) => void
 */
export default function CalculCreditAnnulation({
  inscriptionId,
  inscription,
  format,      // non utilisé pour l'instant mais gardé pour compat
  paiements,   // idem
  onSimulated,
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // on accepte inscriptionId OU inscription.id
  const effectiveInscriptionId =
    inscriptionId || (inscription && inscription.id) || null;

  async function handleSimulate() {
    if (!effectiveInscriptionId) {
      setError(
        "Identifiant d'inscription manquant. Vérifie que l'objet 'inscription' contient bien un champ 'id'."
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "calculer_credit_annulation",
        { inscription_id: effectiveInscriptionId }
      );

      if (rpcError) {
        console.error("❌ calculer_credit_annulation error:", rpcError);
        setError(
          rpcError.message ||
            "Erreur lors du calcul du crédit d'annulation. Réessaie plus tard."
        );
        setLoading(false);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      setResult(row || null);
      if (onSimulated && row) onSimulated(row);
    } catch (e) {
      console.error(e);
      setError("Erreur inattendue lors de la simulation.");
    } finally {
      setLoading(false);
    }
  }

  // champs renvoyés par ta fonction
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
    <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 shadow-sm">
      <div className="p-5 border-b border-amber-100 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-amber-900">
            Simulation du crédit d&apos;annulation
          </h2>
          <p className="text-sm text-amber-800">
            Calcule le montant qui pourrait être crédité en cas d&apos;annulation,
            selon la date de la course et les montants payés (inscription + options).
            Cette simulation ne modifie pas ton inscription.
          </p>
          {!effectiveInscriptionId && (
            <p className="mt-1 text-xs text-red-700">
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
          className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition
            ${
              loading || !effectiveInscriptionId
                ? "bg-amber-300 cursor-not-allowed"
                : "bg-amber-600 hover:bg-amber-700"
            }`}
        >
          {loading
            ? "Calcul en cours…"
            : "Simuler mon crédit d'annulation"}
        </button>
      </div>

      <div className="p-5 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-300 bg-red-100 px-3 py-2 text-sm text-red-900">
            {error}
          </div>
        )}

        {!result && !error && (
          <p className="text-sm text-neutral-700">
            Clique sur <b>« Simuler mon crédit d&apos;annulation »</b> pour voir
            le détail du calcul en fonction de ta situation actuelle.
          </p>
        )}

        {result && (
          <>
            {/* Résumé politique */}
            <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm space-y-2">
              {daysBefore != null && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">
                    Jours restants avant la course
                  </span>
                  <span className="font-medium">
                    {daysBefore} jour
                    {daysBefore > 1 ? "s" : ""}
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

            {/* Détail du calcul */}
            <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm space-y-2">
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
                    Base de calcul (après ajustements éventuels)
                  </span>
                  <span className="font-medium">
                    {toEur(baseCents)} €
                  </span>
                </div>
              )}

              {refundCents != null && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">
                    Montant remboursé / crédité
                  </span>
                  <span className="font-medium text-emerald-700">
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
                <div className="flex justify-between text-base">
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
              <p className="text-xs text-neutral-500">
                Paiement source : <code>{paiementId}</code>
              </p>
            )}

            <details className="text-xs text-neutral-500">
              <summary className="cursor-pointer select-none">
                Détails techniques (JSON brut retourné par la fonction)
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-neutral-900 p-3 text-[11px] text-neutral-100">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </>
        )}
      </div>
    </section>
  );
}

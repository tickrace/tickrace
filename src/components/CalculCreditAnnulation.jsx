// src/components/CalculCreditAnnulation.jsx
import React, { useState } from "react";
import { supabase } from "../supabase";

/**
 * Simulation du crédit d'annulation pour une inscription donnée.
 *
 * Logique :
 * - On appelle la fonction SQL calculer_credit_annulation(inscription_id)
 *   pour récupérer :
 *   - policy_tier, percent, days_before
 *   - les montants basés sur la table paiements (amount_total_cents, refund_cents, etc.)
 *
 * - Pour la SIMULATION, on applique percent sur le "Total théorique" calculé côté
 *   page MonInscription (totalTheo), passé en props :
 *     remboursement_theorique = totalTheo * percent / 100
 *
 * Props :
 * - inscriptionId?: string
 * - inscription?: { id: string, ... }   // utilise inscription.id si inscriptionId absent
 * - format?: any
 * - paiements?: any[]
 * - totalTheo?: number   // 👈 total théorique en euros (Tickrace)
 * - onSimulated?: (data) => void
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

export default function CalculCreditAnnulation({
  inscriptionId,
  inscription,
  format,
  paiements,
  totalTheo,
  onSimulated,
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // JSON de calculer_credit_annulation
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null); // infos sur la politique / cas particuliers

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
      // 1) Appel de la fonction SQL
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

      // 2) Extraction comme dans refund-inscription
      const refundCents = Number(credit.refund_cents ?? 0);
      const totalCents = Number(
        credit.base_cents ?? credit.amount_total_cents ?? 0
      );
      const percent = Number(credit.percent ?? 0);
      const policyTier = String(credit.policy_tier ?? "");
      const paiementId = credit.paiement_id
        ? String(credit.paiement_id)
        : "";

      const policyAllowsRefund = percent > 0;
      const hasStripeBase = totalCents > 0;

      let infoObj = null;

      if (!paiementId) {
        infoObj = {
          code: "no_payment_for_inscription",
          message:
            "Aucun paiement validé n'est associé à cette inscription. Le montant affiché comme 'Stripe' sera nul, mais la simulation théorique reste basée sur le total Tickrace.",
          policyTier,
          percent,
        };
      } else if (!policyAllowsRefund) {
        infoObj = {
          code: "no_refund_allowed_policy",
          message:
            "Selon la politique de remboursement appliquée (délai avant la course), le pourcentage de remboursement est de 0 %.",
          policyTier,
          percent,
        };
      } else if (!hasStripeBase) {
        infoObj = {
          code: "no_stripe_amount",
          message:
            "Le paiement Stripe associé ne contient pas de montant exploitable. La simulation se base uniquement sur le Total théorique.",
          policyTier,
          percent,
        };
      } else {
        infoObj = {
          code: "ok",
          message:
            "Un remboursement est possible selon la politique actuelle. Les montants affichés reflètent à la fois le Total théorique et les données Stripe.",
          policyTier,
          percent,
        };
      }

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

  // Champs renvoyés par la fonction SQL
  const daysBefore = result?.days_before ?? null;
  const policyTier = result?.policy_tier ?? null;
  const percent = result?.percent ?? null;

  const amountTotalCents = result?.amount_total_cents ?? null;
  const baseCents = result?.base_cents ?? null;
  const refundCents = result?.refund_cents ?? null;
  const nonRefCents = result?.non_refundable_cents ?? null;
  const paiementId = result?.paiement_id ?? null;

  // --- Partie "théorique" basée sur totalTheo ---
  const hasTotalTheo =
    typeof totalTheo === "number" && !Number.isNaN(totalTheo);

  const theoreticalBaseEur = hasTotalTheo ? Number(totalTheo) : null;
  const theoreticalRefundEur =
    theoreticalBaseEur != null && percent != null
      ? (theoreticalBaseEur * percent) / 100
      : null;

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

            {/* Bloc théorique basé sur Total théorique */}
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

            {/* Bloc Stripe réel (si les montants existent) */}
            <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-xs sm:text-sm space-y-2">
              <div className="text-sm font-semibold text-neutral-800 mb-1">
                Données Stripe (paiement réel)
              </div>

              {amountTotalCents != null && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">
                    Montant total payé (Stripe)
                  </span>
                  <span className="font-medium">
                    {euros(amountTotalCents / 100)}
                  </span>
                </div>
              )}

              {baseCents != null && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">
                    Base de calcul Stripe
                  </span>
                  <span className="font-medium">
                    {euros(baseCents / 100)}
                  </span>
                </div>
              )}

              {refundCents != null && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">
                    Montant remboursable calculé (Stripe)
                  </span>
                  <span className="font-medium">
                    {euros(refundCents / 100)}
                  </span>
                </div>
              )}

              {nonRefCents != null && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">
                    Part non remboursée (Stripe)
                  </span>
                  <span className="font-medium text-red-700">
                    {euros(nonRefCents / 100)}
                  </span>
                </div>
              )}

              {paiementId && (
                <p className="mt-2 text-[11px] text-neutral-500">
                  Paiement source : <code>{paiementId}</code>
                </p>
              )}
            </div>

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

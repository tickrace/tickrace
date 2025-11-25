// src/components/CalculCreditAnnulation.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

function eurosFromCents(cents) {
  if (cents == null || isNaN(Number(cents))) return "0,00 €";
  const eur = Number(cents) / 100;
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(eur);
  } catch {
    return eur.toFixed(2) + " €";
  }
}

/**
 * props:
 * - inscriptionId: uuid de l'inscription
 * - fallbackBaseEuros?: montant théorique en euros (ex: totalTheo de MonInscription)
 */
export default function CalculCreditAnnulation({ inscriptionId, fallbackBaseEuros }) {
  const [loading, setLoading] = useState(false);
  const [sim, setSim] = useState(null); // JSON renvoyé par la fonction
  const [error, setError] = useState("");

  const fetchSimulation = async () => {
    if (!inscriptionId) return;
    setLoading(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "calculer_credit_annulation",
        { inscription_id: inscriptionId }
      );

      if (rpcError) {
        console.error("RPC calculer_credit_annulation:", rpcError);
        setError(rpcError.message || "Erreur lors du calcul de l’annulation.");
        setSim(null);
      } else {
        setSim(data || null);
      }
    } catch (e) {
      console.error(e);
      setError(e.message || "Erreur lors du calcul de l’annulation.");
      setSim(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inscriptionId]);

  if (!inscriptionId) return null;

  const policyTier = sim?.policy_tier || "—";
  const percent = typeof sim?.percent === "number" ? sim.percent : null;
  const daysBefore = typeof sim?.days_before === "number" ? sim.days_before : null;

  // 1) base en cents renvoyée par la fonction
  let baseCents = sim?.base_cents ?? sim?.amount_total_cents ?? 0;

  // 2) Fallback: si la fonction renvoie 0 mais que tu as un montant théorique côté front
  if ((!baseCents || baseCents <= 0) && fallbackBaseEuros != null) {
    baseCents = Math.round(Number(fallbackBaseEuros || 0) * 100);
  }

  // 3) Montants remboursé / non remboursable
  let refundCents = sim?.refund_cents;
  let nonRefundCents = sim?.non_refundable_cents;

  // Si la fonction n'a pas mis ces champs (ou qu'ils sont à null) mais qu'on a une base,
  // on recalcule à partir du pourcentage.
  if ((refundCents == null || nonRefundCents == null) && baseCents > 0) {
    const pct = percent || 0;
    refundCents = Math.round((baseCents * pct) / 100);
    nonRefundCents = baseCents - refundCents;
  }

  const noPayment =
    sim &&
    (sim.amount_total_cents === 0 || sim.base_cents === 0) &&
    !fallbackBaseEuros; // vrai "pas de paiement du tout"

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-neutral-600">
          Basée sur la date actuelle et la politique d’annulation.
          {typeof daysBefore === "number" && (
            <> (J-{daysBefore})</>
          )}
        </div>
        <button
          type="button"
          onClick={fetchSimulation}
          disabled={loading}
          className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
        >
          {loading ? "Calcul…" : "Recalculer"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Palier
          </div>
          <div className="mt-1 font-semibold">{policyTier}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Taux appliqué
          </div>
          <div className="mt-1 font-semibold">
            {percent != null ? `${percent} %` : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Montant payé (base)
          </div>
          <div className="mt-1 font-semibold">
            {baseCents > 0 ? eurosFromCents(baseCents) : "0,00 €"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="rounded-xl bg-emerald-50 px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-emerald-700">
            Part remboursée (estimée)
          </div>
          <div className="mt-1 text-base font-semibold text-emerald-800">
            {refundCents != null ? eurosFromCents(refundCents) : "0,00 €"}
          </div>
        </div>
        <div className="rounded-xl bg-amber-50 px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-amber-700">
            Part non remboursable
          </div>
          <div className="mt-1 text-base font-semibold text-amber-800">
            {nonRefundCents != null ? eurosFromCents(nonRefundCents) : "0,00 €"}
          </div>
        </div>
      </div>

      {noPayment && (
        <p className="text-xs text-neutral-500">
          Aucun paiement confirmé n’a été trouvé pour cette inscription. La simulation
          reste basée sur le palier ({policyTier}), mais aucun remboursement réel ne sera
          possible tant qu’aucun paiement Stripe n’est associé.
        </p>
      )}

      <p className="text-xs text-neutral-500">
        Ce calcul est indicatif. Le remboursement réel n’est déclenché que lorsque
        vous cliquez sur « Annuler mon inscription ».
      </p>
    </div>
  );
}

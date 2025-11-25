// src/components/CalculCreditAnnulation.jsx
import React, { useEffect, useState, useCallback } from "react";

/** Formatage euros à partir de centimes */
function eurosFromCents(cents) {
  const n = Number(cents || 0);
  if (!Number.isFinite(n)) return "0,00 €";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(n / 100);
  } catch {
    return (n / 100).toFixed(2) + " €";
  }
}

/** Calcul du nombre de jours avant la course (J-xx) */
function computeDaysBefore(format) {
  if (!format?.date) return 0;
  const today = new Date();
  const dEvent = new Date(format.date);

  const t0 = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const t1 = Date.UTC(
    dEvent.getFullYear(),
    dEvent.getMonth(),
    dEvent.getDate()
  );
  const diffDays = Math.round((t1 - t0) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/** Politique d’annulation (même logique que la fonction SQL calculer_credit_annulation) */
function computePolicy(daysBefore) {
  if (daysBefore >= 30) return { tier: "J-30+", percent: 90 };
  if (daysBefore >= 15) return { tier: "J-15-29", percent: 70 };
  if (daysBefore >= 7) return { tier: "J-7-14", percent: 50 };
  if (daysBefore >= 3) return { tier: "J-3-6", percent: 30 };
  return { tier: "J-0-2", percent: 0 };
}

/** Sélectionne le paiement principal pour cette inscription */
function pickMainPayment(paiements = []) {
  if (!Array.isArray(paiements) || paiements.length === 0) return null;

  const valides = paiements.filter((p) => {
    const s = (p.status || "").toLowerCase();
    return (
      s.includes("paye") ||
      s.includes("payé") ||
      s === "paid" ||
      s === "succeeded"
    );
  });

  if (!valides.length) return null;

  // on prend le plus récent
  return [...valides].sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() -
      new Date(a.created_at || 0).getTime()
  )[0];
}

/** Calcule le montant de base en centimes à partir d’un paiement */
function computeBaseCentsFromPayment(p) {
  if (!p) return 0;
  if (p.total_amount_cents != null) return Number(p.total_amount_cents) || 0;
  if (p.amount_total != null) return Number(p.amount_total) || 0;
  if (p.montant_total != null)
    return Math.round(Number(p.montant_total) * 100) || 0;
  return 0;
}

/**
 * props:
 *  - inscription: ligne d’inscription (optionnel, juste pour contexte si besoin plus tard)
 *  - format: ligne de format (doit contenir au moins .date)
 *  - paiements: tableau des paiements liés à cette inscription (payInfos.paiements)
 */
export default function CalculCreditAnnulation({ inscription, format, paiements }) {
  const [loading, setLoading] = useState(false);
  const [sim, setSim] = useState({
    daysBefore: 0,
    policyTier: "J-0-2",
    percent: 0,
    baseCents: 0,
    refundCents: 0,
    nonRefCents: 0,
    hasPayment: false,
  });

  const recalc = useCallback(() => {
    setLoading(true);
    try {
      const daysBefore = computeDaysBefore(format);
      const { tier, percent } = computePolicy(daysBefore);

      const mainPayment = pickMainPayment(paiements);
      const baseCents = computeBaseCentsFromPayment(mainPayment);

      const refundCents = Math.round((baseCents * percent) / 100);
      const nonRefCents = baseCents - refundCents;

      setSim({
        daysBefore,
        policyTier: tier,
        percent,
        baseCents,
        refundCents,
        nonRefCents,
        hasPayment: !!mainPayment && baseCents > 0,
      });
    } finally {
      setLoading(false);
    }
  }, [format, paiements]);

  // Recalcul initial + à chaque changement d’inscription/format/paiements
  useEffect(() => {
    recalc();
  }, [recalc]);

  const jLabel =
    sim.daysBefore > 0 ? `J-${sim.daysBefore}` : "Jour J ou passé";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-600">
            Basée sur la date actuelle et la politique d’annulation. ({jLabel})
          </p>
        </div>
        <button
          type="button"
          onClick={recalc}
          disabled={loading}
          className={`inline-flex items-center rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-semibold ${
            loading
              ? "bg-neutral-100 text-neutral-400 cursor-not-allowed"
              : "bg-white text-neutral-900 hover:bg-neutral-50"
          }`}
        >
          {loading ? "Calcul…" : "Recalculer"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
            Palier
          </div>
          <div className="mt-1 text-base font-semibold">
            {sim.policyTier}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
            Taux appliqué
          </div>
          <div className="mt-1 text-base font-semibold">
            {sim.percent} %
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
            Montant payé (base)
          </div>
          <div className="mt-1 text-base font-semibold">
            {eurosFromCents(sim.baseCents)}
          </div>
        </div>
      </div>

      {/* Bandeau remboursable / non remboursable */}
      <div className="rounded-2xl overflow-hidden ring-1 ring-neutral-200 flex flex-col sm:flex-row text-sm">
        <div className="flex-1 bg-emerald-50 px-4 py-3 border-b sm:border-b-0 sm:border-r border-emerald-100">
          <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
            Part remboursée (estimée)
          </div>
          <div className="mt-1 text-lg font-bold text-emerald-900">
            {eurosFromCents(sim.refundCents)}
          </div>
        </div>
        <div className="flex-1 bg-amber-50 px-4 py-3">
          <div className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
            Part non remboursable
          </div>
          <div className="mt-1 text-lg font-bold text-amber-900">
            {eurosFromCents(sim.nonRefCents)}
          </div>
        </div>
      </div>

      {/* Message d’info */}
      <p className="text-xs text-neutral-500 leading-relaxed">
        {sim.hasPayment ? (
          <>
            Ce calcul est indicatif. Le remboursement réel sera déclenché
            uniquement si vous cliquez sur{" "}
            <strong>« Annuler mon inscription »</strong>, et sera effectué
            via Stripe conformément à la politique d’annulation en vigueur.
          </>
        ) : (
          <>
            Aucun paiement confirmé n’a été trouvé pour cette inscription.
            La simulation utilise bien le palier <strong>{sim.policyTier}</strong>, 
            mais aucun remboursement réel ne sera possible tant qu’aucun
            paiement Stripe n’est associé.
          </>
        )}
      </p>
    </div>
  );
}

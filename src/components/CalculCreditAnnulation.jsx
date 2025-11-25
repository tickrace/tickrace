// src/components/CalculCreditAnnulation.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

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
  isCanceled = false,
}) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  async function fetchPreview() {
    if (!inscriptionId || isCanceled) return;
    setLoading(true);
    setError("");
    try {
      const { data, error } = await supabase.rpc(
        "calculer_credit_annulation",
        { inscription_id: inscriptionId }
      );
      if (error) throw error;

      // data est ce que renvoie ta fonction SQL (type "remboursements" dans notre logique)
      setPreview(data);
    } catch (e) {
      console.error("REFUND_PREVIEW_ERROR", e);
      setError(
        e?.message || "Impossible de calculer le remboursement estimé."
      );
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!inscriptionId || isCanceled) return;
    fetchPreview();
  }, [inscriptionId, isCanceled]);

  if (isCanceled) {
    return (
      <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-neutral-800 mb-2">
          Simulation de remboursement
        </h3>
        <p className="text-sm text-neutral-600">
          L’inscription est déjà annulée. Le calcul de remboursement a été
          effectué au moment de l’annulation.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-800">
            Simulation de remboursement (indicatif)
          </h3>
          <p className="text-xs text-neutral-500">
            Basée sur la date actuelle et la politique d’annulation.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchPreview}
          disabled={loading || !inscriptionId}
          className="text-xs rounded-lg border border-neutral-300 px-2.5 py-1.5 text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
        >
          Recalculer
        </button>
      </div>

      {loading && (
        <p className="text-sm text-neutral-500">
          Calcul du remboursement estimé…
        </p>
      )}

      {!loading && error && (
        <p className="text-sm text-rose-700">{error}</p>
      )}

      {!loading && !error && !preview && (
        <p className="text-sm text-neutral-500">
          Aucun remboursement n’est prévu pour cette inscription selon la
          politique actuelle.
        </p>
      )}

      {!loading && !error && preview && (() => {
        const baseCents = Number(
          preview.base_cents ??
          preview.amount_total_cents ??
          0
        );

        const refundCents = Number(preview.refund_cents ?? 0);

        const nonRefCents = Number(
          preview.non_refundable_cents ??
          Math.max(baseCents - refundCents, 0)
        );

        const percent = preview.percent ?? null;
        const policyTier = preview.policy_tier || preview.policy || null;
        const joursAvant = preview.jours_avant_course ?? null;

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 text-sm">
            <div className="space-y-1">
              {joursAvant != null && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">
                    Jours avant la course
                  </span>
                  <span className="font-medium">{joursAvant}</span>
                </div>
              )}
              {policyTier && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">Palier</span>
                  <span className="font-medium">{policyTier}</span>
                </div>
              )}
              {percent != null && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">
                    Taux appliqué
                  </span>
                  <span className="font-medium">{percent} %</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-neutral-600">
                  Montant payé (base)
                </span>
                <span className="font-medium">
                  {euros(baseCents / 100)}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-neutral-600">
                  Part remboursée (estimée)
                </span>
                <span className="font-medium">
                  {euros(refundCents / 100)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">
                  Part non remboursable
                </span>
                <span className="font-medium">
                  {euros(nonRefCents / 100)}
                </span>
              </div>
            </div>

            <div className="sm:col-span-2 text-xs text-neutral-500 mt-1">
              Ce calcul est indicatif. Le remboursement sera réellement
              déclenché seulement si vous cliquez sur{" "}
              <strong>« Annuler mon inscription »</strong>.
            </div>
          </div>
        );
      })()}
    </section>
  );
}

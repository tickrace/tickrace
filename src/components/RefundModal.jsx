// src/components/RefundModal.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

function eur(cents) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default function RefundModal({ inscriptionId, open, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);

  const [reason, setReason] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let abort = false;
    if (!open) return;
    (async () => {
      setLoading(true);
      setError(null);
      setQuote(null);
      setReason("");
      setAccepted(false);
      try {
        const { data, error } = await supabase.functions.invoke("refunds", {
          body: { inscription_id: inscriptionId, action: "quote" },
        });
        if (abort) return;
        if (error) throw error;
        setQuote(data?.quote ?? null);
      } catch (e) {
        if (!abort) setError(e?.message ?? String(e));
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
  }, [open, inscriptionId]);

  async function confirmRefund() {
    try {
      setSubmitting(true);
      setError(null);
      const { data, error } = await supabase.functions.invoke("refunds", {
        body: { inscription_id: inscriptionId, action: "confirm", reason },
      });
      if (error) throw error;
      onSuccess?.(data);
      onClose?.();
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const disabledByTier = quote && (quote.percent === 0 || quote.refund_cents <= 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">Annuler et demander un remboursement</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900"
            aria-label="Fermer"
            title="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="py-8 text-center text-gray-600">Calcul du montant…</div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">{error}</div>
          ) : quote ? (
            <>
              <div className="text-sm text-gray-700 space-y-1 mb-4">
                <div>Montant payé : <b>{eur(quote.amount_total_cents)}</b></div>
                <div>Frais non remboursables (Stripe + Tickrace) : <b>{eur(quote.non_refundable_cents)}</b></div>
                <div>Base remboursable : <b>{eur(quote.base_cents)}</b></div>
                <div>
                  Palier appliqué : <b>{quote.percent}%</b>{" "}
                  <span className="text-gray-500">
                    (barème : &gt;30j 90% • 15–29j 50% • 7–14j 25% • &lt;7j 0%)
                  </span>
                </div>
                <div className="text-lg">
                  Montant remboursé : <b>{eur(quote.refund_cents)}</b>
                </div>
                {quote.days_before !== undefined && (
                  <div className="text-xs text-gray-500">Jours restants avant l’épreuve : {quote.days_before}</div>
                )}
                {disabledByTier && (
                  <div className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
                    À ce stade du barème, aucun remboursement n’est prévu.
                  </div>
                )}
              </div>

              <div className="grid gap-3 mb-3">
                <label className="block text-sm">
                  Motif (facultatif)
                  <select
                    className="mt-1 w-full border rounded px-2 py-1"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  >
                    <option value="">— Choisir —</option>
                    <option value="Blessure">Blessure</option>
                    <option value="Indisponibilité">Indisponibilité</option>
                    <option value="Erreur de commande">Erreur de commande</option>
                    <option value="Autre">Autre</option>
                  </select>
                </label>

                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  <span>
                    J’ai lu et j’accepte la{" "}
                    <a
                      href="/legal/remboursements"
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      Politique de remboursement
                    </a>
                    .
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="px-3 py-2 rounded border">
                  Retour
                </button>
                <button
                  onClick={confirmRefund}
                  className={`px-3 py-2 rounded text-white ${
                    disabledByTier || !accepted || submitting
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-black hover:bg-gray-800"
                  }`}
                  disabled={disabledByTier || !accepted || submitting}
                >
                  {submitting ? "Traitement…" : "Confirmer l’annulation"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

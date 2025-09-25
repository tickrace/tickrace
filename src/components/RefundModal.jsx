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

  // Charger le devis quand le modal s'ouvre
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

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      abort = true;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, inscriptionId, onClose]);

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
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-neutral-900/60 p-0 sm:p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <button
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Fermer"
        tabIndex={-1}
      />

      <div className="relative w-full sm:max-w-xl bg-white rounded-2xl shadow-2xl ring-1 ring-neutral-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-neutral-900 text-white px-3 py-1 text-[11px] ring-1 ring-black/10">
              Remboursement
            </div>
            <h2 className="mt-2 text-lg sm:text-xl font-bold tracking-tight">
              Annuler mon inscription
            </h2>
            <p className="text-sm text-neutral-600">
              Barème transparent, confirmation en un clic.
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 grid place-items-center rounded-xl hover:bg-neutral-100 text-neutral-600"
            aria-label="Fermer la fenêtre"
            title="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-4 sm:px-5 py-5">
          {loading ? (
            <div className="py-10 text-center text-neutral-600">Calcul du montant…</div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 p-3 text-sm">
              {error}
            </div>
          ) : quote ? (
            <>
              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <Fact label="Montant payé" value={eur(quote.amount_total_cents)} />
                  <Fact label="Frais non remboursables" value={eur(quote.non_refundable_cents)} />
                  <Fact label="Base remboursable" value={eur(quote.base_cents)} />
                  <Fact label="Palier appliqué" value={`${quote.percent}%`} hint=">30j 90% • 15–29j 50% • 7–14j 25% • <7j 0%" />
                </div>
                <div className="mt-3 rounded-xl bg-orange-50 border border-orange-200 px-3 py-2">
                  <div className="text-sm">
                    Montant remboursé estimé :{" "}
                    <b className="text-orange-700">{eur(quote.refund_cents)}</b>
                  </div>
                  {Number.isFinite(quote?.days_before) && (
                    <div className="text-xs text-neutral-600">
                      Jours avant l’épreuve : {quote.days_before}
                    </div>
                  )}
                </div>

                {disabledByTier && (
                  <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-amber-800 text-sm">
                    À ce stade du barème, aucun remboursement n’est prévu.
                  </div>
                )}
              </div>

              <div className="mt-5 grid gap-3">
                <label className="text-sm">
                  Motif (facultatif)
                  <select
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300"
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

                <label className="inline-flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 accent-orange-500"
                  />
                  <span className="text-neutral-800">
                    J’ai lu et j’accepte la{" "}
                    <a
                      href="/legal/remboursements"
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-neutral-900"
                    >
                      Politique de remboursement
                    </a>.
                  </span>
                </label>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-4 border-t border-neutral-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
          >
            Retour
          </button>
          <button
            onClick={confirmRefund}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white ${
              disabledByTier || !accepted || submitting
                ? "bg-neutral-400 cursor-not-allowed"
                : "bg-orange-500 hover:brightness-110"
            }`}
            disabled={disabledByTier || !accepted || submitting}
          >
            {submitting ? "Traitement…" : "Confirmer l’annulation"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
      <div className="text-[11px] text-neutral-600">{label}</div>
      <div className="text-sm font-semibold text-neutral-900">{value}</div>
      {hint ? <div className="text-[10px] text-neutral-500 mt-0.5">{hint}</div> : null}
    </div>
    
  );
}

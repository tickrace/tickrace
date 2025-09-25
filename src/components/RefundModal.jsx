// src/components/RefundModal.jsx
import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../supabase";

function eur(cents) {
  return (Number(cents || 0) / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });
}

/** Normalise la réponse (nouvelle ou legacy) en un quote commun pour l’UI */
function normalizeQuote(anyData) {
  if (!anyData) return null;

  // Cas "new" (request-refund preview/execution)
  // Attendus possibles: refundable, non_refundable_cents, base_cents, rate, days_before, amount_total_cents
  if (
    typeof anyData === "object" &&
    ("refundable" in anyData || "rate" in anyData || "non_refundable_cents" in anyData)
  ) {
    const amount_total_cents =
      typeof anyData.amount_total_cents === "number"
        ? anyData.amount_total_cents
        : undefined;
    const non_refundable_cents = Number(anyData.non_refundable_cents || 0);
    const base_cents =
      typeof anyData.base_cents === "number"
        ? anyData.base_cents
        : (typeof amount_total_cents === "number"
            ? Math.max(0, amount_total_cents - non_refundable_cents)
            : undefined);
    const percent =
      typeof anyData.rate === "number" ? Math.round(anyData.rate * 100) : undefined;
    const refund_cents =
      typeof anyData.refundable === "number"
        ? anyData.refundable
        : (typeof anyData.refunded_cents === "number" ? anyData.refunded_cents : 0);

    return {
      amount_total_cents:
        typeof amount_total_cents === "number" ? amount_total_cents : (base_cents || 0) + non_refundable_cents,
      non_refundable_cents,
      base_cents: typeof base_cents === "number" ? base_cents : 0,
      percent: Number.isFinite(percent) ? percent : 0,
      refund_cents: Number(refund_cents || 0),
      days_before:
        typeof anyData.days_before === "number" ? anyData.days_before : undefined,
    };
  }

  // Cas "legacy" (refunds?action=quote)
  // Attendus possibles: quote{...} OU champs à plat: refund_cents, amount_total_cents, non_refundable_cents, base_cents, percent, days_before
  const q = anyData.quote && typeof anyData.quote === "object" ? anyData.quote : anyData;
  return {
    amount_total_cents: Number(q.amount_total_cents || 0),
    non_refundable_cents: Number(q.non_refundable_cents || 0),
    base_cents: Number(q.base_cents || 0),
    percent: Number(q.percent || 0),
    refund_cents: Number(q.refund_cents || q.refundable || 0),
    days_before: Number.isFinite(q.days_before) ? q.days_before : undefined,
  };
}

export default function RefundModal({
  inscriptionId,
  open,
  onClose,
  onSuccess,
  // Nouveaux props (facultatifs) pour gérer équipes/relais
  mode = "individuel", // "individuel" | "groupe" | "relais"
  inscriptionIds = [], // IDs des membres (y compris soi) si équipe/relais
}) {
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);

  const [reason, setReason] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isTeamMode = mode === "groupe" || mode === "relais";
  const effectiveIds = useMemo(() => {
    return isTeamMode ? (inscriptionIds && inscriptionIds.length ? inscriptionIds : (inscriptionId ? [inscriptionId] : [])) : (inscriptionId ? [inscriptionId] : []);
  }, [isTeamMode, inscriptionIds, inscriptionId]);

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

      // 1) Nouvelle API — request-refund (preview)
      try {
        const bodyNew = isTeamMode
          ? { mode, inscription_ids: effectiveIds, preview: true }
          : { mode: "individuel", inscription_id: inscriptionId, preview: true };

        const res = await supabase.functions.invoke("request-refund", {
          body: bodyNew,
        });

        if (abort) return;

        if (res?.error) throw res.error;
        const normalized = normalizeQuote(res?.data);
        setQuote(normalized);
      } catch (eNew) {
        // 2) Fallback legacy — refunds?action=quote
        try {
          const legacyBody = isTeamMode
            ? { action: "quote", mode, inscription_ids: effectiveIds }
            : { action: "quote", inscription_id: inscriptionId };

          const { data, error } = await supabase.functions.invoke("refunds", {
            body: legacyBody,
          });

          if (abort) return;

          if (error) throw error;
          const normalized = normalizeQuote(data);
          setQuote(normalized);
        } catch (eLegacy) {
          if (!abort) setError(eLegacy?.message ?? String(eLegacy));
        }
      } finally {
        if (!abort) setLoading(false);
      }
    })();

    // ESC pour fermer
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      abort = true;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, inscriptionId, mode, isTeamMode, effectiveIds, onClose]);

  async function confirmRefund() {
    try {
      setSubmitting(true);
      setError(null);

      // 1) Tentative nouvelle API — request-refund (exécution)
      try {
        const bodyNew = isTeamMode
          ? { mode, inscription_ids: effectiveIds, reason: reason || null }
          : { mode: "individuel", inscription_id: inscriptionId, reason: reason || null };

        const res = await supabase.functions.invoke("request-refund", {
          body: bodyNew,
        });
        if (res?.error) throw res.error;

        onSuccess?.(res?.data);
        onClose?.();
        return;
      } catch (eNew) {
        // 2) Fallback legacy — refunds?action=confirm
        const legacyBody = isTeamMode
          ? { action: "confirm", mode, inscription_ids: effectiveIds, reason }
          : { action: "confirm", inscription_id: inscriptionId, reason };

        const { data, error } = await supabase.functions.invoke("refunds", {
          body: legacyBody,
        });
        if (error) throw error;

        onSuccess?.(data);
        onClose?.();
      }
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const disabledByTier =
    quote && (Number(quote.percent || 0) === 0 || Number(quote.refund_cents || 0) <= 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-neutral-900/60 p-0 sm:p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop click to close */}
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
              Annuler {isTeamMode ? "l’inscription d’équipe" : "mon inscription"}
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
              {/* Récap montant */}
              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <Fact label="Montant payé" value={eur(quote.amount_total_cents)} />
                  <Fact
                    label="Frais non remboursables"
                    value={eur(quote.non_refundable_cents)}
                  />
                  <Fact label="Base remboursable" value={eur(quote.base_cents)} />
                  <Fact
                    label="Palier appliqué"
                    value={`${Number(quote.percent || 0)}%`}
                    hint=">30j 90% • 15–29j 50% • 7–14j 25% • <7j 0%"
                  />
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

              {/* Form controls */}
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

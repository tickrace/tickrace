// src/components/GainPreview.jsx
import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

const fmtEUR = (n) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

function clampNum(v, min = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, n);
}

export default function GainPreview({
  basePriceEUR = 0, // prix inscription du format
  defaultParticipants = 200, // estimation inscrits
  platformFeeRate = 0.05, // Tickrace 5%
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [participants, setParticipants] = useState(defaultParticipants);
  const [avgOptionsEUR, setAvgOptionsEUR] = useState(3); // panier moyen options
  const [stripeZone, setStripeZone] = useState("eu"); // "eu" | "international"

  const calc = useMemo(() => {
    const price = clampNum(basePriceEUR, 0);
    const opts = clampNum(avgOptionsEUR, 0);
    const n = clampNum(participants, 0);

    const grossPerRunner = price + opts;

    const tickraceFee = grossPerRunner * platformFeeRate;

    // Estimation Stripe par transaction
    // UE : 1,4% + 0,25€
    // International : 2,9% + 0,25€
    const stripePct = stripeZone === "international" ? 0.029 : 0.014;
    const stripeFixed = 0.25;
    const stripeFeePerRunner = grossPerRunner * stripePct + stripeFixed;

    const netPerRunner = Math.max(0, grossPerRunner - tickraceFee - stripeFeePerRunner);
    const netTotal = netPerRunner * n;

    return {
      price,
      opts,
      n,
      grossPerRunner,
      tickraceFee,
      stripePct,
      stripeFixed,
      stripeFeePerRunner,
      netPerRunner,
      netTotal,
    };
  }, [basePriceEUR, avgOptionsEUR, participants, stripeZone, platformFeeRate]);

  return (
    <div className={["mt-3", className].join(" ")}>
      {/* Ligne compacte (toujours visible) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-xl bg-neutral-50 ring-1 ring-neutral-200 px-4 py-3 text-left hover:bg-neutral-100/60 transition"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-neutral-900">
                Aperçu gains organisateur
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-neutral-700 ring-1 ring-neutral-200">
                <Info className="h-3.5 w-3.5" />
                Estimation
              </span>
            </div>

            <div className="mt-1 text-xs text-neutral-600">
              ~ <span className="font-bold">{fmtEUR(calc.netPerRunner)}</span> net / inscrit
              <span className="text-neutral-500"> (après 5% + frais paiement)</span>
            </div>
          </div>

          <div className="shrink-0 text-neutral-700">
            {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </div>
        </div>
      </button>

      {/* Détails repliables */}
      {open && (
        <div className="mt-2 rounded-2xl bg-white ring-1 ring-neutral-200 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-semibold text-neutral-600">
              Inscrits estimés
              <input
                type="number"
                min={0}
                step={10}
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
              />
            </label>

            <label className="text-xs font-semibold text-neutral-600">
              Panier options (moy.)
              <input
                type="number"
                min={0}
                step={1}
                value={avgOptionsEUR}
                onChange={(e) => setAvgOptionsEUR(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
              />
            </label>

            <div>
              <div className="text-xs font-semibold text-neutral-600">Paiement (Stripe)</div>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setStripeZone("eu")}
                  className={[
                    "flex-1 rounded-xl px-3 py-2 text-sm font-semibold ring-1",
                    stripeZone === "eu"
                      ? "bg-neutral-900 text-white ring-neutral-900"
                      : "bg-white text-neutral-800 ring-neutral-200 hover:bg-neutral-50",
                  ].join(" ")}
                >
                  Carte UE
                </button>
                <button
                  type="button"
                  onClick={() => setStripeZone("international")}
                  className={[
                    "flex-1 rounded-xl px-3 py-2 text-sm font-semibold ring-1",
                    stripeZone === "international"
                      ? "bg-neutral-900 text-white ring-neutral-900"
                      : "bg-white text-neutral-800 ring-neutral-200 hover:bg-neutral-50",
                  ].join(" ")}
                >
                  International
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-neutral-50 ring-1 ring-neutral-200 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-neutral-600">Total payé (prix + options)</span>
              <span className="font-semibold">{fmtEUR(calc.grossPerRunner)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-600">Commission Tickrace (5%)</span>
              <span className="font-semibold">-{fmtEUR(calc.tickraceFee)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-600">
                Frais paiement estimés ({Math.round(calc.stripePct * 1000) / 10}% +{" "}
                {fmtEUR(calc.stripeFixed)})
              </span>
              <span className="font-semibold">-{fmtEUR(calc.stripeFeePerRunner)}</span>
            </div>

            <div className="mt-3 pt-3 border-t border-neutral-200 flex items-center justify-between">
              <span className="text-neutral-900 font-black">Net / inscrit</span>
              <span className="text-neutral-900 font-black">{fmtEUR(calc.netPerRunner)}</span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-neutral-600">Projection (x {calc.n} inscrits)</span>
              <span className="font-black">{fmtEUR(calc.netTotal)}</span>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-neutral-500">
            * Estimation indicative : dépend des cartes (UE/international), du panier options réel, des
            remboursements/annulations et des frais Stripe exacts.
          </p>
        </div>
      )}
    </div>
  );
}

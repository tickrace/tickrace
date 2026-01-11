// src/pages/organisateur/Compta.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";

function eurFromCents(c) {
  const n = Number(c || 0);
  return (n / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function firstDayOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function lastDayOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function humanEvent(e) {
  const m = String(e || "");
  if (m === "payment_paid") return "Paiement encaissé";
  if (m === "stripe_fee_adjustment") return "Frais Stripe (ajustement)";
  if (m.includes("refund")) return "Remboursement";
  if (m.includes("transfer")) return "Reversement";
  return m || "—";
}

function isTransferEvent(e) {
  return String(e || "").toLowerCase().includes("transfer");
}

const TabBtn = ({ active, children, onClick }) => (
  <button
    onClick={onClick}
    className={[
      "px-4 py-2 rounded-xl text-sm font-semibold border",
      active ? "bg-black text-white border-black" : "bg-white hover:bg-neutral-50 border-neutral-200",
    ].join(" ")}
  >
    {children}
  </button>
);

const Modal = ({ open, title, children, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-xl ring-1 ring-neutral-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <div className="font-semibold">{title}</div>
          <button onClick={onClose} className="px-3 py-1 rounded-lg border hover:bg-neutral-50 text-sm">
            Fermer
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

export default function Compta() {
  const [tab, setTab] = useState("releve"); // releve | facture

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Relevé (ledger)
  const [ledger, setLedger] = useState([]);
  const [from, setFrom] = useState(isoDate(firstDayOfMonth()));
  const [to, setTo] = useState(isoDate(lastDayOfMonth()));

  // Options (DB: inscriptions_options + options_catalogue)
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsErr, setOptionsErr] = useState("");
  const [optionsRows, setOptionsRows] = useState([]);

  // Factures
  const [invoices, setInvoices] = useState([]);
  const [busyDownload, setBusyDownload] = useState({});
  const [invoiceModal, setInvoiceModal] = useState({ open: false, invoice: null });

  async function requireAuth() {
    const { data: auth } = await supabase.auth.getSession();
    if (!auth?.session?.user) throw new Error("Connecte-toi pour accéder à la compta.");
    return auth.session.user;
  }

  async function loadLedger() {
    setErr("");
    setLoading(true);
    try {
      const user = await requireAuth();

      // ✅ on lit la VUE (avec course_nom)
      const base = supabase
        .from("organisateur_ledger_v")
        .select(
          "id, occurred_at, source_event, label, course_nom, gross_cents, tickrace_fee_cents, stripe_fee_cents, net_org_cents",
        )
        .gte("occurred_at", `${from}T00:00:00+00`)
        .lte("occurred_at", `${to}T23:59:59+00`)
        .order("occurred_at", { ascending: false })
        .limit(700);

      let { data, error } = await base.eq("organisateur_id", user.id);

      // Fallback si la vue n'expose pas organisateur_id
      if (error && String(error.message || "").includes("organisateur_id")) {
        ({ data, error } = await base);
      }

      if (error) throw error;
      setLedger(data || []);
    } catch (e) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadOptionsSummary() {
    setOptionsErr("");
    setOptionsLoading(true);
    try {
      const user = await requireAuth();

      // 1) courses de l’orga
      const { data: cs, error: ce } = await supabase.from("courses").select("id").eq("organisateur_id", user.id);
      if (ce) throw ce;
      const courseIds = (cs || []).map((c) => c.id).filter(Boolean);

      if (courseIds.length === 0) {
        setOptionsRows([]);
        return;
      }

      // ✅ 2) formats des courses (car inscriptions n'a PAS course_id)
      const { data: fs, error: fe } = await supabase.from("formats").select("id").in("course_id", courseIds).limit(10000);
      if (fe) throw fe;
      const formatIds = (fs || []).map((f) => f.id).filter(Boolean);

      if (formatIds.length === 0) {
        setOptionsRows([]);
        return;
      }

      // ✅ 3) inscriptions de la période (filtre simple par created_at) via format_id
      const { data: ins, error: ie } = await supabase
        .from("inscriptions")
        .select("id")
        .in("format_id", formatIds)
        .gte("created_at", `${from}T00:00:00+00`)
        .lte("created_at", `${to}T23:59:59+00`)
        .limit(5000);

      if (ie) throw ie;
      const insIds = (ins || []).map((r) => r.id).filter(Boolean);

      if (insIds.length === 0) {
        setOptionsRows([]);
        return;
      }

      // 4) options confirmées (sans jamais dépendre de Stripe)
      const { data: opts, error: oe } = await supabase
        .from("inscriptions_options")
        .select("option_id, quantity, prix_unitaire_cents, status, options_catalogue(label, price_cents)")
        .in("inscription_id", insIds)
        .eq("status", "confirmed")
        .limit(5000);

      if (oe) throw oe;

      // 5) agrégation
      const map = new Map(); // option_id -> agg
      for (const r of opts || []) {
        const optionId = String(r.option_id || "").toLowerCase();
        if (!optionId) continue;

        const qty = Math.max(0, Number(r.quantity || 0));
        const unit = Math.max(0, Number(r.prix_unitaire_cents ?? 0));
        const label = r?.options_catalogue?.label || optionId;

        const prev = map.get(optionId) || {
          option_id: optionId,
          label,
          qty: 0,
          unit_cents: unit,
          total_cents: 0,
        };

        prev.qty += qty;
        prev.unit_cents = unit; // on garde le prix réellement payé
        prev.total_cents += qty * unit;
        map.set(optionId, prev);
      }

      const rows = Array.from(map.values())
        .filter((x) => x.qty > 0)
        .sort((a, b) => b.total_cents - a.total_cents);

      setOptionsRows(rows);
    } catch (e) {
      setOptionsErr(e?.message ?? String(e));
      setOptionsRows([]);
    } finally {
      setOptionsLoading(false);
    }
  }

  async function loadInvoices() {
    setErr("");
    try {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from("factures_tickrace")
        .select(
          "id, invoice_no, status, period_from, period_to, subtotal_cents, vat_rate_bp, vat_cents, total_cents, created_at, lines",
        )
        .eq("organisateur_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setInvoices(data || []);
    } catch (e) {
      setErr(e?.message ?? String(e));
    }
  }

  useEffect(() => {
    (async () => {
      await loadLedger();
      await loadInvoices();
      await loadOptionsSummary();
    })();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    loadLedger();
    if (tab === "releve") loadOptionsSummary();
    // eslint-disable-next-line
  }, [from, to]);

  useEffect(() => {
    if (tab === "releve") loadOptionsSummary();
    // eslint-disable-next-line
  }, [tab]);

  const totals = useMemo(() => {
    const gross = ledger.reduce((s, r) => s + Number(r.gross_cents || 0), 0);
    const tick = ledger.reduce((s, r) => s + Number(r.tickrace_fee_cents || 0), 0);
    const stripe = ledger.reduce((s, r) => s + Number(r.stripe_fee_cents || 0), 0);
    const net = ledger.reduce((s, r) => s + Number(r.net_org_cents || 0), 0);
    return { gross, tick, stripe, net };
  }, [ledger]);

  // Reversements (depuis le ledger : source_event contient "transfer")
  const transfers = useMemo(() => ledger.filter((r) => isTransferEvent(r.source_event)), [ledger]);

  const transferStats = useMemo(() => {
    const transferNet = transfers.reduce((s, r) => s + Number(r.net_org_cents || 0), 0); // souvent négatif (sortie)
    const alreadyPaid = transferNet < 0 ? -transferNet : transferNet;

    const generatedNet = ledger
      .filter((r) => !isTransferEvent(r.source_event))
      .reduce((s, r) => s + Number(r.net_org_cents || 0), 0);

    const due = generatedNet + transferNet; // ce qui reste dû à l’orga sur la période
    return { generatedNet, transferNet, alreadyPaid, due, count: transfers.length };
  }, [ledger, transfers]);

  const optionsTotals = useMemo(() => {
    const qty = optionsRows.reduce((s, r) => s + Number(r.qty || 0), 0);
    const total = optionsRows.reduce((s, r) => s + Number(r.total_cents || 0), 0);
    return { qty, total };
  }, [optionsRows]);

  async function downloadInvoice(invoiceId) {
    setErr("");
    setBusyDownload((s) => ({ ...s, [invoiceId]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("get-tickrace-invoice-link", {
        body: { invoice_id: invoiceId },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Lien de téléchargement introuvable.");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      alert("Erreur: " + (e?.message ?? String(e)));
    } finally {
      setBusyDownload((s) => ({ ...s, [invoiceId]: false }));
    }
  }

  const invoiceLines = useMemo(() => {
    const inv = invoiceModal.invoice;
    if (!inv) return [];
    const arr = Array.isArray(inv.lines) ? inv.lines : [];
    return arr
      .map((l) => ({
        label: l?.label ?? "—",
        amount: Number(l?.amount_cents || 0),
      }))
      .filter((x) => x.amount !== 0)
      .sort((a, b) => b.amount - a.amount);
  }, [invoiceModal]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              Comptabilité <span className="text-orange-600">Organisateur</span>
            </h1>
            <p className="text-sm text-neutral-600">Relevé en temps réel + reversements + factures TickRace.</p>
          </div>

          <div className="flex gap-2">
            <TabBtn active={tab === "releve"} onClick={() => setTab("releve")}>
              Relevé
            </TabBtn>
            <TabBtn active={tab === "facture"} onClick={() => setTab("facture")}>
              Facture TickRace
            </TabBtn>
          </div>
        </div>

        {err ? (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">{err}</div>
        ) : null}

        {/* Filtres période */}
        <div className="rounded-2xl bg-white shadow ring-1 ring-neutral-200 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <div className="text-xs font-semibold text-neutral-600">Du</div>
                <input
                  type="date"
                  className="mt-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <div className="text-xs font-semibold text-neutral-600">Au</div>
                <input
                  type="date"
                  className="mt-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>

              <button
                onClick={async () => {
                  await loadLedger();
                  await loadInvoices();
                  await loadOptionsSummary();
                }}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
              >
                Actualiser
              </button>
            </div>

            {tab === "releve" ? (
              <div className="text-sm text-neutral-700 flex flex-wrap gap-4">
                <span>
                  Brut: <b>{eurFromCents(totals.gross)}</b>
                </span>
                <span>
                  TickRace: <b>{eurFromCents(totals.tick)}</b>
                </span>
                <span>
                  Stripe: <b>{eurFromCents(totals.stripe)}</b>
                </span>
                <span>
                  Net (période): <b>{eurFromCents(totals.net)}</b>
                </span>
                <span>
                  Déjà versé: <b>{eurFromCents(transferStats.alreadyPaid)}</b>
                </span>
                <span>
                  Solde à venir: {" "}
                  <b className={transferStats.due < 0 ? "text-red-600" : "text-emerald-700"}>
                    {eurFromCents(transferStats.due)}
                  </b>
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Onglet Relevé */}
        {tab === "releve" && (
          <>
            {/* Reversements */}
            <div className="rounded-2xl bg-white shadow ring-1 ring-neutral-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Reversements</h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    Historique des reversements effectués (mouvements <b>transfer</b>) + solde restant dû sur la période.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-neutral-500">Solde à venir</div>
                  <div
                    className={[
                      "text-lg font-black",
                      transferStats.due < 0 ? "text-red-600" : "text-emerald-700",
                    ].join(" ")}
                  >
                    {eurFromCents(transferStats.due)}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-neutral-200 p-4">
                  <div className="text-xs text-neutral-500">Net généré (hors reversements)</div>
                  <div className="mt-1 text-xl font-black">{eurFromCents(transferStats.generatedNet)}</div>
                </div>
                <div className="rounded-2xl border border-neutral-200 p-4">
                  <div className="text-xs text-neutral-500">Déjà versé (période)</div>
                  <div className="mt-1 text-xl font-black">{eurFromCents(transferStats.alreadyPaid)}</div>
                </div>
                <div className="rounded-2xl border border-neutral-200 p-4">
                  <div className="text-xs text-neutral-500">Nb reversements</div>
                  <div className="mt-1 text-xl font-black">{transferStats.count}</div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-neutral-200 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Course</th>
                      <th className="px-3 py-2 text-left">Détail</th>
                      <th className="px-3 py-2 text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-neutral-500">
                          Chargement…
                        </td>
                      </tr>
                    ) : transfers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-neutral-500">
                          Aucun reversement sur la période.
                        </td>
                      </tr>
                    ) : (
                      transfers.map((r) => {
                        const amt = Number(r.net_org_cents || 0);
                        const shown = amt < 0 ? -amt : amt; // on affiche en positif
                        return (
                          <tr key={r.id} className="border-t">
                            <td className="px-3 py-2">{new Date(r.occurred_at).toLocaleString("fr-FR")}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{r.course_nom || "—"}</div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-semibold">{humanEvent(r.source_event)}</div>
                              {r.label ? <div className="text-xs text-neutral-500">{r.label}</div> : null}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold">{eurFromCents(shown)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 text-xs text-neutral-500">
                Note : le <b>solde à venir</b> ici est le restant dû sur la période sélectionnée (net généré − reversements).
              </div>
            </div>

            {/* Options vendues (DB) */}
            <div className="rounded-2xl bg-white shadow ring-1 ring-neutral-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Options vendues</h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    Labels venant de <code className="text-xs">options_catalogue</code> (jamais Stripe). Période filtrée
                    sur les inscriptions.
                  </p>
                </div>
                <button
                  onClick={loadOptionsSummary}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
                  disabled={optionsLoading}
                >
                  {optionsLoading ? "Chargement…" : "Actualiser"}
                </button>
              </div>

              {optionsErr ? (
                <div className="mt-3 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
                  {optionsErr}
                </div>
              ) : null}

              <div className="mt-4 rounded-xl border border-neutral-200 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Option</th>
                      <th className="px-3 py-2 text-right">Prix unitaire</th>
                      <th className="px-3 py-2 text-right">Qté</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optionsLoading ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-neutral-500">
                          Chargement…
                        </td>
                      </tr>
                    ) : optionsRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-neutral-500">
                          Aucune option vendue sur la période.
                        </td>
                      </tr>
                    ) : (
                      optionsRows.map((r) => (
                        <tr key={r.option_id} className="border-t">
                          <td className="px-3 py-2">
                            <div className="font-medium">{r.label}</div>
                            <div className="text-xs text-neutral-500 font-mono">{r.option_id}</div>
                          </td>
                          <td className="px-3 py-2 text-right">{eurFromCents(r.unit_cents)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{r.qty}</td>
                          <td className="px-3 py-2 text-right font-semibold">{eurFromCents(r.total_cents)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {optionsRows.length > 0 && !optionsLoading ? (
                    <tfoot className="bg-neutral-50 border-t">
                      <tr>
                        <td className="px-3 py-2 text-left font-semibold">Total</td>
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2 text-right font-semibold">{optionsTotals.qty}</td>
                        <td className="px-3 py-2 text-right font-semibold">{eurFromCents(optionsTotals.total)}</td>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            </div>

            {/* Relevé ledger */}
            <div className="rounded-2xl bg-white shadow ring-1 ring-neutral-200 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Course</th>
                    <th className="px-4 py-3 text-left">Mouvement</th>
                    <th className="px-4 py-3 text-right">Brut</th>
                    <th className="px-4 py-3 text-right">TickRace</th>
                    <th className="px-4 py-3 text-right">Stripe</th>
                    <th className="px-4 py-3 text-right">Net orga</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-neutral-500">
                        Chargement…
                      </td>
                    </tr>
                  ) : ledger.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-neutral-500">
                        Aucun mouvement sur la période.
                      </td>
                    </tr>
                  ) : (
                    ledger.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-4 py-3">{new Date(r.occurred_at).toLocaleString("fr-FR")}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{r.course_nom || "—"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold">{humanEvent(r.source_event)}</div>
                          {r.label ? <div className="text-xs text-neutral-500">{r.label}</div> : null}
                        </td>
                        <td className="px-4 py-3 text-right">{eurFromCents(r.gross_cents)}</td>
                        <td className="px-4 py-3 text-right">{eurFromCents(r.tickrace_fee_cents)}</td>
                        <td className="px-4 py-3 text-right">{eurFromCents(r.stripe_fee_cents)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{eurFromCents(r.net_org_cents)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Onglet Facture */}
        {tab === "facture" && (
          <div className="rounded-2xl bg-white shadow ring-1 ring-neutral-200 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Factures TickRace</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Les factures finales sont générées automatiquement au reversement final (solde à J+2).
                </p>
              </div>
              <button
                onClick={loadInvoices}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
              >
                Actualiser
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-neutral-200 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-3 py-2 text-left">N°</th>
                    <th className="px-3 py-2 text-left">Période</th>
                    <th className="px-3 py-2 text-right">Sous-total</th>
                    <th className="px-3 py-2 text-right">TVA</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-neutral-500">
                        Aucune facture.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((f) => (
                      <tr key={f.id} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs">{f.invoice_no}</td>
                        <td className="px-3 py-2 text-xs text-neutral-700">
                          {String(f.period_from)} → {String(f.period_to)}
                        </td>
                        <td className="px-3 py-2 text-right">{eurFromCents(f.subtotal_cents)}</td>
                        <td className="px-3 py-2 text-right">{eurFromCents(f.vat_cents)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{eurFromCents(f.total_cents)}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button
                            onClick={() => setInvoiceModal({ open: true, invoice: f })}
                            className="mr-2 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50"
                          >
                            Détail
                          </button>
                          <button
                            onClick={() => downloadInvoice(f.id)}
                            disabled={!!busyDownload[f.id]}
                            className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50 disabled:opacity-50"
                          >
                            {busyDownload[f.id] ? "Préparation…" : "PDF"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Modal
          open={invoiceModal.open}
          title={invoiceModal.invoice ? `Détail — ${invoiceModal.invoice.invoice_no}` : "Détail"}
          onClose={() => setInvoiceModal({ open: false, invoice: null })}
        >
          {!invoiceModal.invoice ? null : (
            <div className="space-y-4">
              <div className="text-sm text-neutral-700">
                <div>
                  <b>Période :</b> {String(invoiceModal.invoice.period_from)} → {String(invoiceModal.invoice.period_to)}
                </div>
                <div>
                  <b>Sous-total :</b> {eurFromCents(invoiceModal.invoice.subtotal_cents)}
                </div>
                <div>
                  <b>TVA :</b> {(Number(invoiceModal.invoice.vat_rate_bp || 0) / 100).toFixed(2)}% —{" "}
                  {eurFromCents(invoiceModal.invoice.vat_cents)}
                </div>
                <div>
                  <b>Total :</b> {eurFromCents(invoiceModal.invoice.total_cents)}
                </div>
              </div>

              <div className="rounded-xl border border-neutral-200 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Ligne</th>
                      <th className="px-3 py-2 text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceLines.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-3 py-6 text-neutral-500">
                          Aucune ligne.
                        </td>
                      </tr>
                    ) : (
                      invoiceLines.map((l, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">{l.label}</td>
                          <td className="px-3 py-2 text-right font-semibold">{eurFromCents(l.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}








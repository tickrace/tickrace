// src/pages/organisateur/Compta.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabase";
import {
  RefreshCw,
  Loader2,
  FileDown,
  Printer,
  CalendarDays,
  MapPin,
  Receipt,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/* -------------------------------- Utils -------------------------------- */

function cents(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}
function eur(c) {
  return (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR");
}
function safeJson(obj) {
  try {
    return JSON.stringify(obj ?? {}, null, 2);
  } catch {
    return "{}";
  }
}
function downloadText(filename, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ------------------------------ Print HTML ------------------------------ */

function buildInvoiceHtml({
  orgLabel,
  courseLabel,
  periodFrom,
  periodTo,
  totals,
  lines,
  invoiceNo,
  issueDate,
}) {
  const css = `
    *{box-sizing:border-box}
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; color:#111; margin:0; padding:24px;}
    .wrap{max-width:900px; margin:0 auto;}
    h1{font-size:20px; margin:0 0 8px 0;}
    .muted{color:#6b7280; font-size:12px;}
    .top{display:flex; justify-content:space-between; gap:16px; margin-bottom:18px;}
    .card{border:1px solid #e5e7eb; border-radius:14px; padding:14px;}
    .kpis{display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:14px 0;}
    .kpi{border:1px solid #e5e7eb; border-radius:14px; padding:12px;}
    .kpi .v{font-size:16px; font-weight:700; margin-top:6px;}
    table{width:100%; border-collapse:collapse; margin-top:12px;}
    th,td{border-bottom:1px solid #e5e7eb; padding:10px 8px; font-size:12px; vertical-align:top;}
    th{text-align:left; background:#f9fafb; font-weight:700;}
    .right{text-align:right;}
    .footer{margin-top:16px; font-size:11px; color:#6b7280;}
    @media print{
      body{padding:0}
      .wrap{max-width:none; margin:0; padding:24px;}
      .noprint{display:none;}
    }
  `;

  const periodTxt = `${periodFrom ? fmtDate(periodFrom) : "—"} → ${periodTo ? fmtDate(periodTo) : "—"}`;

  const rowsHtml = (lines || [])
    .slice(0, 2000)
    .map((l) => {
      return `
        <tr>
          <td>${fmtDateTime(l.occurred_at)}</td>
          <td>${l.course_nom || "—"}</td>
          <td>${l.label || l.source_event || "—"}</td>
          <td class="right">${eur(cents(l.gross_cents))}</td>
          <td class="right">${eur(cents(l.tickrace_fee_cents))}</td>
          <td class="right">${eur(cents(l.stripe_fee_cents))}</td>
          <td class="right"><b>${eur(cents(l.net_org_cents))}</b></td>
        </tr>
      `;
    })
    .join("");

  return `<!doctype html>
  <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${invoiceNo}</title>
      <style>${css}</style>
    </head>
    <body>
      <div class="wrap">
        <div class="top">
          <div>
            <h1>Relevé comptable organisateur</h1>
            <div class="muted">Document de synthèse (commission Tickrace + frais Stripe + net organisateur)</div>
            <div class="muted" style="margin-top:6px"><b>N° :</b> ${invoiceNo}</div>
            <div class="muted"><b>Date :</b> ${issueDate}</div>
            <div class="muted"><b>Période :</b> ${periodTxt}</div>
          </div>
          <div class="card" style="min-width:260px">
            <div style="font-weight:700; margin-bottom:6px">Bénéficiaire</div>
            <div style="font-size:13px">${orgLabel || "Organisateur"}</div>
            <div class="muted" style="margin-top:6px"><b>Course :</b> ${courseLabel || "Toutes"}</div>
          </div>
        </div>

        <div class="kpis">
          <div class="kpi"><div class="muted">Brut encaissé</div><div class="v">${eur(totals.gross)}</div></div>
          <div class="kpi"><div class="muted">Commission Tickrace</div><div class="v">${eur(totals.tickrace)}</div></div>
          <div class="kpi"><div class="muted">Frais Stripe</div><div class="v">${eur(totals.stripe)}</div></div>
          <div class="kpi"><div class="muted">Net organisateur</div><div class="v">${eur(totals.net)}</div></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Course</th>
              <th>Événement</th>
              <th class="right">Brut</th>
              <th class="right">Tickrace</th>
              <th class="right">Stripe</th>
              <th class="right">Net</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || `<tr><td colspan="7" class="muted">Aucune ligne sur la période.</td></tr>`}
          </tbody>
        </table>

        <div class="footer">
          Astuce : conserve ce relevé comme justificatif comptable. Pour une facture légale (avec identité TVA, etc.),
          ajoute tes coordonnées dans ton profil organisateur et active le modèle de facture Tickrace.
        </div>
      </div>
    </body>
  </html>`;
}

/* --------------------------------- Page -------------------------------- */

export default function Compta() {
  const [gate, setGate] = useState("loading"); // loading | ok | forbidden
  const [gateMsg, setGateMsg] = useState("");

  const [organisateurId, setOrganisateurId] = useState(null);

  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");

  const [filters, setFilters] = useState({
    date_from: "",
    date_to: "",
    search: "",
  });

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [expanded, setExpanded] = useState({}); // { [ledgerId]: true }
  const [busy, setBusy] = useState(false);

  const printRef = useRef(null);

  async function guardOrga() {
    try {
      const { data: auth } = await supabase.auth.getSession();
      const user = auth?.session?.user;
      if (!user) {
        setGate("forbidden");
        setGateMsg("Connecte-toi pour accéder à ta compta organisateur.");
        return false;
      }
      setOrganisateurId(user.id);
      setGate("ok");
      return true;
    } catch (e) {
      setGate("forbidden");
      setGateMsg(String(e?.message || e));
      return false;
    }
  }

  useEffect(() => {
    (async () => {
      const ok = await guardOrga();
      if (!ok) return;

      // Liste des courses de l'organisateur
      // ⚠️ suppose que courses.organisateur_id = auth.uid()
      const { data, error } = await supabase
        .from("courses")
        .select("id, nom, lieu, date")
        .eq("organisateur_id", (await supabase.auth.getSession()).data?.session?.user?.id)
        .order("date", { ascending: false });

      if (!error) setCourses(data || []);
    })();
    // eslint-disable-next-line
  }, []);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const ok = await guardOrga();
      if (!ok) {
        setLoading(false);
        return;
      }

      let q = supabase.from("organisateur_ledger").select("*").eq("organisateur_id", organisateurId);

      if (courseId) q = q.eq("course_id", courseId);
      if (filters.date_from) q = q.gte("occurred_at", `${filters.date_from}T00:00:00`);
      if (filters.date_to) q = q.lte("occurred_at", `${filters.date_to}T23:59:59`);

      if (filters.search.trim()) {
        const s = `%${filters.search.trim()}%`;
        // label + source_event + source_id (simple)
        q = q.or([`label.ilike.${s}`, `source_event.ilike.${s}`, `source_id.ilike.${s}`].join(","));
      }

      // On garde confirmed par défaut (à adapter si tu veux voir pending)
      q = q.eq("status", "confirmed").order("occurred_at", { ascending: false }).limit(2000);

      const { data, error } = await q;
      if (error) throw error;

      setRows(data || []);
    } catch (e) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (gate !== "ok" || !organisateurId) return;
    load();
    // eslint-disable-next-line
  }, [gate, organisateurId, courseId, JSON.stringify(filters)]);

  const courseLabel = useMemo(() => {
    if (!courseId) return "Toutes";
    return courses.find((c) => c.id === courseId)?.nom || "—";
  }, [courseId, courses]);

  const totals = useMemo(() => {
    const gross = rows.reduce((a, r) => a + cents(r.gross_cents), 0);
    const tickrace = rows.reduce((a, r) => a + cents(r.tickrace_fee_cents), 0);
    const stripe = rows.reduce((a, r) => a + cents(r.stripe_fee_cents), 0);
    const net = rows.reduce((a, r) => a + cents(r.net_org_cents), 0);
    return { gross, tickrace, stripe, net };
  }, [rows]);

  function exportCSV() {
    const header = [
      "occurred_at",
      "course_id",
      "source_event",
      "label",
      "gross_cents",
      "tickrace_fee_cents",
      "stripe_fee_cents",
      "net_org_cents",
      "currency",
      "source_table",
      "source_id",
      "source_key",
    ];

    const lines = rows.map((r) =>
      header
        .map((k) => {
          const v = r?.[k];
          const s = v == null ? "" : String(v);
          // CSV safe
          const escaped = s.replaceAll('"', '""');
          return `"${escaped}"`;
        })
        .join(","),
    );

    const csv = [header.join(","), ...lines].join("\n");
    const name = `tickrace-compta-${courseId ? courseId.slice(0, 6) : "all"}-${filters.date_from || "start"}-${filters.date_to || "end"}.csv`;
    downloadText(name, csv, "text/csv;charset=utf-8");
  }

  function printStatement() {
    const now = new Date();
    const issueDate = now.toLocaleDateString("fr-FR");
    const invoiceNo = `TR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      (organisateurId || "").slice(0, 6) || "ORGA",
    ).toUpperCase()}`;

    const html = buildInvoiceHtml({
      orgLabel: `Organisateur (${(organisateurId || "").slice(0, 8)}…)`,
      courseLabel,
      periodFrom: filters.date_from ? `${filters.date_from}T00:00:00` : null,
      periodTo: filters.date_to ? `${filters.date_to}T23:59:59` : null,
      totals,
      lines: rows.map((r) => ({
        occurred_at: r.occurred_at,
        course_nom: courseLabel === "Toutes" ? "" : courseLabel,
        label: r.label,
        source_event: r.source_event,
        gross_cents: r.gross_cents,
        tickrace_fee_cents: r.tickrace_fee_cents,
        stripe_fee_cents: r.stripe_fee_cents,
        net_org_cents: r.net_org_cents,
      })),
      invoiceNo,
      issueDate,
    });

    const w = window.open("", "_blank", "noopener,noreferrer,width=980,height=800");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }

  if (gate === "loading") return <div className="p-6">Chargement…</div>;
  if (gate === "forbidden") return <div className="p-6 text-red-600">403 — {gateMsg}</div>;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Compta organisateur</h1>
          <p className="text-sm text-neutral-500">
            Suivi en temps réel : brut, commission Tickrace, frais Stripe, net organisateur.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading || busy}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualiser
          </button>

          <button
            onClick={exportCSV}
            disabled={loading || rows.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" />
            Export CSV
          </button>

          <button
            onClick={printStatement}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-900 text-white px-3 py-2 text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Imprimer le relevé
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-yellow-900">
          Erreur : {err}
        </div>
      )}

      {/* Filters */}
      <div className="grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-neutral-600">Course</label>
          <div className="mt-1">
            <select
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">Toutes</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-neutral-600">Du</label>
          <div className="mt-1 relative">
            <CalendarDays className="h-4 w-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="date"
              className="w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-3 py-2 text-sm"
              value={filters.date_from}
              onChange={(e) => setFilters((s) => ({ ...s, date_from: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-neutral-600">Au</label>
          <div className="mt-1 relative">
            <CalendarDays className="h-4 w-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="date"
              className="w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-3 py-2 text-sm"
              value={filters.date_to}
              onChange={(e) => setFilters((s) => ({ ...s, date_to: e.target.value }))}
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-neutral-600">Recherche</label>
          <div className="mt-1">
            <input
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
              placeholder="ex: payment_paid, stripe_fee_adjustment, id…"
              value={filters.search}
              onChange={(e) => setFilters((s) => ({ ...s, search: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex items-end gap-2">
          <button
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
            onClick={() => setFilters({ date_from: "", date_to: "", search: "" })}
          >
            Reset
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-xs font-semibold text-neutral-600">Brut encaissé</div>
          <div className="mt-2 text-2xl font-extrabold">{eur(totals.gross)}</div>
          <div className="mt-1 text-xs text-neutral-500">Somme des gross_cents</div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-xs font-semibold text-neutral-600">Commission Tickrace</div>
          <div className="mt-2 text-2xl font-extrabold">{eur(totals.tickrace)}</div>
          <div className="mt-1 text-xs text-neutral-500">Somme des tickrace_fee_cents</div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-xs font-semibold text-neutral-600">Frais Stripe</div>
          <div className="mt-2 text-2xl font-extrabold">{eur(totals.stripe)}</div>
          <div className="mt-1 text-xs text-neutral-500">Somme des stripe_fee_cents</div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-xs font-semibold text-neutral-600">Net organisateur</div>
          <div className="mt-2 text-2xl font-extrabold">{eur(totals.net)}</div>
          <div className="mt-1 text-xs text-neutral-500">Somme des net_org_cents</div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-neutral-200 overflow-hidden bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-neutral-500" />
            <div className="text-sm font-semibold">Écritures</div>
            <div className="text-xs text-neutral-500">({rows.length})</div>
          </div>
          {courseId && (
            <div className="text-xs text-neutral-500 inline-flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {courseLabel}
            </div>
          )}
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600">Événement</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600">Référence</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-600">Brut</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-600">Tickrace</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-600">Stripe</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-600">Net</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600">Détails</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-neutral-500">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-neutral-500">
                    Aucune écriture sur cette période.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isOpen = !!expanded[r.id];
                  const ref = r.source_id ? String(r.source_id).slice(0, 10) : "—";
                  return (
                    <React.Fragment key={r.id}>
                      <tr className="border-t border-neutral-100">
                        <td className="px-4 py-3 whitespace-nowrap">{fmtDateTime(r.occurred_at)}</td>

                        <td className="px-4 py-3">
                          <div className="font-semibold">{r.label || r.source_event || "—"}</div>
                          <div className="text-xs text-neutral-500">{r.source_event}</div>
                        </td>

                        <td className="px-4 py-3 font-mono text-xs text-neutral-700">
                          {ref}
                          {r.source_table ? <span className="text-neutral-400"> · {r.source_table}</span> : null}
                        </td>

                        <td className="px-4 py-3 text-right">{eur(cents(r.gross_cents))}</td>
                        <td className="px-4 py-3 text-right">{eur(cents(r.tickrace_fee_cents))}</td>
                        <td className="px-4 py-3 text-right">{eur(cents(r.stripe_fee_cents))}</td>
                        <td className="px-4 py-3 text-right font-extrabold">{eur(cents(r.net_org_cents))}</td>

                        <td className="px-4 py-3">
                          <button
                            onClick={() => setExpanded((s) => ({ ...s, [r.id]: !s[r.id] }))}
                            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50"
                          >
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            {isOpen ? "Masquer" : "Voir"}
                          </button>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className="border-t border-neutral-100 bg-neutral-50/40">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="grid gap-3 md:grid-cols-3">
                              <div className="rounded-xl border border-neutral-200 bg-white p-3">
                                <div className="text-xs font-semibold text-neutral-600">Source</div>
                                <div className="mt-1 text-xs font-mono text-neutral-800">
                                  <div>table: {r.source_table || "—"}</div>
                                  <div>id: {r.source_id || "—"}</div>
                                  <div>key: {r.source_key || "—"}</div>
                                </div>
                              </div>

                              <div className="rounded-xl border border-neutral-200 bg-white p-3">
                                <div className="text-xs font-semibold text-neutral-600">Statut</div>
                                <div className="mt-1 text-sm font-semibold">{r.status}</div>
                                <div className="mt-2 text-xs text-neutral-500">
                                  Devise : <span className="font-mono">{r.currency || "eur"}</span>
                                </div>
                              </div>

                              <div className="rounded-xl border border-neutral-200 bg-white p-3 md:col-span-1">
                                <div className="text-xs font-semibold text-neutral-600">Metadata</div>
                                <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-neutral-900 text-neutral-100 p-3 text-xs">
                                  {safeJson(r.metadata)}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hidden (reserved) */}
      <div ref={printRef} className="hidden" />
    </div>
  );
}

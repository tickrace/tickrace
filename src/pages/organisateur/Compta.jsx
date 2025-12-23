// src/pages/organisateur/Compta.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabase";
import {
  CalendarDays,
  Download,
  Filter,
  Printer,
  RefreshCw,
  Search,
  Wallet,
  Banknote,
  Receipt,
  BadgeEuro,
  Tags,
  FileText,
} from "lucide-react";

function cents(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}
function eur(c) {
  return (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}
function toISODate(d) {
  if (!d) return "";
  const dt = new Date(d);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function startOfMonthISO() {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
}
function endOfMonthISO() {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}
function csvEscape(v) {
  const s = (v ?? "").toString();
  if (s.includes(";") || s.includes("\n") || s.includes('"')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function pad2(n) {
  return String(n).padStart(2, "0");
}
function yyyymm(fromISO) {
  if (!fromISO) return "";
  const [y, m] = fromISO.split("-");
  return `${y}${m}`;
}

function Card({ icon: Icon, title, value, sub }) {
  return (
    <div className="rounded-2xl bg-white shadow ring-1 ring-neutral-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-neutral-500">{title}</div>
          <div className="mt-1 text-2xl font-black tracking-tight">{value}</div>
          {sub ? <div className="mt-1 text-xs text-neutral-500">{sub}</div> : null}
        </div>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-2">
          <Icon className="h-5 w-5 text-neutral-700" />
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, icon: Icon, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
        active
          ? "bg-neutral-900 text-white"
          : "border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50",
      ].join(" ")}
      type="button"
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export default function Compta() {
  const [gate, setGate] = useState("loading");
  const [gateMsg, setGateMsg] = useState("");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [courses, setCourses] = useState([]);
  const [rows, setRows] = useState([]);

  const [tab, setTab] = useState("releve"); // "releve" | "facture"
  const [vatRate, setVatRate] = useState(0); // % TVA (optionnel)

  const [filters, setFilters] = useState({
    search: "",
    course_id: "",
    event: "",
    date_from: startOfMonthISO(),
    date_to: endOfMonthISO(),
  });

  const printHeaderRef = useRef(null);

  async function checkAuth() {
    try {
      const { data: s } = await supabase.auth.getSession();
      const u = s?.session?.user;
      if (!u) {
        setGate("forbidden");
        setGateMsg("Connectez-vous pour accéder à la comptabilité.");
        return false;
      }
      setUser(u);

      // ⚠️ Champs facturation : si tu ne les as pas encore, ils seront juste vides (pas bloquant)
      const { data: p } = await supabase
        .from("profils_utilisateurs")
        .select(
          [
            "user_id",
            "email",
            "organisation_nom",
            "telephone",
            "site_web",
            "structure",
            // éventuels champs de facturation (si présents)
            "orga_email_facturation",
            "orga_titulaire_compte",
            "orga_siret",
            "orga_tva_intra",
            "orga_adresse_facturation",
            "orga_code_postal",
            "orga_ville",
            "orga_pays",
          ].join(",")
        )
        .eq("user_id", u.id)
        .maybeSingle();

      setProfile(p || null);
      setGate("ok");
      return true;
    } catch (e) {
      setGate("forbidden");
      setGateMsg(e?.message ?? String(e));
      return false;
    }
  }

  async function loadCourses(u) {
    const { data, error } = await supabase
      .from("courses")
      .select("id, nom")
      .eq("organisateur_id", u.id)
      .order("nom", { ascending: true });

    if (error) throw error;
    setCourses(data || []);
  }

  async function loadLedger(u) {
    setLoading(true);
    setErr(null);
    try {
      let q = supabase
        .from("organisateur_ledger")
        .select(
          [
            "id",
            "organisateur_id",
            "course_id",
            "source_event",
            "label",
            "occurred_at",
            "gross_cents",
            "tickrace_fee_cents",
            "stripe_fee_cents",
            "net_org_cents",
            "currency",
            "status",
            "source_table",
            "source_id",
          ].join(",")
        )
        .eq("organisateur_id", u.id);

      if (filters.course_id) q = q.eq("course_id", filters.course_id);
      if (filters.event) q = q.eq("source_event", filters.event);

      if (filters.date_from) q = q.gte("occurred_at", `${filters.date_from}T00:00:00+00`);
      if (filters.date_to) q = q.lte("occurred_at", `${filters.date_to}T23:59:59+00`);

      q = q.order("occurred_at", { ascending: false }).limit(2000);

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
    (async () => {
      const ok = await checkAuth();
      if (!ok) return;
      const { data: s } = await supabase.auth.getSession();
      const u = s?.session?.user;
      if (!u) return;

      try {
        await loadCourses(u);
      } catch {
        // non bloquant
      }
      await loadLedger(u);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (gate !== "ok" || !user) return;
    loadLedger(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify({ ...filters, search: "" })]); // search est client-side, ne déclenche pas un reload

  const courseMap = useMemo(() => {
    const m = {};
    for (const c of courses) m[c.id] = c.nom;
    return m;
  }, [courses]);

  const eventsList = useMemo(() => {
    const set = new Set(rows.map((r) => r.source_event).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  // Search client-side
  const filtered = useMemo(() => {
    const s = filters.search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const courseName = (courseMap[r.course_id] || "").toLowerCase();
      const label = (r.label || "").toLowerCase();
      const ev = (r.source_event || "").toLowerCase();
      const src = `${r.source_table || ""}:${r.source_id || ""}`.toLowerCase();
      return courseName.includes(s) || label.includes(s) || ev.includes(s) || src.includes(s);
    });
  }, [rows, filters.search, courseMap]);

  // Running balance on filtered (for relevé)
  const withRunning = useMemo(() => {
    const asc = [...filtered].sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
    let run = 0;
    const byId = new Map();
    for (const r of asc) {
      run += cents(r.net_org_cents);
      byId.set(r.id, run);
    }
    return filtered.map((r) => ({ ...r, running_cents: byId.get(r.id) ?? 0 }));
  }, [filtered]);

  // Totals for KPI cards (on rows sans search => période réelle)
  const totalsPeriod = useMemo(() => {
    const gross = rows.reduce((a, r) => a + cents(r.gross_cents), 0);
    const tick = rows.reduce((a, r) => a + cents(r.tickrace_fee_cents), 0);
    const stripe = rows.reduce((a, r) => a + cents(r.stripe_fee_cents), 0);
    const net = rows.reduce((a, r) => a + cents(r.net_org_cents), 0);
    return { gross, tick, stripe, net, count: rows.length };
  }, [rows]);

  // Facture TickRace : on facture la commission Tickrace sur la période
  const invoice = useMemo(() => {
    const orgName = profile?.organisation_nom || "Mon organisation";

    // Agrégation par course (commission)
    const byCourse = new Map();
    for (const r of rows) {
      const fee = cents(r.tickrace_fee_cents);
      if (!fee) continue;
      const cid = r.course_id || "—";
      byCourse.set(cid, (byCourse.get(cid) || 0) + fee);
    }

    const lines = Array.from(byCourse.entries())
      .map(([course_id, fee_cents]) => ({
        course_id,
        course_name: courseMap[course_id] || course_id,
        fee_cents,
      }))
      .sort((a, b) => b.fee_cents - a.fee_cents);

    const subtotal = lines.reduce((a, l) => a + cents(l.fee_cents), 0);
    const vat = Math.round((Math.max(0, Number(vatRate) || 0) / 100) * subtotal);
    const total = subtotal + vat;

    const periodFrom = filters.date_from || "";
    const periodTo = filters.date_to || "";

    const stamp = yyyymm(periodFrom) || "PERIODE";
    const invNo = `TR-${stamp}-${(user?.id || "ORG").slice(0, 6).toUpperCase()}`;

    return {
      orgName,
      periodFrom,
      periodTo,
      invNo,
      issuedAt: new Date(),
      lines,
      subtotal,
      vatRate: Math.max(0, Number(vatRate) || 0),
      vat,
      total,
      currency: "EUR",
    };
  }, [rows, courseMap, profile, filters.date_from, filters.date_to, vatRate, user?.id]);

  function resetFilters() {
    setFilters({
      search: "",
      course_id: "",
      event: "",
      date_from: startOfMonthISO(),
      date_to: endOfMonthISO(),
    });
  }

  function exportCSVReleve() {
    const header = [
      "Date",
      "Course",
      "Événement",
      "Libellé",
      "Brut (cents)",
      "Frais Tickrace (cents)",
      "Frais Stripe (cents)",
      "Net orga (cents)",
      "Solde cumulatif (cents)",
      "Devise",
      "Source",
    ];

    const lines = withRunning.map((r) => {
      const date = new Date(r.occurred_at).toLocaleString("fr-FR");
      const course = courseMap[r.course_id] || r.course_id || "";
      const src = `${r.source_table || ""}:${r.source_id || ""}`;
      return [
        date,
        course,
        r.source_event || "",
        r.label || "",
        cents(r.gross_cents),
        cents(r.tickrace_fee_cents),
        cents(r.stripe_fee_cents),
        cents(r.net_org_cents),
        cents(r.running_cents),
        r.currency || "eur",
        src,
      ]
        .map(csvEscape)
        .join(";");
    });

    const content = [header.join(";"), ...lines].join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const from = filters.date_from || "debut";
    const to = filters.date_to || "fin";
    a.href = url;
    a.download = `tickrace-releve-${from}-${to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportCSVFacture() {
    const header = ["Facture", "Période début", "Période fin", "Organisation", "Course", "Commission Tickrace (cents)"];
    const lines = invoice.lines.map((l) =>
      [
        invoice.invNo,
        invoice.periodFrom,
        invoice.periodTo,
        invoice.orgName,
        l.course_name,
        cents(l.fee_cents),
      ].map(csvEscape).join(";")
    );

    const content = [header.join(";"), ...lines].join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `tickrace-facture-${invoice.invNo}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function refresh() {
    if (!user) return;
    await loadLedger(user);
  }

  function printDoc() {
    window.print();
  }

  if (gate === "loading") return <div className="p-6">Chargement…</div>;
  if (gate === "forbidden") return <div className="p-6 text-red-600">403 — {gateMsg}</div>;

  const orgName = profile?.organisation_nom || "Mon organisation";

  const orgLine = [
    profile?.orga_titulaire_compte || "",
    profile?.orga_siret ? `SIRET: ${profile.orga_siret}` : "",
    profile?.orga_tva_intra ? `TVA: ${profile.orga_tva_intra}` : "",
  ]
    .filter(Boolean)
    .join(" — ");

  const addr = [
    profile?.orga_adresse_facturation || "",
    [profile?.orga_code_postal || "", profile?.orga_ville || ""].filter(Boolean).join(" "),
    profile?.orga_pays || "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
              <Wallet className="h-7 w-7 text-neutral-800" />
              Comptabilité organisateur
            </h1>
            <div className="mt-1 text-sm text-neutral-600">
              {orgName} {orgLine ? <span className="text-neutral-400">—</span> : null}{" "}
              {orgLine ? <span className="text-neutral-600">{orgLine}</span> : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              onClick={refresh}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
              type="button"
            >
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </button>

            {tab === "releve" ? (
              <button
                onClick={exportCSVReleve}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
                type="button"
              >
                <Download className="h-4 w-4" />
                Export relevé (CSV)
              </button>
            ) : (
              <button
                onClick={exportCSVFacture}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
                type="button"
              >
                <Download className="h-4 w-4" />
                Export facture (CSV)
              </button>
            )}

            <button
              onClick={printDoc}
              className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 text-white px-3 py-2 text-sm font-semibold hover:bg-neutral-800"
              type="button"
            >
              <Printer className="h-4 w-4" />
              Imprimer
            </button>
          </div>
        </div>

        {err ? (
          <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
            Erreur : {err}
          </div>
        ) : null}

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <TabButton active={tab === "releve"} icon={Receipt} onClick={() => setTab("releve")}>
            Relevé (ledger)
          </TabButton>
          <TabButton active={tab === "facture"} icon={FileText} onClick={() => setTab("facture")}>
            Facture TickRace
          </TabButton>
        </div>

        {/* KPIs */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card icon={Banknote} title="Brut encaissé (période)" value={eur(totalsPeriod.gross)} sub={`${totalsPeriod.count} écriture(s)`} />
          <Card icon={Tags} title="Frais Tickrace (période)" value={eur(totalsPeriod.tick)} sub="Commission plateforme" />
          <Card icon={Receipt} title="Frais Stripe (période)" value={eur(totalsPeriod.stripe)} sub="Frais réels Stripe" />
          <Card icon={BadgeEuro} title="Net organisateur (période)" value={eur(totalsPeriod.net)} sub="Somme des net_org_cents" />
        </div>

        {/* Filtres */}
        <div className="rounded-2xl bg-white shadow ring-1 ring-neutral-200 p-4 print:hidden">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
            <Filter className="h-4 w-4" />
            Filtres
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-12">
            <div className="md:col-span-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                <input
                  className="w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                  placeholder="Recherche (course, libellé, event, source…) "
                  value={filters.search}
                  onChange={(e) => setFilters((s) => ({ ...s, search: e.target.value }))}
                />
              </div>
            </div>

            <div className="md:col-span-3">
              <select
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                value={filters.course_id}
                onChange={(e) => setFilters((s) => ({ ...s, course_id: e.target.value }))}
              >
                <option value="">Toutes les courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <select
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                value={filters.event}
                onChange={(e) => setFilters((s) => ({ ...s, event: e.target.value }))}
              >
                <option value="">Tous events</option>
                {eventsList.map((ev) => (
                  <option key={ev} value={ev}>
                    {ev}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3 grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
                <CalendarDays className="h-4 w-4 text-neutral-500" />
                <input
                  type="date"
                  className="w-full text-sm outline-none"
                  value={filters.date_from}
                  onChange={(e) => setFilters((s) => ({ ...s, date_from: e.target.value }))}
                />
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
                <CalendarDays className="h-4 w-4 text-neutral-500" />
                <input
                  type="date"
                  className="w-full text-sm outline-none"
                  value={filters.date_to}
                  onChange={(e) => setFilters((s) => ({ ...s, date_to: e.target.value }))}
                />
              </label>
            </div>

            <div className="md:col-span-12 flex flex-wrap items-center gap-2">
              <button
                onClick={resetFilters}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
                type="button"
              >
                Réinitialiser
              </button>
              <div className="text-xs text-neutral-500">
                Astuce : le bouton “Imprimer” sort un document propre selon l’onglet sélectionné.
              </div>
            </div>
          </div>
        </div>

        {/* -------------------- ONGLET 1 : RELEVÉ -------------------- */}
        {tab === "releve" ? (
          <div className="rounded-2xl bg-white shadow ring-1 ring-neutral-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-neutral-800">Écritures (ledger)</div>
              <div className="text-xs text-neutral-500">{withRunning.length} ligne(s)</div>
            </div>

            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr className="text-left">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Course</th>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Libellé</th>
                    <th className="px-4 py-3 text-right">Brut</th>
                    <th className="px-4 py-3 text-right">Tickrace</th>
                    <th className="px-4 py-3 text-right">Stripe</th>
                    <th className="px-4 py-3 text-right">Net</th>
                    <th className="px-4 py-3 text-right">Solde cumulatif</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-neutral-500">
                        Chargement…
                      </td>
                    </tr>
                  ) : withRunning.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-neutral-500">
                        Aucune écriture sur la période sélectionnée.
                      </td>
                    </tr>
                  ) : (
                    withRunning.map((r) => {
                      const gross = cents(r.gross_cents);
                      const tick = cents(r.tickrace_fee_cents);
                      const stripe = cents(r.stripe_fee_cents);
                      const net = cents(r.net_org_cents);
                      const running = cents(r.running_cents);

                      const isNeg = net < 0;
                      return (
                        <tr key={r.id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                          <td className="px-4 py-3 whitespace-nowrap">
                            {new Date(r.occurred_at).toLocaleString("fr-FR")}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-neutral-900">{courseMap[r.course_id] || "—"}</div>
                            <div className="text-xs text-neutral-500 font-mono">{r.course_id || ""}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-neutral-700">
                            {r.source_event || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-neutral-900">{r.label || "—"}</div>
                            <div className="text-xs text-neutral-500 font-mono">
                              {r.source_table}:{r.source_id}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">{eur(gross)}</td>
                          <td className="px-4 py-3 text-right">{eur(tick)}</td>
                          <td className="px-4 py-3 text-right">{eur(stripe)}</td>
                          <td
                            className={[
                              "px-4 py-3 text-right font-semibold",
                              isNeg ? "text-red-700" : "text-emerald-700",
                            ].join(" ")}
                          >
                            {eur(net)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">{eur(running)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-4 border-t border-neutral-200 bg-neutral-50 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-neutral-700">
                Total brut : <b>{eur(totalsPeriod.gross)}</b>
              </span>
              <span className="text-neutral-700">
                Tickrace : <b>{eur(totalsPeriod.tick)}</b>
              </span>
              <span className="text-neutral-700">
                Stripe : <b>{eur(totalsPeriod.stripe)}</b>
              </span>
              <span className="text-neutral-900">
                Net période : <b>{eur(totalsPeriod.net)}</b>
              </span>
            </div>
          </div>
        ) : null}

        {/* -------------------- ONGLET 2 : FACTURE TICKRACE -------------------- */}
        {tab === "facture" ? (
          <div className="rounded-2xl bg-white shadow ring-1 ring-neutral-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-neutral-800">Facture TickRace (commission)</div>
              <div className="text-xs text-neutral-500">
                {invoice.periodFrom || "—"} → {invoice.periodTo || "—"}
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-12">
                <div className="md:col-span-8 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="text-xs font-semibold text-neutral-500">Infos facture</div>
                  <div className="mt-2 grid gap-1 text-sm text-neutral-800">
                    <div>
                      <b>Numéro :</b> <span className="font-mono">{invoice.invNo}</span>
                    </div>
                    <div>
                      <b>Date :</b> {invoice.issuedAt.toLocaleDateString("fr-FR")}
                    </div>
                    <div>
                      <b>Période :</b> {invoice.periodFrom || "—"} → {invoice.periodTo || "—"}
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-neutral-500">
                    Conseil : complète tes infos de facturation dans{" "}
                    <a className="text-orange-600 underline" href="/monprofilorganisateur">
                      Mon profil organisateur
                    </a>{" "}
                    (SIRET / adresse / email facturation).
                  </div>
                </div>

                <div className="md:col-span-4 rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="text-xs font-semibold text-neutral-500">TVA (optionnel)</div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={30}
                      step={0.1}
                      value={vatRate}
                      onChange={(e) => setVatRate(Number(e.target.value))}
                      className="w-24 rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                    />
                    <span className="text-sm text-neutral-700">% TVA</span>
                  </div>
                  <div className="mt-2 text-xs text-neutral-500">
                    Si tu n’appliques pas de TVA, laisse à 0.
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-neutral-200 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-4 py-3 text-left">Détail</th>
                      <th className="px-4 py-3 text-right">Commission TickRace</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.lines.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-4 py-6 text-neutral-500">
                          Aucune commission TickRace sur cette période.
                        </td>
                      </tr>
                    ) : (
                      invoice.lines.map((l) => (
                        <tr key={l.course_id} className="border-t border-neutral-100">
                          <td className="px-4 py-3">
                            <div className="font-medium text-neutral-900">{l.course_name}</div>
                            <div className="text-xs text-neutral-500 font-mono">{l.course_id}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">{eur(l.fee_cents)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-neutral-50 border-t border-neutral-200">
                    <tr>
                      <td className="px-4 py-3 text-right text-neutral-700">Sous-total</td>
                      <td className="px-4 py-3 text-right font-semibold">{eur(invoice.subtotal)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-right text-neutral-700">
                        TVA ({invoice.vatRate}%)
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{eur(invoice.vat)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-right text-neutral-900 font-semibold">Total</td>
                      <td className="px-4 py-3 text-right text-neutral-900 font-black">
                        {eur(invoice.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="text-xs text-neutral-500">
                Cette “facture” est un aperçu imprimable basé sur le ledger (commission TickRace).
                Étape suivante (si tu veux) : génération PDF + numérotation persistée en base.
              </div>
            </div>
          </div>
        ) : null}

        {/* -------------------- PRINT HEADER (selon onglet) -------------------- */}
        <div ref={printHeaderRef} className="hidden print:block">
          <div className="p-8">
            {tab === "releve" ? (
              <>
                <div className="text-2xl font-black">Relevé comptable — TickRace</div>
                <div className="mt-2 text-sm">
                  <div>
                    <b>Organisation :</b> {orgName}
                  </div>
                  {orgLine ? <div>{orgLine}</div> : null}
                  {addr ? <pre className="mt-2 whitespace-pre-wrap text-sm">{addr}</pre> : null}
                  <div className="mt-2">
                    <b>Période :</b> {filters.date_from || "—"} → {filters.date_to || "—"}
                  </div>
                  <div className="mt-2">
                    <b>Totaux :</b> Brut {eur(totalsPeriod.gross)} — Tickrace {eur(totalsPeriod.tick)} — Stripe{" "}
                    {eur(totalsPeriod.stripe)} — Net {eur(totalsPeriod.net)}
                  </div>
                </div>
                <div className="mt-6 text-xs text-neutral-600">Généré le {new Date().toLocaleString("fr-FR")}</div>
              </>
            ) : (
              <>
                <div className="text-2xl font-black">Facture — TickRace</div>
                <div className="mt-2 text-sm">
                  <div>
                    <b>N° :</b> <span className="font-mono">{invoice.invNo}</span>
                  </div>
                  <div>
                    <b>Date :</b> {invoice.issuedAt.toLocaleDateString("fr-FR")}
                  </div>
                  <div className="mt-2">
                    <b>Client :</b> {invoice.orgName}
                  </div>
                  {orgLine ? <div>{orgLine}</div> : null}
                  {addr ? <pre className="mt-2 whitespace-pre-wrap text-sm">{addr}</pre> : null}
                  <div className="mt-2">
                    <b>Période :</b> {invoice.periodFrom || "—"} → {invoice.periodTo || "—"}
                  </div>
                  <div className="mt-2">
                    <b>Total :</b> {eur(invoice.total)} (Sous-total {eur(invoice.subtotal)} + TVA {eur(invoice.vat)})
                  </div>
                </div>
                <div className="mt-6 text-xs text-neutral-600">Généré le {new Date().toLocaleString("fr-FR")}</div>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .print\\:block { display: block !important; }
          .print\\:hidden { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

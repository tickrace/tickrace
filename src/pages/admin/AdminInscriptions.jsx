import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";
import { getAdminInscriptions } from "../../utils/adminApi";

function eur(n) {
  const v = Number(n ?? 0);
  return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default function AdminInscriptions() {
  const [filters, setFilters] = useState({
    search: "",
    statut: "",
    course_id: "",
    format_id: "",
    date_from: "",
    date_to: "",
  });
  const [courses, setCourses] = useState([]);
  const [formats, setFormats] = useState([]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage]   = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // charger listes déroulantes (courses / formats)
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: cs } = await supabase.from("courses").select("id, nom").order("nom");
      if (alive) setCourses(cs || []);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!filters.course_id) { setFormats([]); return; }
      const { data: fs } = await supabase
        .from("formats")
        .select("id, nom, course_id")
        .eq("course_id", filters.course_id)
        .order("nom");
      if (alive) setFormats(fs || []);
    })();
    return () => { alive = false; };
  }, [filters.course_id]);

  async function load() {
    setLoading(true); setErr("");
    try {
      const offset = (page - 1) * pageSize;
      const { rows, total } = await getAdminInscriptions({ ...filters, limit: pageSize, offset });
      setRows(rows); setTotal(total);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, pageSize]);
  // recharge à la modification des filtres
  useEffect(() => { setPage(1); load(); /* eslint-disable-next-line */ }, [JSON.stringify(filters)]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  function exportCSV() {
    const header = [
      "created_at","statut","course_nom","format_nom","format_date","coureur_nom","coureur_prenom","coureur_email",
      "dossard","nombre_repas","prix_total_coureur","prix_total_repas","montant_total"
    ];
    const lines = rows.map(r => [
      r.created_at,
      r.statut,
      (r.course_nom || "").replaceAll(";"," "),
      (r.format_nom || "").replaceAll(";"," "),
      r.format_date || "",
      (r.coureur_nom || "").replaceAll(";"," "),
      (r.coureur_prenom || "").replaceAll(";"," "),
      r.coureur_email || "",
      r.dossard ?? "",
      r.nombre_repas ?? 0,
      r.prix_total_coureur ?? 0,
      r.prix_total_repas ?? 0,
      r.montant_total ?? 0,
    ].join(";"));
    const blob = new Blob([header.join(";") + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `inscriptions_page${page}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Admin — Inscriptions</h1>

      {err && <div className="p-3 border border-red-200 bg-red-50 text-red-700 rounded">{err}</div>}

      {/* Filtres */}
      <div className="grid gap-3 md:grid-cols-6">
        <input
          className="border rounded px-2 py-1"
          placeholder="Recherche (nom, email)"
          value={filters.search}
          onChange={(e) => setFilters(s => ({ ...s, search: e.target.value }))}
        />
        <select
          className="border rounded px-2 py-1"
          value={filters.statut}
          onChange={(e) => setFilters(s => ({ ...s, statut: e.target.value }))}
        >
          <option value="">Tous statuts</option>
          <option value="validé">Validé</option>
          <option value="en attente">En attente</option>
          <option value="annulé">Annulé</option>
          <option value="remboursé">Remboursé</option>
        </select>
        <select
          className="border rounded px-2 py-1"
          value={filters.course_id}
          onChange={(e) => setFilters(s => ({ ...s, course_id: e.target.value, format_id: "" }))}
        >
          <option value="">Toutes courses</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <select
          className="border rounded px-2 py-1"
          value={filters.format_id}
          onChange={(e) => setFilters(s => ({ ...s, format_id: e.target.value }))}
          disabled={!filters.course_id}
        >
          <option value="">{filters.course_id ? "Tous formats" : "Sélectionner une course"}</option>
          {formats.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
        </select>
        <input
          type="date"
          className="border rounded px-2 py-1"
          value={filters.date_from}
          onChange={(e) => setFilters(s => ({ ...s, date_from: e.target.value }))}
        />
        <input
          type="date"
          className="border rounded px-2 py-1"
          value={filters.date_to}
          onChange={(e) => setFilters(s => ({ ...s, date_to: e.target.value }))}
        />
      </div>

      <div className="flex items-center gap-2">
        <button className="border rounded px-3 py-1" onClick={() => { setPage(1); load(); }}>Appliquer</button>
        <button className="border rounded px-3 py-1" onClick={() => setFilters({ search:"", statut:"", course_id:"", format_id:"", date_from:"", date_to:"" })}>
          Réinitialiser
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-600">Total: {total}</span>
          <button className="border rounded px-3 py-1" onClick={exportCSV}>Export CSV (page)</button>
        </div>
      </div>

      {/* Tableau */}
      <div className="rounded-xl border overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Course / Format</th>
              <th className="px-3 py-2 text-left">Coureur</th>
              <th className="px-3 py-2 text-left">Statut</th>
              <th className="px-3 py-2 text-right">Montant</th>
              <th className="px-3 py-2 text-right">Repas</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-left">Dossard</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-4 text-gray-500" colSpan={8}>Chargement…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={8}>Aucune inscription</td></tr>
            ) : rows.map(r => (
              <tr key={r.inscription_id} className="border-t">
                <td className="px-3 py-2">{new Date(r.created_at).toLocaleString("fr-FR")}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">{r.course_nom}</div>
                  <div className="text-gray-500">{r.format_nom} {r.format_date ? `— ${new Date(r.format_date).toLocaleDateString("fr-FR")}` : ""}</div>
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{r.coureur_prenom} {r.coureur_nom}</div>
                  <div className="text-gray-500">{r.coureur_email}</div>
                </td>
                <td className="px-3 py-2">{r.statut}</td>
                <td className="px-3 py-2 text-right">{eur(r.prix_total_coureur)}</td>
                <td className="px-3 py-2 text-right">{eur(r.prix_total_repas)}</td>
                <td className="px-3 py-2 text-right font-semibold">{eur(r.montant_total)}</td>
                <td className="px-3 py-2">{r.dossard ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">Page {page} / {pages}</div>
        <div className="flex items-center gap-2">
          <button className="border rounded px-3 py-1" disabled={page<=1} onClick={() => setPage(p => Math.max(1, p-1))}>Préc.</button>
          <button className="border rounded px-3 py-1" disabled={page>=pages} onClick={() => setPage(p => Math.min(pages, p+1))}>Suiv.</button>
          <select className="border rounded px-2 py-1" value={pageSize} onChange={(e)=>{ setPageSize(Number(e.target.value)); setPage(1);} }>
            {[25,50,100].map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

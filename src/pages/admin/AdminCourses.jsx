import React, { useEffect, useMemo, useState } from "react";
import { useUser } from "../../contexts/UserContext";
import { callAdminFn } from "../../utils/callAdminFn";

const ORDERABLE = [
  { value: "course_nom", label: "Nom" },
  { value: "total_inscriptions", label: "Inscriptions (total)" },
  { value: "inscriptions_validees", label: "Validées" },
  { value: "ca_brut", label: "CA brut (€)" },
];

export default function AdminCourses() {
  const { session } = useUser();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [organiserId, setOrganiserId] = useState("");
  const [orderBy, setOrderBy] = useState("course_nom");
  const [orderDir, setOrderDir] = useState("asc");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const offset = useMemo(() => (page - 1) * limit, [page, limit]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await callAdminFn("admin-courses-kpis", session, {
        body: {
          search: search || null,
          organiser_id: organiserId || null,
          order_by: orderBy,
          order_dir: orderDir,
          limit,
          offset,
        },
      });
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderBy, orderDir, limit, offset]); // fetch initial + on sort/pagination

  const onSubmitFilters = (e) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  const pagesCount = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Courses — KPIs</h1>
        <p className="opacity-70 text-sm">Vue consolidée des courses (inscriptions & CA brut).</p>
      </div>

      {/* Filtres */}
      <form onSubmit={onSubmitFilters} className="grid gap-3 md:grid-cols-4 lg:grid-cols-6 items-end">
        <div className="col-span-2">
          <label className="text-sm opacity-70">Recherche (nom de course)</label>
          <input
            className="w-full border rounded-xl px-3 py-2"
            placeholder="ex: Templiers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm opacity-70">Organisateur ID (optionnel)</label>
          <input
            className="w-full border rounded-xl px-3 py-2"
            placeholder="uuid organisateur"
            value={organiserId}
            onChange={(e) => setOrganiserId(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm opacity-70">Trier par</label>
          <select
            className="w-full border rounded-xl px-3 py-2"
            value={orderBy}
            onChange={(e) => setOrderBy(e.target.value)}
          >
            {ORDERABLE.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm opacity-70">Ordre</label>
          <select
            className="w-full border rounded-xl px-3 py-2"
            value={orderDir}
            onChange={(e) => setOrderDir(e.target.value)}
          >
            <option value="asc">Ascendant</option>
            <option value="desc">Descendant</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 border rounded-xl shadow-sm hover:shadow transition"
            disabled={loading}
          >
            {loading ? "Chargement…" : "Appliquer"}
          </button>
          <button
            type="button"
            className="px-4 py-2 border rounded-xl"
            onClick={() => { setSearch(""); setOrganiserId(""); setOrderBy("course_nom"); setOrderDir("asc"); setPage(1); fetchData(); }}
            disabled={loading}
          >
            Réinitialiser
          </button>
        </div>
      </form>

      {/* Tableau */}
      <div className="overflow-x-auto">
        <table className="min-w-[800px] w-full border rounded-2xl overflow-hidden">
          <thead className="bg-gray-50">
            <tr className="[&>th]:text-left [&>th]:p-3 [&>th]:text-sm [&>th]:font-semibold">
              <th>Course</th>
              <th className="text-right">Inscriptions</th>
              <th className="text-right">Validées</th>
              <th className="text-right">CA brut (€)</th>
              <th>Organisateur</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="[&>tr>td]:p-3">
            {err && (
              <tr><td colSpan={6} className="text-red-600">{err}</td></tr>
            )}
            {!err && rows.length === 0 && !loading && (
              <tr><td colSpan={6} className="opacity-70">Aucune course.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.course_id} className="border-t">
                <td className="font-medium">{r.course_nom}</td>
                <td className="text-right tabular-nums">{r.total_inscriptions ?? 0}</td>
                <td className="text-right tabular-nums">{r.inscriptions_validees ?? 0}</td>
                <td className="text-right tabular-nums">{Number(r.ca_brut ?? 0).toFixed(2)}</td>
                <td className="text-xs opacity-70">{r.organisateur_id}</td>
                <td className="text-sm">
                  <div className="flex gap-2">
                    <a className="underline" href={`/course/${r.course_id}`} target="_blank" rel="noreferrer">Voir page publique</a>
                    <a className="underline" href={`/organisateur/course/${r.course_id}`} target="_blank" rel="noreferrer">Ouvrir Organisateur</a>
                  </div>
                </td>
              </tr>
            ))}
            {loading && (
              <tr><td colSpan={6} className="opacity-70">Chargement…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm opacity-70">
          {total} résultats — page {page}/{pagesCount}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 border rounded-lg"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            Précédent
          </button>
          <button
            className="px-3 py-1 border rounded-lg"
            onClick={() => setPage((p) => Math.min(pagesCount, p + 1))}
            disabled={page >= pagesCount || loading}
          >
            Suivant
          </button>
          <select
            className="ml-2 border rounded-lg px-2 py-1"
            value={limit}
            onChange={(e) => { setPage(1); setLimit(Number(e.target.value)); }}
            disabled={loading}
          >
            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { getAdminCoursesKpis } from "../../utils/adminApi";

export default function AdminCourses() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await getAdminCoursesKpis({ limit: 100, offset: 0 });
        if (alive) setRows(data);
      } catch (e) {
        if (alive) setErr(e.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (err) return <div className="p-4 text-red-600">Erreur: {err}</div>;
  if (loading) return <div className="p-4">Chargement…</div>;

  return (
    <div className="p-4">
      <div className="rounded-xl border overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Course</th>
              <th className="px-3 py-2 text-right">Inscrits</th>
              <th className="px-3 py-2 text-right">Validés</th>
              <th className="px-3 py-2 text-right">CA brut (€)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.course_id} className="border-t">
                <td className="px-3 py-2">{r.course_nom ?? r.course_id}</td>
                <td className="px-3 py-2 text-right">{r.total_inscriptions ?? "-"}</td>
                <td className="px-3 py-2 text-right">{r.inscriptions_validees ?? "-"}</td>
                <td className="px-3 py-2 text-right">{r.ca_brut ?? "-"}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={4}>Aucune course</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

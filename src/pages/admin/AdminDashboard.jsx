import React, { useEffect, useState } from "react";
import { callAdminFn } from "../../utils/callAdminFn";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const json = await callAdminFn("admin-stats", {});
        if (alive) setData(json);
      } catch (e) {
        if (alive) setErr(e.message || String(e));
      }
    })();
    return () => { alive = false; };
  }, []);

  if (err) return <div className="p-4 text-red-600">Erreur: {err}</div>;
  if (!data) return <div className="p-4">Chargement…</div>;

  // Affichage simple des KPI
  return (
    <div className="p-4 grid gap-4 md:grid-cols-3">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="rounded-xl border p-4">
          <div className="text-sm text-gray-500">{k}</div>
          <div className="text-2xl font-semibold">{String(v)}</div>
        </div>
      ))}
    </div>
  );
}

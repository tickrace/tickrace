import React, { useEffect, useState } from "react";
import { getAdminStats } from "../../utils/adminApi";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getAdminStats();
        if (alive) setStats(s);
      } catch (e) {
        if (alive) setErr(e.message || String(e));
      }
    })();
    return () => { alive = false; };
  }, []);

  if (err) return <div className="p-4 text-red-600">Erreur: {err}</div>;
  if (!stats) return <div className="p-4">Chargement…</div>;

  const items = [
    { label: "Courses", value: stats.nb_courses },
    { label: "Formats", value: stats.nb_formats },
    { label: "Inscriptions", value: stats.nb_inscriptions },
    { label: "Organisateurs", value: stats.nb_organisateurs },
    { label: "CA brut (€)", value: stats.ca_brut },
  ];

  return (
    <div className="p-4 grid gap-4 md:grid-cols-3">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl border p-4">
          <div className="text-sm text-gray-500">{it.label}</div>
          <div className="text-2xl font-semibold">{it.value ?? "-"}</div>
        </div>
      ))}
    </div>
  );
}

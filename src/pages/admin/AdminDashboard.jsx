import React, { useEffect, useState } from "react";
import { useUser } from "../../contexts/UserContext";
import { callAdminFn } from "../../utils/callAdminFn";

export default function AdminDashboard() {
  const { session } = useUser();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await callAdminFn("admin-stats", session);
        setStats(data);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [session]);

  if (error) return <div className="text-red-600">Erreur: {error}</div>;
  if (!stats) return null;

  const cards = [
    { label: "Courses", value: stats.total_courses },
    { label: "Formats", value: stats.total_formats },
    { label: "Inscriptions", value: stats.total_inscriptions },
    { label: "Validées", value: stats.inscriptions_validees },
    { label: "CA total (brut)", value: `${Number(stats.ca_brut_total).toFixed(2)} €` },
    { label: "CA 30j", value: `${Number(stats.ca_brut_30j).toFixed(2)} €` },
    { label: "Validées 30j", value: stats.inscriptions_validees_30j },
  ];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c, i) => (
        <div key={i} className="rounded-2xl border p-4 shadow-sm">
          <div className="text-sm opacity-70">{c.label}</div>
          <div className="text-2xl font-semibold mt-1">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

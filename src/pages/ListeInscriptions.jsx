// src/pages/ListeInscriptions.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { Download, Loader } from "lucide-react";

export default function ListeInscriptions() {
  const [inscriptions, setInscriptions] = useState([]);
  const [filtreStatut, setFiltreStatut] = useState("tous");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInscriptions();
  }, []);

  const fetchInscriptions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("inscriptions")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) {
      setInscriptions(data);
    }
    setLoading(false);
  };

  const handleStatutChange = async (id, newStatut) => {
    const { error } = await supabase
      .from("inscriptions")
      .update({ statut: newStatut })
      .eq("id", id);

    if (!error) {
      setInscriptions((prev) =>
        prev.map((insc) =>
          insc.id === id ? { ...insc, statut: newStatut } : insc
        )
      );
      alert("Statut mis à jour.");
    }
  };

  const filteredInscriptions = inscriptions.filter((insc) => {
    const matchStatut =
      filtreStatut === "tous" || insc.statut === filtreStatut;
    const matchSearch =
      insc.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insc.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insc.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatut && matchSearch;
  });

  const exportCSV = () => {
    const headers = Object.keys(inscriptions[0] || {}).join(",");
    const rows = inscriptions
      .map((insc) =>
        Object.values(insc)
          .map((v) =>
            typeof v === "string" && v.includes(",") ? `"${v}"` : v ?? ""
          )
          .join(",")
      )
      .join("\n");

    const csvContent = [headers, rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "inscriptions.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="p-6">
        <Loader className="animate-spin" /> Chargement des inscriptions...
      </div>
    );
  }

  return (
    <div className="p-6 overflow-x-auto">
      <h1 className="text-2xl font-bold mb-4">Liste des inscriptions</h1>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <input
          type="text"
          placeholder="Rechercher (nom, prénom, email)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border p-2 rounded w-full sm:w-1/3"
        />

        <select
          value={filtreStatut}
          onChange={(e) => setFiltreStatut(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="tous">Tous les statuts</option>
          <option value="en attente">En attente</option>
          <option value="validé">Validé</option>
          <option value="refusé">Refusé</option>
        </select>

        <button
          onClick={exportCSV}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center"
        >
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </button>
      </div>

      <table className="min-w-[1500px] border text-sm">
        <thead className="bg-gray-100">
          <tr>
            {Object.keys(inscriptions[0] || {}).map((key) => (
              <th key={key} className="border px-2 py-1 text-left">
                {key}
              </th>
            ))}
            <th className="border px-2 py-1">Modifier statut</th>
          </tr>
        </thead>
        <tbody>
          {filteredInscriptions.map((insc) => (
            <tr key={insc.id}>
              {Object.values(insc).map((value, idx) => (
                <td key={idx} className="border px-2 py-1">
                  {value === true
                    ? "Oui"
                    : value === false
                    ? "Non"
                    : value ?? ""}
                </td>
              ))}
              <td className="border px-2 py-1">
                <select
                  value={insc.statut || "en attente"}
                  onChange={(e) =>
                    handleStatutChange(insc.id, e.target.value)
                  }
                  className="border p-1 text-sm"
                >
                  <option value="en attente">En attente</option>
                  <option value="validé">Validé</option>
                  <option value="refusé">Refusé</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

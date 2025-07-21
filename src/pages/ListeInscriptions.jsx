import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function ListeInscriptions() {
  const { formatId } = useParams();
  const [inscriptions, setInscriptions] = useState([]);
  const [formatNom, setFormatNom] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("tous");
  const [sortField, setSortField] = useState("created_at");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    fetchInscriptions();
  }, [formatId]);

  const fetchInscriptions = async () => {
    const { data, error } = await supabase
      .from("inscriptions")
      .select("*")
      .eq("format_id", formatId)
      .order("created_at", { ascending: false });

    if (!error) {
      setInscriptions(data);
    }

    const { data: formatData } = await supabase
      .from("formats")
      .select("nom")
      .eq("id", formatId)
      .single();

    if (formatData) setFormatNom(formatData.nom);
  };

  const handleStatutChange = async (id, newStatut) => {
    await supabase.from("inscriptions").update({ statut: newStatut }).eq("id", id);
    fetchInscriptions();
  };

  const handleDossardChange = async (id, dossard) => {
    await supabase.from("inscriptions").update({ numero_dossard: dossard }).eq("id", id);
    fetchInscriptions();
  };

  const filtered = inscriptions
    .filter(i => {
      const term = search.toLowerCase();
      return (
        i.nom?.toLowerCase().includes(term) ||
        i.prenom?.toLowerCase().includes(term) ||
        i.email?.toLowerCase().includes(term)
      );
    })
    .filter(i => {
      if (filterStatut === "tous") return true;
      return i.statut === filterStatut;
    })
    .sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA === valB) return 0;
      return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

  const toggleSort = (field) => {
    if (field === sortField) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const exportToExcel = async () => {
    const XLSX = await import("xlsx");
    const { saveAs } = await import("file-saver");
    const worksheet = XLSX.utils.json_to_sheet(filtered);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inscriptions");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const file = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(file, `inscriptions_${formatNom}.xlsx`);
  };

  const exportToCSV = async () => {
    const XLSX = await import("xlsx");
    const { saveAs } = await import("file-saver");
    const worksheet = XLSX.utils.json_to_sheet(filtered);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `inscriptions_${formatNom}.csv`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text(`Inscriptions – ${formatNom}`, 14, 10);
    const table = filtered.map((i) => [
      i.nom,
      i.prenom,
      i.email,
      i.numero_dossard,
      i.statut,
    ]);
    doc.autoTable({
      head: [["Nom", "Prénom", "Email", "Dossard", "Statut"]],
      body: table,
    });
    doc.save(`inscriptions_${formatNom}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 max-w-[95vw] overflow-x-auto">
      <h1 className="text-2xl font-bold mb-4">Inscriptions – {formatNom}</h1>

      <div className="flex flex-wrap gap-4 mb-4 items-center">
        <input
          type="text"
          placeholder="🔍 Rechercher"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded"
        />
        <select
          value={filterStatut}
          onChange={(e) => setFilterStatut(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="tous">Tous les statuts</option>
          <option value="en attente">En attente</option>
          <option value="validé">Validé</option>
        </select>

        <button onClick={exportToExcel} className="bg-green-600 text-white px-3 py-1 rounded">⬇️ Excel</button>
        <button onClick={exportToCSV} className="bg-blue-600 text-white px-3 py-1 rounded">⬇️ CSV</button>
        <button onClick={exportToPDF} className="bg-gray-600 text-white px-3 py-1 rounded">⬇️ PDF</button>
        <button onClick={handlePrint} className="bg-yellow-600 text-white px-3 py-1 rounded">🖨️ Imprimer</button>
      </div>

      <table className="min-w-full border text-sm bg-white">
        <thead>
          <tr className="bg-gray-100">
            {["nom", "prenom", "email", "telephone", "date_naissance", "nationalite", "club", "statut", "numero_dossard", "created_at"].map((field) => (
              <th
                key={field}
                onClick={() => toggleSort(field)}
                className="p-2 border cursor-pointer"
              >
                {field} {sortField === field ? (sortAsc ? "▲" : "▼") : ""}
              </th>
            ))}
            <th className="p-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((i) => (
            <tr key={i.id} className="border-b hover:bg-gray-50">
              <td className="p-2 border">{i.nom}</td>
              <td className="p-2 border">{i.prenom}</td>
              <td className="p-2 border">{i.email}</td>
              <td className="p-2 border">{i.telephone}</td>
              <td className="p-2 border">{i.date_naissance}</td>
              <td className="p-2 border">{i.nationalite}</td>
              <td className="p-2 border">{i.club}</td>
              <td className="p-2 border">
                <select
                  value={i.statut}
                  onChange={(e) => handleStatutChange(i.id, e.target.value)}
                  className="border rounded p-1"
                >
                  <option value="en attente">⏳ En attente</option>
                  <option value="validé">✅ Validé</option>
                </select>
              </td>
              <td className="p-2 border">
                <input
                  type="text"
                  value={i.numero_dossard || ""}
                  onChange={(e) => handleDossardChange(i.id, e.target.value)}
                  className="border p-1 rounded w-20"
                />
              </td>
              <td className="p-2 border">{new Date(i.created_at).toLocaleString()}</td>
              <td className="p-2 border">-</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

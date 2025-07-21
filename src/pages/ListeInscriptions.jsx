import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function ListeInscriptions() {
  const { format_id } = useParams();
  const [inscrits, setInscrits] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [formatNom, setFormatNom] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statutFilter, setStatutFilter] = useState("tous");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  useEffect(() => {
    fetchData();
  }, [format_id]);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, statutFilter, inscrits, sortConfig]);

  const fetchData = async () => {
    const { data: format } = await supabase
      .from("formats")
      .select("nom")
      .eq("id", format_id)
      .single();

    setFormatNom(format?.nom || "");

    const { data } = await supabase
      .from("inscriptions")
      .select("*")
      .eq("format_id", format_id)
      .order("created_at", { ascending: true });

    setInscrits(data || []);
  };

  const applyFilters = () => {
    let filteredData = [...inscrits];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredData = filteredData.filter(
        (i) =>
          i.nom?.toLowerCase().includes(term) ||
          i.prenom?.toLowerCase().includes(term) ||
          i.email?.toLowerCase().includes(term) ||
          i.club?.toLowerCase().includes(term)
      );
    }

    if (statutFilter !== "tous") {
      filteredData = filteredData.filter((i) => i.statut === statutFilter);
    }

    if (sortConfig.key) {
      filteredData.sort((a, b) => {
        const aVal = a[sortConfig.key] || "";
        const bVal = b[sortConfig.key] || "";
        return sortConfig.direction === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      });
    }

    setFiltered(filteredData);
  };

  const requestSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleValidate = async (id) => {
    await supabase.from("inscriptions").update({ statut: "validé" }).eq("id", id);
    fetchData();
  };

  const handleDossardChange = async (id, newValue) => {
    await supabase.from("inscriptions").update({ dossard: parseInt(newValue) || null }).eq("id", id);
    fetchData();
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filtered);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inscriptions");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const file = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(file, `inscriptions_${formatNom}.xlsx`);
  };

  const exportToCSV = () => {
    const worksheet = XLSX.utils.json_to_sheet(filtered);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `inscriptions_${formatNom}.csv`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const tableColumn = Object.keys(filtered[0] || {});
    const tableRows = filtered.map((i) => tableColumn.map((col) => i[col] || ""));
    doc.text(`Liste des inscrits – ${formatNom}`, 10, 10);
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      styles: { fontSize: 7 },
    });
    doc.save(`inscriptions_${formatNom}.pdf`);
  };

  const printTable = () => {
    const printContent = document.getElementById("table-inscriptions").outerHTML;
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html><head><title>Impression</title></head>
      <body>${printContent}</body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="p-6 max-w-[95%] mx-auto">
      <h1 className="text-2xl font-bold mb-4">Inscriptions – {formatNom}</h1>

      <div className="flex flex-wrap gap-4 mb-4 items-center">
        <input
          type="text"
          placeholder="🔍 Rechercher par nom, prénom, email, club..."
          className="border px-3 py-2 rounded w-72"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="border px-3 py-2 rounded"
          value={statutFilter}
          onChange={(e) => setStatutFilter(e.target.value)}
        >
          <option value="tous">🎯 Tous les statuts</option>
          <option value="en attente">🕒 En attente</option>
          <option value="validé">✅ Validé</option>
        </select>

        <button onClick={exportToCSV} className="bg-blue-500 text-white px-3 py-1 rounded">📄 CSV</button>
        <button onClick={exportToExcel} className="bg-green-600 text-white px-3 py-1 rounded">📊 Excel</button>
        <button onClick={exportToPDF} className="bg-red-600 text-white px-3 py-1 rounded">📄 PDF</button>
        <button onClick={printTable} className="bg-gray-600 text-white px-3 py-1 rounded">🖨️ Imprimer</button>
      </div>

      {filtered.length === 0 ? (
        <p>Aucune inscription trouvée.</p>
      ) : (
        <div className="overflow-auto">
          <table id="table-inscriptions" className="min-w-[1200px] border border-gray-300 text-sm">
            <thead className="bg-gray-100">
              <tr>
                {[
                  "nom", "prenom", "genre", "date_naissance", "nationalite",
                  "email", "telephone", "adresse", "code_postal", "ville", "pays",
                  "club", "justificatif_type", "contact_urgence_nom", "contact_urgence_telephone",
                  "apparaitre_resultats", "dossard", "statut", "created_at"
                ].map((col) => (
                  <th
                    key={col}
                    className="border p-1 cursor-pointer"
                    onClick={() => requestSort(col)}
                  >
                    {col.replaceAll("_", " ").toUpperCase()} {sortConfig.key === col ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
                  </th>
                ))}
                <th className="border p-1">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id}>
                  <td className="border p-1">{i.nom}</td>
                  <td className="border p-1">{i.prenom}</td>
                  <td className="border p-1">{i.genre}</td>
                  <td className="border p-1">{i.date_naissance}</td>
                  <td className="border p-1">{i.nationalite}</td>
                  <td className="border p-1">{i.email}</td>
                  <td className="border p-1">{i.telephone}</td>
                  <td className="border p-1">{i.adresse}</td>
                  <td className="border p-1">{i.code_postal}</td>
                  <td className="border p-1">{i.ville}</td>
                  <td className="border p-1">{i.pays}</td>
                  <td className="border p-1">{i.club}</td>
                  <td className="border p-1">{i.justificatif_type}</td>
                  <td className="border p-1">{i.contact_urgence_nom}</td>
                  <td className="border p-1">{i.contact_urgence_telephone}</td>
                  <td className="border p-1">{i.apparaitre_resultats ? "✅" : "❌"}</td>
                  <td className="border p-1">
                    <input
                      type="number"
                      value={i.dossard || ""}
                      onChange={(e) => handleDossardChange(i.id, e.target.value)}
                      className="w-16 border rounded text-center"
                    />
                  </td>
                  <td className="border p-1">{i.statut}</td>
                  <td className="border p-1">{new Date(i.created_at).toLocaleString()}</td>
                  <td className="border p-1 text-center">
                    {i.statut !== "validé" && (
                      <button onClick={() => handleValidate(i.id)} className="text-green-600 underline">
                        Valider
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

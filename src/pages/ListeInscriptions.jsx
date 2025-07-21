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
  const [formatNom, setFormatNom] = useState("");

  useEffect(() => {
    fetchData();
  }, [format_id]);

  const fetchData = async () => {
    const { data: format } = await supabase
      .from("formats")
      .select("nom")
      .eq("id", format_id)
      .single();

    setFormatNom(format?.nom || "");

    const { data: inscriptions } = await supabase
      .from("inscriptions")
      .select("*")
      .eq("format_id", format_id)
      .order("created_at", { ascending: true });

    setInscrits(inscriptions || []);
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
    const worksheet = XLSX.utils.json_to_sheet(inscrits);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inscriptions");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const file = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(file, `inscriptions_${formatNom}.xlsx`);
  };

  const exportToCSV = () => {
    const worksheet = XLSX.utils.json_to_sheet(inscrits);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `inscriptions_${formatNom}.csv`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const tableColumn = Object.keys(inscrits[0] || {});
    const tableRows = inscrits.map((i) => tableColumn.map((col) => i[col] || ""));
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
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Inscriptions – {formatNom}</h1>

      <div className="flex gap-3 mb-4">
        <button onClick={exportToCSV} className="bg-blue-500 text-white px-3 py-1 rounded">📄 Export CSV</button>
        <button onClick={exportToExcel} className="bg-green-600 text-white px-3 py-1 rounded">📊 Export Excel</button>
        <button onClick={exportToPDF} className="bg-red-600 text-white px-3 py-1 rounded">📄 Export PDF</button>
        <button onClick={printTable} className="bg-gray-600 text-white px-3 py-1 rounded">🖨️ Imprimer</button>
      </div>

      {inscrits.length === 0 ? (
        <p>Aucune inscription pour ce format.</p>
      ) : (
        <div className="overflow-auto">
          <table id="table-inscriptions" className="min-w-[1200px] border border-gray-300 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-1">Nom</th>
                <th className="border p-1">Prénom</th>
                <th className="border p-1">Genre</th>
                <th className="border p-1">Naissance</th>
                <th className="border p-1">Nationalité</th>
                <th className="border p-1">Email</th>
                <th className="border p-1">Téléphone</th>
                <th className="border p-1">Adresse</th>
                <th className="border p-1">Code postal</th>
                <th className="border p-1">Ville</th>
                <th className="border p-1">Pays</th>
                <th className="border p-1">Club</th>
                <th className="border p-1">Justificatif</th>
                <th className="border p-1">Contact urgence</th>
                <th className="border p-1">Apparaitre</th>
                <th className="border p-1">Dossard</th>
                <th className="border p-1">Statut</th>
                <th className="border p-1">Créé le</th>
                <th className="border p-1">Action</th>
              </tr>
            </thead>
            <tbody>
              {inscrits.map((i) => (
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
                  <td className="border p-1">
                    {i.contact_urgence_nom} - {i.contact_urgence_telephone}
                  </td>
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

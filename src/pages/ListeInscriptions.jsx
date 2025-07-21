import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function ListeInscriptions() {
  const { formatId } = useParams();
  const [inscriptions, setInscriptions] = useState([]);
  const [formatNom, setFormatNom] = useState("");
  const [search, setSearch] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("tous");
  const [tri, setTri] = useState({ colonne: "created_at", ordre: "desc" });

  useEffect(() => {
    fetchInscriptions();
  }, [formatId]);

  const fetchInscriptions = async () => {
    const { data, error } = await supabase
      .from("inscriptions")
      .select("*")
      .eq("format_id", formatId);

    if (!error && data) {
      setInscriptions(data);
      if (data.length > 0) {
        setFormatNom(data[0].format_nom || "Format");
      }
    }
  };

  const handleChangeDossard = async (id, nouveauDossard) => {
    await supabase
      .from("inscriptions")
      .update({ numero_dossard: nouveauDossard })
      .eq("id", id);
    fetchInscriptions();
  };

  const handleValider = async (id) => {
    await supabase
      .from("inscriptions")
      .update({ statut: "validé" })
      .eq("id", id);
    fetchInscriptions();
  };

  const filtered = inscriptions
    .filter((inscrit) => {
      const texte =
        `${inscrit.nom} ${inscrit.prenom} ${inscrit.email} ${inscrit.club}`.toLowerCase();
      return texte.includes(search.toLowerCase());
    })
    .filter((i) => filtreStatut === "tous" || i.statut === filtreStatut)
    .sort((a, b) => {
      const valA = a[tri.colonne];
      const valB = b[tri.colonne];
      if (valA < valB) return tri.ordre === "asc" ? -1 : 1;
      if (valA > valB) return tri.ordre === "asc" ? 1 : -1;
      return 0;
    });

  const toggleTri = (col) => {
    setTri((prev) => ({
      colonne: col,
      ordre: prev.colonne === col && prev.ordre === "asc" ? "desc" : "asc",
    }));
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const columns = [
      "Nom",
      "Prénom",
      "Email",
      "Date inscription",
      "Statut",
      "Dossard",
    ];
    const rows = filtered.map((i) => [
      i.nom,
      i.prenom,
      i.email,
      new Date(i.created_at).toLocaleString(),
      i.statut,
      i.numero_dossard || "",
    ]);
    doc.text(`Inscriptions – ${formatNom}`, 14, 10);
    doc.autoTable({ head: [columns], body: rows, startY: 20 });
    doc.save(`inscriptions_${formatNom}.pdf`);
  };

  const exportToExcel = async () => {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.json_to_sheet(filtered);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inscriptions");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const file = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(file, `inscriptions_${formatNom}.xlsx`);
  };

  const exportToCSV = async () => {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.json_to_sheet(filtered);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `inscriptions_${formatNom}.csv`);
  };

  const imprimer = () => {
    window.print();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        Liste des inscrits – {formatNom}
      </h1>

      <div className="flex flex-wrap gap-4 mb-4">
        <input
          type="text"
          placeholder="🔍 Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded w-full sm:w-64"
        />
        <select
          value={filtreStatut}
          onChange={(e) => setFiltreStatut(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="tous">Tous les statuts</option>
          <option value="en attente">En attente</option>
          <option value="validé">Validé</option>
        </select>

        <button
          onClick={exportToCSV}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Export CSV
        </button>
        <button
          onClick={exportToExcel}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Export Excel
        </button>
        <button
          onClick={exportToPDF}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Export PDF
        </button>
        <button
          onClick={imprimer}
          className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
        >
          🖨️ Imprimer
        </button>
      </div>

      <div className="overflow-auto rounded border">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-gray-200">
            <tr>
              {[
                "Nom",
                "Prénom",
                "Email",
                "Date de naissance",
                "Genre",
                "Nationalité",
                "Club",
                "Justificatif",
                "Licence",
                "Adresse",
                "Téléphone",
                "Contact urgence",
                "Résultats",
                "Date inscription",
                "Statut",
                "Dossard",
                "Actions",
              ].map((col, i) => (
                <th
                  key={i}
                  className="p-2 font-semibold cursor-pointer"
                  onClick={() => toggleTri(Object.keys(filtered[0] || {})[i] || "")}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="p-2">{i.nom}</td>
                <td className="p-2">{i.prenom}</td>
                <td className="p-2">{i.email}</td>
                <td className="p-2">{i.date_naissance}</td>
                <td className="p-2">{i.genre}</td>
                <td className="p-2">{i.nationalite}</td>
                <td className="p-2">{i.club}</td>
                <td className="p-2">{i.justificatif_type}</td>
                <td className="p-2">{i.numero_licence}</td>
                <td className="p-2">
                  {i.adresse}, {i.code_postal} {i.ville}, {i.pays}
                </td>
                <td className="p-2">{i.telephone}</td>
                <td className="p-2">
                  {i.contact_urgence_nom} ({i.contact_urgence_telephone})
                </td>
                <td className="p-2">
                  {i.apparaitre_resultats ? "✅" : "❌"}
                </td>
                <td className="p-2">
                  {new Date(i.created_at).toLocaleString()}
                </td>
                <td className="p-2">{i.statut}</td>
                <td className="p-2">
                  <input
                    type="text"
                    value={i.numero_dossard || ""}
                    onChange={(e) =>
                      handleChangeDossard(i.id, e.target.value)
                    }
                    className="border p-1 w-20 rounded"
                  />
                </td>
                <td className="p-2">
                  <button
                    onClick={() => handleValider(i.id)}
                    className="text-green-600 underline"
                  >
                    Valider
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

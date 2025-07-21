import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";
import { Save } from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export default function ListeInscriptions() {
  const { courseId } = useParams();
  const [inscriptions, setInscriptions] = useState([]);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [sortField, setSortField] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    fetchInscriptions();
  }, [courseId]);

  const fetchInscriptions = async () => {
    const { data, error } = await supabase
      .from("inscriptions")
      .select("*")
      .eq("course_id", courseId);

    if (!error && data) {
      setInscriptions(data);
    }
  };

  const handleDossardChange = async (id, numero_dossard) => {
    await supabase.from("inscriptions").update({ numero_dossard }).eq("id", id);
    fetchInscriptions();
  };

  const handleValidation = async (id) => {
    await supabase.from("inscriptions").update({ statut: "valide" }).eq("id", id);
    fetchInscriptions();
  };

  const exportCSV = () => {
    const data = inscriptions.map(({ created_at, ...rest }) => rest);
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inscriptions");
    const blob = new Blob([
      XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    ]);
    saveAs(blob, "liste_inscriptions.xlsx");
  };

  const filteredInscriptions = inscriptions
    .filter((i) =>
      search === "" ||
      Object.values(i).some((v) => v && v.toString().toLowerCase().includes(search.toLowerCase()))
    )
    .filter((i) =>
      statutFilter === "" || i.statut === statutFilter
    )
    .sort((a, b) => {
      if (!sortField) return 0;
      const valA = a[sortField] || "";
      const valB = b[sortField] || "";
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Liste des inscrits</h1>

      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="Recherche..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-2 py-1 rounded w-64"
        />

        <select
          value={statutFilter}
          onChange={(e) => setStatutFilter(e.target.value)}
          className="border px-2 py-1 rounded"
        >
          <option value="">Tous les statuts</option>
          <option value="valide">Valide</option>
          <option value="en attente">En attente</option>
        </select>

        <button
          onClick={exportCSV}
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center"
        >
          <Save className="w-4 h-4 mr-2" /> Export Excel
        </button>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm border">
          <thead>
            <tr>
              {[
                "prenom", "nom", "genre", "date_naissance", "email", "telephone", "ville", "club", "statut", "numero_dossard"
              ].map((field) => (
                <th
                  key={field}
                  onClick={() => handleSort(field)}
                  className="p-2 border cursor-pointer"
                >
                  {field}
                  {sortField === field ? (sortAsc ? " ↑" : " ↓") : ""}
                </th>
              ))}
              <th className="p-2 border">Valider</th>
            </tr>
          </thead>
          <tbody>
            {filteredInscriptions.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="p-2 border">{i.prenom}</td>
                <td className="p-2 border">{i.nom}</td>
                <td className="p-2 border">{i.genre}</td>
                <td className="p-2 border">{i.date_naissance}</td>
                <td className="p-2 border">{i.email}</td>
                <td className="p-2 border">{i.telephone}</td>
                <td className="p-2 border">{i.ville}</td>
                <td className="p-2 border">{i.club}</td>
                <td className="p-2 border">{i.statut}</td>
                <td className="p-2 border">
                  <input
                    type="text"
                    defaultValue={i.numero_dossard || ""}
                    onBlur={(e) => handleDossardChange(i.id, e.target.value)}
                    className="border px-2 py-1 rounded w-20"
                  />
                </td>
                <td className="p-2 border">
                  {i.statut !== "valide" && (
                    <button
                      onClick={() => handleValidation(i.id)}
                      className="bg-green-600 text-white px-2 py-1 rounded"
                    >
                      Valider
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

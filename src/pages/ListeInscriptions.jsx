import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import ExportCSVModal from "../components/ExportCSVModal";
import { Plus, Download } from "lucide-react";

export default function ListeInscriptions() {
  const [inscriptions, setInscriptions] = useState([]);
  const [formats, setFormats] = useState([]);
  const [modalExportOpen, setModalExportOpen] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: insc } = await supabase.from("inscriptions").select("*");
    const { data: fmts } = await supabase.from("formats").select("id, nom");
    setInscriptions(insc || []);
    setFormats(fmts || []);
  };

  const colonnes = [
    { key: "nom", label: "Nom" },
    { key: "prenom", label: "Prénom" },
    { key: "email", label: "Email" },
    { key: "genre", label: "Genre" },
    { key: "date_naissance", label: "Date de naissance" },
    { key: "nationalite", label: "Nationalité" },
    { key: "telephone", label: "Téléphone" },
    { key: "adresse", label: "Adresse" },
    { key: "code_postal", label: "Code postal" },
    { key: "ville", label: "Ville" },
    { key: "pays", label: "Pays" },
    { key: "club", label: "Club" },
    { key: "numero_licence", label: "Licence" },
    { key: "dossard", label: "Dossard" },
    { key: "nombre_repas", label: "Repas" },
    { key: "prix_total_repas", label: "Prix repas" },
    { key: "statut", label: "Statut" },
  ];

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Liste des Inscriptions</h1>
      {formats.map((format) => {
        const inscriptionsFiltrees = inscriptions.filter(
          (i) => i.format_id === format.id
        );
        return (
          <div key={format.id} className="mb-12 border p-4 rounded shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-semibold">{format.nom}</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setModalExportOpen(format.id)}
                  className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                >
                  <Download size={16} /> Export CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left border border-gray-200">
                <thead>
                  <tr className="bg-gray-100">
                    {colonnes.map((col) => (
                      <th key={col.key} className="px-2 py-1 border">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inscriptionsFiltrees.map((ins, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {colonnes.map((col) => (
                        <td key={col.key} className="px-2 py-1 border">
                          {ins[col.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {modalExportOpen === format.id && (
              <ExportCSVModal
                isOpen={true}
                onClose={() => setModalExportOpen(null)}
                colonnes={colonnes}
                donnees={inscriptionsFiltrees}
                nomFichier={`inscriptions_${format.nom}.csv`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

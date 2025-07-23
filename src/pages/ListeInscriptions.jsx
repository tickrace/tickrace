
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import ModalAjoutCoureur from "../components/ModalAjoutCoureur";
import ExportCSVModal from "../components/ExportCSVModal";

export default function ListeInscriptions() {
  const [inscriptionsParFormat, setInscriptionsParFormat] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFormatId, setModalFormatId] = useState(null);
  const [modalExportOpen, setModalExportOpen] = useState(false);
  const [exportData, setExportData] = useState([]);
  const [colonnes, setColonnes] = useState([]);

  useEffect(() => {
    fetchInscriptions();
  }, []);

  const fetchInscriptions = async () => {
    const { data, error } = await supabase
      .from("inscriptions")
      .select("*, formats(id, nom)")
      .order("created_at", { ascending: true });

    if (!error && data) {
      const grouped = data.reduce((acc, insc) => {
        const formatId = insc.format_id;
        if (!acc[formatId]) acc[formatId] = [];
        acc[formatId].push(insc);
        return acc;
      }, {});
      setInscriptionsParFormat(grouped);
    }
  };

  const handleOpenModalAjout = (formatId) => {
    setModalFormatId(formatId);
    setModalOpen(true);
  };

  return (
    <div className="p-6 space-y-8">
      {Object.entries(inscriptionsParFormat).map(([formatId, inscriptions]) => (
        <div key={formatId} className="border border-gray-300 p-4 rounded-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Format : {inscriptions[0]?.formats?.nom}</h2>
            <div className="flex gap-4">
              <button
                onClick={() => handleOpenModalAjout(formatId)}
                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Ajouter un coureur
              </button>
              <button
                onClick={() => {
                  setExportData(inscriptions);
                  setColonnes(["nom", "prenom", "dossard", "email", "club", "statut"]);
                  setModalExportOpen(true);
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Exporter CSV
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto border-collapse border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 px-2 py-1">Nom</th>
                  <th className="border border-gray-300 px-2 py-1">Prénom</th>
                  <th className="border border-gray-300 px-2 py-1">Dossard</th>
                  <th className="border border-gray-300 px-2 py-1">Email</th>
                  <th className="border border-gray-300 px-2 py-1">Club</th>
                  <th className="border border-gray-300 px-2 py-1">Statut</th>
                </tr>
              </thead>
              <tbody>
                {inscriptions.map((insc) => (
                  <tr key={insc.id}>
                    <td className="border border-gray-300 px-2 py-1">{insc.nom}</td>
                    <td className="border border-gray-300 px-2 py-1">{insc.prenom}</td>
                    <td className="border border-gray-300 px-2 py-1">{insc.dossard}</td>
                    <td className="border border-gray-300 px-2 py-1">{insc.email}</td>
                    <td className="border border-gray-300 px-2 py-1">{insc.club}</td>
                    <td className="border border-gray-300 px-2 py-1">{insc.statut}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <ModalAjoutCoureur
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        formatId={modalFormatId}
        onCoureurAjoute={fetchInscriptions}
      />

      <ExportCSVModal
        isOpen={modalExportOpen}
        onClose={() => setModalExportOpen(false)}
        colonnes={colonnes}
        donnees={exportData}
        nomFichier={`inscriptions_export.csv`}
      />
    </div>
  );
}

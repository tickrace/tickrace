import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import ExportCSVModal from "../components/ExportCSVModal";

export default function ListeInscriptions() {
  const [inscriptionsParFormat, setInscriptionsParFormat] = useState({});
  const [modalExportOpen, setModalExportOpen] = useState(false);
  const [exportData, setExportData] = useState([]);
  const [colonnes, setColonnes] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [pagination, setPagination] = useState({});
  const lignesParPage = 50;

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
      const initialPagination = Object.keys(grouped).reduce((acc, formatId) => {
        acc[formatId] = 1;
        return acc;
      }, {});
      setPagination(initialPagination);
    }
  };

  const handleChange = (formatId, index, champ, valeur) => {
    const updated = { ...inscriptionsParFormat };
    updated[formatId][index][champ] = valeur;
    setInscriptionsParFormat(updated);
  };

  const ajouterLigne = (formatId) => {
    const nouvelleLigne = {
      id: Math.random().toString(),
      nom: "",
      prenom: "",
      dossard: "",
      email: "",
      club: "",
      statut: "en attente",
      formats: { nom: inscriptionsParFormat[formatId][0]?.formats?.nom },
    };
    setInscriptionsParFormat((prev) => ({
      ...prev,
      [formatId]: [...prev[formatId], nouvelleLigne],
    }));
  };

  const filtrerInscriptions = (inscriptions) => {
    return inscriptions.filter((i) => {
      const matchRecherche =
        i.nom?.toLowerCase().includes(recherche.toLowerCase()) ||
        i.prenom?.toLowerCase().includes(recherche.toLowerCase()) ||
        i.email?.toLowerCase().includes(recherche.toLowerCase());
      const matchStatut = filtreStatut ? i.statut === filtreStatut : true;
      return matchRecherche && matchStatut;
    });
  };

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
        <input
          type="text"
          placeholder="Rechercher..."
          className="p-2 border rounded w-full sm:w-auto"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <select
          className="p-2 border rounded w-full sm:w-auto"
          value={filtreStatut}
          onChange={(e) => setFiltreStatut(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          <option value="en attente">En attente</option>
          <option value="validé">Validé</option>
          <option value="refusé">Refusé</option>
        </select>
      </div>

      {Object.entries(inscriptionsParFormat).map(([formatId, inscriptions]) => {
        const filtres = filtrerInscriptions(inscriptions);
        const page = pagination[formatId] || 1;
        const paginees = filtres.slice((page - 1) * lignesParPage, page * lignesParPage);

        return (
          <div key={formatId} className="border border-gray-300 p-4 rounded-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Format : {inscriptions[0]?.formats?.nom}</h2>
              <div className="flex gap-4">
                <button
                  onClick={() => ajouterLigne(formatId)}
                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Ajouter un coureur
                </button>
                <button
                  onClick={() => {
                    setExportData(filtres);
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
                    <th className="border px-2 py-1">Nom</th>
                    <th className="border px-2 py-1">Prénom</th>
                    <th className="border px-2 py-1">Dossard</th>
                    <th className="border px-2 py-1">Email</th>
                    <th className="border px-2 py-1">Club</th>
                    <th className="border px-2 py-1">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {paginees.map((insc, index) => (
                    <tr key={insc.id}>
                      <td className="border px-2 py-1">
                        <input
                          value={insc.nom || ""}
                          onChange={(e) => handleChange(formatId, index, "nom", e.target.value)}
                          className="w-full"
                        />
                      </td>
                      <td className="border px-2 py-1">
                        <input
                          value={insc.prenom || ""}
                          onChange={(e) => handleChange(formatId, index, "prenom", e.target.value)}
                          className="w-full"
                        />
                      </td>
                      <td className="border px-2 py-1">
                        <input
                          type="number"
                          value={insc.dossard || ""}
                          onChange={(e) => handleChange(formatId, index, "dossard", e.target.value)}
                          className="w-full"
                        />
                      </td>
                      <td className="border px-2 py-1">
                        <input
                          value={insc.email || ""}
                          onChange={(e) => handleChange(formatId, index, "email", e.target.value)}
                          className="w-full"
                        />
                      </td>
                      <td className="border px-2 py-1">
                        <input
                          value={insc.club || ""}
                          onChange={(e) => handleChange(formatId, index, "club", e.target.value)}
                          className="w-full"
                        />
                      </td>
                      <td className="border px-2 py-1">
                        <select
                          value={insc.statut || "en attente"}
                          onChange={(e) => handleChange(formatId, index, "statut", e.target.value)}
                          className="w-full"
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

            <div className="flex justify-end mt-2 space-x-2">
              {Array.from({ length: Math.ceil(filtres.length / lignesParPage) }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setPagination((prev) => ({ ...prev, [formatId]: i + 1 }))}
                  className={`px-3 py-1 border rounded ${pagination[formatId] === i + 1 ? "bg-gray-300" : ""}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        );
      })}

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

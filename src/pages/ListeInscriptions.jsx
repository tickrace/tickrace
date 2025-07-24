import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import ExportCSVModal from "../components/ExportCSVModal";
import { Link } from "react-router-dom";

export default function ListeInscriptions() {
  const [inscriptionsParFormat, setInscriptionsParFormat] = useState({});
  const [modalExportOpen, setModalExportOpen] = useState(false);
  const [exportData, setExportData] = useState([]);
  const [colonnes, setColonnes] = useState([]);
  const [search, setSearch] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [currentPage, setCurrentPage] = useState({});

  const LIGNES_PAR_PAGE = 50;

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

  const handleChange = async (id, champ, valeur) => {
    await supabase.from("inscriptions").update({ [champ]: valeur }).eq("id", id);
    fetchInscriptions();
  };

  const handlePageChange = (formatId, direction) => {
    setCurrentPage((prev) => ({
      ...prev,
      [formatId]: Math.max(0, (prev[formatId] || 0) + direction),
    }));
  };

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center gap-4 mb-6">
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-3 py-1 rounded w-1/3"
        />
        <select
          value={filtreStatut}
          onChange={(e) => setFiltreStatut(e.target.value)}
          className="border px-3 py-1 rounded"
        >
          <option value="">Tous les statuts</option>
          <option value="validé">Validé</option>
          <option value="en attente">En attente</option>
          <option value="refusé">Refusé</option>
        </select>
      </div>

      {Object.entries(inscriptionsParFormat).map(([formatId, inscriptions]) => {
        const page = currentPage[formatId] || 0;

        const inscriptionsFiltrees = inscriptions.filter((insc) => {
          const matchRecherche =
            search === "" ||
            `${insc.nom} ${insc.prenom} ${insc.email} ${insc.club}`
              .toLowerCase()
              .includes(search.toLowerCase());
          const matchStatut = filtreStatut === "" || insc.statut === filtreStatut;
          return matchRecherche && matchStatut;
        });

        const totalPages = Math.ceil(inscriptionsFiltrees.length / LIGNES_PAR_PAGE);
        const pageInscriptions = inscriptionsFiltrees.slice(
          page * LIGNES_PAR_PAGE,
          (page + 1) * LIGNES_PAR_PAGE
        );

        return (
          <div key={formatId} className="border border-gray-300 p-4 rounded-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                Format : {inscriptions[0]?.formats?.nom}
              </h2>
              <button
                onClick={() => {
                  setExportData(inscriptionsFiltrees);
                  setColonnes([
                    "nom",
                    "prenom",
                    "dossard",
                    "email",
                    "club",
                    "statut",
                  ]);
                  setModalExportOpen(true);
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Exporter CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-2 py-1">Nom</th>
                    <th className="border px-2 py-1">Prénom</th>
                    <th className="border px-2 py-1">Dossard</th>
                    <th className="border px-2 py-1">Email</th>
                    <th className="border px-2 py-1">Club</th>
                    <th className="border px-2 py-1">Statut</th>
                    <th className="border px-2 py-1">Détails</th>
                  </tr>
                </thead>
                <tbody>
                  {pageInscriptions.map((insc) => (
                    <tr key={insc.id}>
                      <td className="border px-2 py-1">
                        <input
                          className="w-full"
                          value={insc.nom || ""}
                          onChange={(e) => handleChange(insc.id, "nom", e.target.value)}
                        />
                      </td>
                      <td className="border px-2 py-1">
                        <input
                          className="w-full"
                          value={insc.prenom || ""}
                          onChange={(e) =>
                            handleChange(insc.id, "prenom", e.target.value)
                          }
                        />
                      </td>
                      <td className="border px-2 py-1">
                        <input
                          type="number"
                          className="w-full"
                          value={insc.dossard || ""}
                          onChange={(e) =>
                            handleChange(insc.id, "dossard", e.target.value)
                          }
                        />
                      </td>
                      <td className="border px-2 py-1">
                        <input
                          className="w-full"
                          value={insc.email || ""}
                          onChange={(e) =>
                            handleChange(insc.id, "email", e.target.value)
                          }
                        />
                      </td>
                      <td className="border px-2 py-1">
                        <input
                          className="w-full"
                          value={insc.club || ""}
                          onChange={(e) =>
                            handleChange(insc.id, "club", e.target.value)
                          }
                        />
                      </td>
                      <td className="border px-2 py-1">
                        <select
                          className="w-full"
                          value={insc.statut || "en attente"}
                          onChange={(e) =>
                            handleChange(insc.id, "statut", e.target.value)
                          }
                        >
                          <option value="en attente">En attente</option>
                          <option value="validé">Validé</option>
                          <option value="refusé">Refusé</option>
                        </select>
                      </td>
                      <td className="border px-2 py-1 text-center">
                        <Link
                          to={`/details-coureur/${insc.id}`}
                          className="text-blue-600 underline"
                        >
                          Voir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => handlePageChange(formatId, -1)}
                  disabled={page === 0}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Précédent
                </button>
                <span className="self-center">
                  Page {page + 1} sur {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(formatId, 1)}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Suivant
                </button>
              </div>
            )}
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

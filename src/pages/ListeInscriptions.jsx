import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import ExportCSVModal from "../components/ExportCSVModal";
import ModalAjoutCoureur from "../components/ModalAjoutCoureur";
import { Download, PlusCircle } from "lucide-react";

export default function ListeInscriptions() {
  const [inscriptionsParFormat, setInscriptionsParFormat] = useState({});
  const [modalExportOpen, setModalExportOpen] = useState(false);
  const [modalAjoutOpen, setModalAjoutOpen] = useState(false);
  const [formatSelectionne, setFormatSelectionne] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("tous");

  const colonnesExport = [
    "nom", "prenom", "genre", "date_naissance", "nationalite",
    "email", "telephone", "adresse", "adresse_complement",
    "code_postal", "ville", "pays", "apparaitre_resultats", "club",
    "justificatif_type", "contact_urgence_nom", "contact_urgence_telephone",
    "statut", "numero_licence", "dossard", "nombre_repas", "prix_total_repas"
  ];

  useEffect(() => {
    fetchInscriptions();
  }, []);

  const fetchInscriptions = async () => {
    const { data, error } = await supabase
      .from("inscriptions")
      .select("*, formats(id, nom)")
      .order("created_at", { ascending: true });

    if (!error && data) {
      const grouped = {};
      data.forEach((inscription) => {
        const formatId = inscription.format_id;
        const formatNom = inscription.formats?.nom || "Sans nom";
        if (!grouped[formatId]) {
          grouped[formatId] = {
            formatNom,
            inscriptions: [],
          };
        }
        grouped[formatId].inscriptions.push(inscription);
      });
      setInscriptionsParFormat(grouped);
    }
  };

  const handleOpenModalAjout = (formatId) => {
    setFormatSelectionne(formatId);
    setModalAjoutOpen(true);
  };

  const handleChangeDossard = async (inscriptionId, nouveauDossard) => {
    await supabase
      .from("inscriptions")
      .update({ dossard: nouveauDossard })
      .eq("id", inscriptionId);
    fetchInscriptions();
  };

  const handleStatutChange = async (inscriptionId, nouveauStatut) => {
    await supabase
      .from("inscriptions")
      .update({ statut: nouveauStatut })
      .eq("id", inscriptionId);
    fetchInscriptions();
  };

  const filtrerInscriptions = (liste) => {
    return liste.filter((i) => {
      const matchStatut =
        filtreStatut === "tous" || i.statut === filtreStatut;
      const matchRecherche =
        i.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.numero_licence?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchStatut && matchRecherche;
    });
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Liste des Inscriptions</h1>

      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
        <input
          type="text"
          placeholder="Recherche..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border rounded p-2 w-full md:w-1/2"
        />
        <select
          value={filtreStatut}
          onChange={(e) => setFiltreStatut(e.target.value)}
          className="border rounded p-2"
        >
          <option value="tous">Tous les statuts</option>
          <option value="en attente">En attente</option>
          <option value="validé">Validé</option>
          <option value="refusé">Refusé</option>
        </select>
      </div>

      {Object.entries(inscriptionsParFormat).map(([formatId, { formatNom, inscriptions }]) => {
        const inscriptionsFiltrees = filtrerInscriptions(inscriptions);

        return (
          <div key={formatId} className="mb-10 border rounded-lg p-4 shadow">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-semibold">
                Format : {formatNom} ({inscriptionsFiltrees.length} inscrits)
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setFormatSelectionne(formatId);
                    setModalExportOpen(true);
                  }}
                  className="flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </button>
                <button
                  onClick={() => handleOpenModalAjout(formatId)}
                  className="flex items-center px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Ajouter un coureur
                </button>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="min-w-full text-sm border">
                <thead className="bg-gray-100">
                  <tr>
                    {colonnesExport.map((col) => (
                      <th key={col} className="border px-2 py-1 text-left capitalize">
                        {col.replace(/_/g, " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inscriptionsFiltrees.map((i) => (
                    <tr key={i.id}>
                      {colonnesExport.map((col) => (
                        <td key={col} className="border px-2 py-1">
                          {col === "dossard" ? (
                            <input
                              type="number"
                              value={i.dossard || ""}
                              onChange={(e) =>
                                handleChangeDossard(i.id, Number(e.target.value))
                              }
                              className="w-20 border p-1 rounded"
                            />
                          ) : col === "statut" ? (
                            <select
                              value={i.statut || "en attente"}
                              onChange={(e) =>
                                handleStatutChange(i.id, e.target.value)
                              }
                              className="border rounded p-1"
                            >
                              <option value="en attente">En attente</option>
                              <option value="validé">Validé</option>
                              <option value="refusé">Refusé</option>
                            </select>
                          ) : typeof i[col] === "boolean" ? (
                            i[col] ? "Oui" : "Non"
                          ) : (
                            i[col] || "-"
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Modal ajout coureur */}
      {modalAjoutOpen && (
        <ModalAjoutCoureur
          formatId={formatSelectionne}
          onClose={() => {
            setModalAjoutOpen(false);
            fetchInscriptions();
          }}
        />
      )}

      {/* Modal export CSV */}
      {modalExportOpen && (
        <ExportCSVModal
          isOpen={modalExportOpen}
          onClose={() => setModalExportOpen(false)}
          colonnes={colonnesExport}
          donnees={
            inscriptionsParFormat[formatSelectionne]?.inscriptions || []
          }
          nomFichier={`inscriptions_${inscriptionsParFormat[formatSelectionne]?.formatNom || "export"}.csv`}
        />
      )}
    </div>
  );
}

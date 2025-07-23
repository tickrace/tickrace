import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import ModalAjoutCoureur from "../components/ModalAjoutCoureur";
import ExportCSVModal from "../components/ExportCSVModal";

export default function ListeInscriptions() {
  const [inscriptions, setInscriptions] = useState([]);
  const [formats, setFormats] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [formatSelectionne, setFormatSelectionne] = useState(null);
  const [modalExportOpen, setModalExportOpen] = useState(false);
  const [inscriptionsFiltrees, setInscriptionsFiltrees] = useState([]);
  const [colonnes, setColonnes] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [statutFiltre, setStatutFiltre] = useState("tous");
  const [pageCourante, setPageCourante] = useState({});

  const lignesParPage = 10;

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const colonnesPossibles = inscriptions.length > 0 ? Object.keys(inscriptions[0]) : [];
    setColonnes(colonnesPossibles);
  }, [inscriptions]);

  const fetchData = async () => {
    const { data: inscriptionsData, error: error1 } = await supabase
      .from("inscriptions")
      .select("*, formats (id, nom)")
      .order("created_at", { ascending: false });

    if (error1) {
      console.error("Erreur chargement inscriptions :", error1);
      return;
    }

    const { data: formatsData, error: error2 } = await supabase
      .from("formats")
      .select("id, nom");

    if (error2) {
      console.error("Erreur chargement formats :", error2);
      return;
    }

    setInscriptions(inscriptionsData);
    setFormats(formatsData);
  };

  const handleAjoutCoureur = (format) => {
    setFormatSelectionne(format);
    setModalOpen(true);
  };

  const handleStatutChange = async (id, nouveauStatut) => {
    await supabase
      .from("inscriptions")
      .update({ statut: nouveauStatut })
      .eq("id", id);
    fetchData();
  };

  const handleDossardChange = async (id, nouveauDossard) => {
    await supabase
      .from("inscriptions")
      .update({ dossard: nouveauDossard })
      .eq("id", id);
    fetchData();
  };

  const filtrerEtPaginer = (inscriptionsFormat, formatId) => {
    let data = inscriptionsFormat;

    if (statutFiltre !== "tous") {
      data = data.filter((i) => i.statut === statutFiltre);
    }

    if (recherche.trim() !== "") {
      const lower = recherche.toLowerCase();
      data = data.filter((i) =>
        Object.values(i).some((val) =>
          val?.toString().toLowerCase().includes(lower)
        )
      );
    }

    const page = pageCourante[formatId] || 1;
    const startIndex = (page - 1) * lignesParPage;
    const endIndex = startIndex + lignesParPage;
    return data.slice(startIndex, endIndex);
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Liste des inscriptions</h1>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center mb-4">
        <input
          type="text"
          placeholder="Recherche globale..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="border p-2 rounded w-full md:w-64"
        />
        <select
          value={statutFiltre}
          onChange={(e) => setStatutFiltre(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="tous">Tous les statuts</option>
          <option value="en attente">En attente</option>
          <option value="validé">Validé</option>
          <option value="refusé">Refusé</option>
        </select>
      </div>

      {formats.map((format) => {
        const inscriptionsFormat = inscriptions.filter(
          (i) => i.format_id === format.id
        );
        const totalPages = Math.ceil(inscriptionsFormat.length / lignesParPage);
        const page = pageCourante[format.id] || 1;
        const paginated = filtrerEtPaginer(inscriptionsFormat, format.id);

        return (
          <div key={format.id} className="mb-12 border rounded-lg shadow p-4 bg-white">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-semibold">{format.nom}</h2>
              <div className="flex gap-2">
                <button
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                  onClick={() => {
                    setModalExportOpen(true);
                    setInscriptionsFiltrees(inscriptionsFormat);
                  }}
                >
                  Export CSV
                </button>
                <button
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                  onClick={() => handleAjoutCoureur(format)}
                >
                  Ajouter un coureur
                </button>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="table-auto w-full border-collapse text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    {colonnes.map((col) => (
                      <th key={col} className="border px-2 py-1 text-left">
                        {col}
                      </th>
                    ))}
                    <th className="border px-2 py-1">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((insc) => (
                    <tr key={insc.id}>
                      {colonnes.map((col) => (
                        <td key={col} className="border px-2 py-1">
                          {col === "dossard" ? (
                            <input
                              type="number"
                              value={insc.dossard || ""}
                              onChange={(e) =>
                                handleDossardChange(insc.id, Number(e.target.value))
                              }
                              className="w-16 border rounded px-1"
                            />
                          ) : col === "apparaitre_resultats" ? (
                            insc[col] ? "✔" : "❌"
                          ) : (
                            insc[col] || "-"
                          )}
                        </td>
                      ))}
                      <td className="border px-2 py-1">
                        <select
                          value={insc.statut || "en attente"}
                          onChange={(e) =>
                            handleStatutChange(insc.id, e.target.value)
                          }
                          className="border p-1 rounded"
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

            <div className="flex justify-end mt-2 gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() =>
                    setPageCourante((prev) => ({ ...prev, [format.id]: p }))
                  }
                  className={`px-2 py-1 rounded ${
                    p === page ? "bg-blue-600 text-white" : "bg-gray-200"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* Modal d’ajout */}
      {modalOpen && formatSelectionne && (
        <ModalAjoutCoureur
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          format={formatSelectionne}
          refresh={fetchData}
        />
      )}

      {/* Modal export */}
      <ExportCSVModal
        isOpen={modalExportOpen}
        onClose={() => setModalExportOpen(false)}
        colonnes={colonnes}
        donnees={inscriptionsFiltrees}
        nomFichier={"export_inscriptions.csv"}
      />
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { Link } from "react-router-dom";
import ExportCSVModal from "../components/ExportCSVModal";


export default function ListeInscriptions() {
  const [inscriptionsParFormat, setInscriptionsParFormat] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [modalExportOpen, setModalExportOpen] = useState(false);
  const [exportData, setExportData] = useState([]);
  const [colonnes, setColonnes] = useState([]);
  const [currentPages, setCurrentPages] = useState({});
  const ITEMS_PER_PAGE = 50;

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

  const handleUpdateChamp = async (id, field, value) => {
    const { error } = await supabase
      .from("inscriptions")
      .update({ [field]: value })
      .eq("id", id);
    if (!error) fetchInscriptions();
  };

  const handleAddCoureur = async (formatId) => {
    const { data, error } = await supabase
      .from("inscriptions")
      .insert([{ format_id: formatId, statut: "en attente" }])
      .select();
    if (!error && data?.[0]) fetchInscriptions();
  };

  const handlePageChange = (formatId, direction) => {
    setCurrentPages((prev) => ({
      ...prev,
      [formatId]: Math.max(0, (prev[formatId] || 0) + direction),
    }));
  };

  const renderEditableCell = (value, id, field, type = "text") => {
    if (field === "statut") {
      return (
        <select
          className="w-full border rounded px-1 py-0.5"
          value={value || ""}
          onChange={(e) => handleUpdateChamp(id, field, e.target.value)}
        >
          <option value="en attente">En attente</option>
          <option value="validé">Validé</option>
          <option value="refusé">Refusé</option>
        </select>
      );
    }

    return (
      <input
        type={type}
        className="w-full border rounded px-1 py-0.5"
        value={value || ""}
        onChange={(e) => handleUpdateChamp(id, field, e.target.value)}
      />
    );
  };

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <input
          type="text"
          placeholder="Recherche..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
          className="border px-3 py-1 rounded w-1/2"
        />
        <select
          value={statutFilter}
          onChange={(e) => setStatutFilter(e.target.value)}
          className="border px-3 py-1 rounded"
        >
          <option value="">Tous les statuts</option>
          <option value="en attente">En attente</option>
          <option value="validé">Validé</option>
          <option value="refusé">Refusé</option>
        </select>
      </div>

      {Object.entries(inscriptionsParFormat).map(([formatId, inscriptions]) => {
        const page = currentPages[formatId] || 0;
        const filtered = inscriptions.filter((insc) => {
          const matchesSearch =
            Object.values(insc)
              .join(" ")
              .toLowerCase()
              .includes(searchTerm);
          const matchesStatut =
            !statutFilter || insc.statut === statutFilter;
          return matchesSearch && matchesStatut;
        });
        const paginated = filtered.slice(
          page * ITEMS_PER_PAGE,
          (page + 1) * ITEMS_PER_PAGE
        );

        return (
          <div key={formatId} className="border border-gray-300 p-4 rounded-md">
            <div className="flex justify-between mb-3 items-center">
              <h2 className="text-xl font-semibold">
                Format : {inscriptions[0]?.formats?.nom}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAddCoureur(formatId)}
                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Ajouter un coureur
                </button>
                <button
                  onClick={() => {
                    setExportData(filtered);
                   setColonnes([
  "nom", "prenom", "genre", "date_naissance",
  "email", "club", "dossard", "statut"
]);

setExportData(inscriptions); // sans format imbriqué

                    setModalExportOpen(true);
                  }}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Exporter CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300 text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-2 py-1">Nom</th>
                    <th className="border px-2 py-1">Prénom</th>
                    <th className="border px-2 py-1">Dossard</th>
                    <th className="border px-2 py-1">Email</th>
                    <th className="border px-2 py-1">Club</th>
                    <th className="border px-2 py-1">Statut</th>
                    <th className="border px-2 py-1">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((insc) => (
                    <tr key={insc.id}>
                      <td className="border px-2 py-1">
                        {renderEditableCell(insc.nom, insc.id, "nom")}
                      </td>
                      <td className="border px-2 py-1">
                        {renderEditableCell(insc.prenom, insc.id, "prenom")}
                      </td>
                      <td className="border px-2 py-1">
                        {renderEditableCell(insc.dossard, insc.id, "dossard", "number")}
                      </td>
                      <td className="border px-2 py-1">
                        {renderEditableCell(insc.email, insc.id, "email")}
                      </td>
                      <td className="border px-2 py-1">
                        {renderEditableCell(insc.club, insc.id, "club")}
                      </td>
                      <td className="border px-2 py-1">
                        {renderEditableCell(insc.statut, insc.id, "statut")}
                      </td>
                      <td className="border px-2 py-1 text-center">
                        <Link
                          to={`/details-coureur/${insc.id}`}
                          className="text-blue-600 underline"
                        >
                          Détails
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between mt-2">
                <button
                  onClick={() => handlePageChange(formatId, -1)}
                  className="px-2 py-1 border rounded disabled:opacity-50"
                  disabled={page === 0}
                >
                  Précédent
                </button>
                <span className="text-sm">
                  Page {page + 1} / {Math.ceil(filtered.length / ITEMS_PER_PAGE)}
                </span>
                <button
                  onClick={() => handlePageChange(formatId, 1)}
                  className="px-2 py-1 border rounded disabled:opacity-50"
                  disabled={(page + 1) * ITEMS_PER_PAGE >= filtered.length}
                >
                  Suivant
                </button>
              </div>
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

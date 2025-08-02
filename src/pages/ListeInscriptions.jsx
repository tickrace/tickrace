import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { Link, useParams } from "react-router-dom";
import ExportCSVModal from "../components/ExportCSVModal";
import ModalAjoutCoureur from "../components/ModalAjoutCoureur"; // ✅ Ajout ici

export default function ListeInscriptions() {
  const { format_id } = useParams();
  const [inscriptions, setInscriptions] = useState([]);
  const [formatNom, setFormatNom] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [modalExportOpen, setModalExportOpen] = useState(false);
  const [modalAjoutOpen, setModalAjoutOpen] = useState(false); // ✅ nouvel état pour le modal
  const [formatData, setFormatData] = useState(null); // ✅ pour transmettre les données du format au modal
  const [exportData, setExportData] = useState([]);
  const [colonnes, setColonnes] = useState([]);
  const [page, setPage] = useState(0);

  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    if (format_id) {
      fetchInscriptions();
      fetchFormatData(); // ✅ on récupère les infos du format
    }
  }, [format_id]);

  const fetchInscriptions = async () => {
    const { data, error } = await supabase
      .from("inscriptions")
      .select("*, formats(id, nom)")
      .eq("format_id", format_id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setInscriptions(data || []);
    setFormatNom(data?.[0]?.formats?.nom || "");
    setPage(0);
  };

  const fetchFormatData = async () => {
    const { data, error } = await supabase
      .from("formats")
      .select("*")
      .eq("id", format_id)
      .single();

    if (error) {
      console.error("Erreur chargement format :", error);
      return;
    }

    setFormatData(data);
  };

  const handleUpdateChamp = async (id, field, value) => {
    const { error } = await supabase
      .from("inscriptions")
      .update({ [field]: value })
      .eq("id", id);

    if (error) {
      console.error(error);
      return;
    }
    fetchInscriptions();
  };

  const handlePageChange = (direction) => {
    setPage((prev) => Math.max(0, prev + direction));
  };

  const renderEditableCell = (value, id, field, type = "text") => {
    if (field === "statut") {
      return (
        <select
          className="w-full border rounded px-1 py-0.5"
          defaultValue={value || ""}
          onBlur={(e) => handleUpdateChamp(id, field, e.target.value)}
        >
          <option value="en attente">En attente</option>
          <option value="validé">Validé</option>
          <option value="refusé">Refusé</option>
          <option value="annulé">Annulé</option>
        </select>
      );
    }

    return (
      <input
        type={type}
        className="w-full border rounded px-1 py-0.5"
        defaultValue={value || ""}
        onBlur={(e) => handleUpdateChamp(id, field, e.target.value)}
      />
    );
  };

  const filtered = inscriptions.filter((insc) => {
    const matchesSearch = Object.values(insc || {})
      .join(" ")
      .toLowerCase()
      .includes(searchTerm);
    const matchesStatut = !statutFilter || insc.statut === statutFilter;
    return matchesSearch && matchesStatut;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  const totalRepas = filtered.reduce((sum, insc) => sum + (parseInt(insc.nombre_repas) || 0), 0);

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Inscriptions</h1>
          {formatNom && (
            <span className="text-gray-600">
              — Format : <strong>{formatNom}</strong>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Recherche..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
            className="border px-3 py-1 rounded w-full md:w-64"
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
            <option value="annulé">Annulé</option>
          </select>
          <button
            onClick={() => setModalAjoutOpen(true)} // ✅ ouvre le modal
            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
          >
            + Ajouter un coureur
          </button>
          <button
            onClick={() => {
              setColonnes([
                "nom", "prenom", "genre", "date_naissance", "nationalite",
                "email", "telephone", "adresse", "code_postal", "ville",
                "pays", "club", "dossard", "nombre_repas", "statut", "created_at"
              ]);
              setExportData(filtered.map(({ formats, ...rest }) => rest));
              setModalExportOpen(true);
            }}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Exporter CSV
          </button>
        </div>
      </div>

      <div className="border border-gray-300 p-4 rounded-md">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-1">Nom</th>
                <th className="border px-2 py-1">Prénom</th>
                <th className="border px-2 py-1">Dossard</th>
                <th className="border px-2 py-1">Email</th>
                <th className="border px-2 py-1">Club</th>
                <th className="border px-2 py-1">Repas</th>
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
                    {renderEditableCell(insc.nombre_repas, insc.id, "nombre_repas", "number")}
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
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-gray-500 py-4">
                    Aucune inscription trouvée pour ce format.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-3 text-sm font-semibold">
            🍽️ Total repas réservés : {totalRepas}
          </div>

          <div className="flex justify-between mt-2">
            <button
              onClick={() => handlePageChange(-1)}
              className="px-2 py-1 border rounded disabled:opacity-50"
              disabled={page === 0}
            >
              Précédent
            </button>
            <span className="text-sm">
              Page {Math.min(page + 1, totalPages)} / {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(1)}
              className="px-2 py-1 border rounded disabled:opacity-50"
              disabled={(page + 1) * ITEMS_PER_PAGE >= filtered.length}
            >
              Suivant
            </button>
          </div>
        </div>
      </div>

      <ExportCSVModal
        isOpen={modalExportOpen}
        onClose={() => setModalExportOpen(false)}
        colonnes={colonnes}
        donnees={exportData}
        nomFichier={`inscriptions_format_${format_id}.csv`}
      />

      {/* ✅ Intégration du modal ajout coureur */}
      <ModalAjoutCoureur
        isOpen={modalAjoutOpen}
        onClose={() => setModalAjoutOpen(false)}
        format={formatData}
        defaultCourseId={formatData?.course_id}
        onSaved={fetchInscriptions}
      />
    </div>
  );
}

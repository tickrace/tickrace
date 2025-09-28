import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { Link, useParams } from "react-router-dom";
import ExportCSVModal from "../components/ExportCSVModal";
import ModalAjoutCoureur from "../components/ModalAjoutCoureur";
import SendEmailModal from "../components/SendEmailModal";

export default function ListeInscriptions() {
  const { format_id } = useParams();
  const [inscriptions, setInscriptions] = useState([]);
  const [formatNom, setFormatNom] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [modalExportOpen, setModalExportOpen] = useState(false);
  const [modalAjoutOpen, setModalAjoutOpen] = useState(false);
  const [formatData, setFormatData] = useState(null);
  const [exportData, setExportData] = useState([]);
  const [colonnes, setColonnes] = useState([]);
  const [page, setPage] = useState(0);

  const [checked, setChecked] = useState({}); // id -> boolean
  const [sendModalOpen, setSendModalOpen] = useState(false);

  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    if (format_id) {
      fetchInscriptions();
      fetchFormatData();
      setChecked({});
    }
  }, [format_id]);

  const fetchInscriptions = async () => {
    const { data, error } = await supabase
      .from("inscriptions")
      .select("*, formats(id, nom), groupe:groupe_id(nom_groupe)")
      .eq("format_id", format_id)
      .order("created_at", { ascending: true });
    if (error) { console.error(error); return; }
    setInscriptions(data || []);
    setFormatNom(data?.[0]?.formats?.nom || "");
    setPage(0);
  };

  const fetchFormatData = async () => {
    const { data } = await supabase.from("formats").select("*").eq("id", format_id).single();
    setFormatData(data || null);
  };

  const handleUpdateChamp = async (id, field, value) => {
    const { error } = await supabase.from("inscriptions").update({ [field]: value }).eq("id", id);
    if (!error) fetchInscriptions();
  };

  const filtered = useMemo(() => {
    return (inscriptions || []).filter((insc) => {
      const hay = [
        insc?.nom, insc?.prenom, insc?.email, insc?.club, insc?.dossard,
        insc?.groupe?.nom_groupe,
      ].join(" ").toLowerCase();
      const matchText = hay.includes((searchTerm || "").toLowerCase());
      const matchStatut = !statutFilter || insc.statut === statutFilter;
      return matchText && matchStatut;
    });
  }, [inscriptions, searchTerm, statutFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
  const totalRepas = filtered.reduce((sum, insc) => sum + (parseInt(insc.nombre_repas) || 0), 0);

  const selectedIds = useMemo(
    () => Object.entries(checked).filter(([, v]) => v).map(([k]) => k),
    [checked]
  );
  const allOnPageChecked = useMemo(
    () => paginated.length > 0 && paginated.every((r) => checked[r.id]),
    [paginated, checked]
  );

  const toggleAllOnPage = (val) => {
    const next = { ...checked };
    paginated.forEach((r) => { next[r.id] = !!val; });
    setChecked(next);
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

  return (
    <div className="p-6 space-y-8">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Inscriptions</h1>
          {formatNom && <span className="text-neutral-600">— Format : <strong>{formatNom}</strong></span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Recherche (nom, email, équipe, dossard)…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
            onClick={() => setSendModalOpen(true)}
            className="px-3 py-1 rounded-xl bg-neutral-900 text-white hover:bg-black disabled:opacity-60"
            disabled={selectedIds.length === 0 && !format_id}
            title={selectedIds.length ? `Envoyer à ${selectedIds.length} sélectionné(s)` : "Aucune sélection – tous (par filtre)"}
          >
            ✉️ Envoyer un email {selectedIds.length ? `(${selectedIds.length})` : ""}
          </button>

          <button onClick={() => setModalAjoutOpen(true)} className="px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700">
            + Ajouter un coureur
          </button>
          <button
            onClick={() => {
              setColonnes([
                "nom","prenom","genre","date_naissance","nationalite","email","telephone","adresse",
                "code_postal","ville","pays","club","dossard","nombre_repas","statut","created_at","groupe.nom_groupe"
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

      {/* Tableau */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-3 py-2 w-10">
                <input
                  type="checkbox"
                  checked={allOnPageChecked}
                  onChange={(e) => toggleAllOnPage(e.target.checked)}
                />
              </th>
              <th className="text-left px-3 py-2">Nom</th>
              <th className="text-left px-3 py-2">Prénom</th>
              <th className="text-left px-3 py-2">Équipe</th>
              <th className="text-left px-3 py-2">Dossard</th>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Club</th>
              <th className="text-left px-3 py-2">Repas</th>
              <th className="text-left px-3 py-2">Statut</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((insc) => (
              <tr key={insc.id} className="border-t">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={!!checked[insc.id]}
                    onChange={(e) => setChecked((p) => ({ ...p, [insc.id]: e.target.checked }))}
                  />
                </td>
                <td className="px-3 py-2">{renderEditableCell(insc.nom, insc.id, "nom")}</td>
                <td className="px-3 py-2">{renderEditableCell(insc.prenom, insc.id, "prenom")}</td>
                <td className="px-3 py-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200">
                    {insc?.groupe?.nom_groupe || "—"}
                  </span>
                </td>
                <td className="px-3 py-2">{renderEditableCell(insc.dossard, insc.id, "dossard", "number")}</td>
                <td className="px-3 py-2">{renderEditableCell(insc.email, insc.id, "email")}</td>
                <td className="px-3 py-2">{renderEditableCell(insc.club, insc.id, "club")}</td>
                <td className="px-3 py-2">{renderEditableCell(insc.nombre_repas, insc.id, "nombre_repas", "number")}</td>
                <td className="px-3 py-2">{renderEditableCell(insc.statut, insc.id, "statut")}</td>
                <td className="px-3 py-2">
                  <Link to={`/details-coureur/${insc.id}`} className="text-orange-700 hover:underline">Détails</Link>
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-neutral-500">Aucune inscription.</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="px-4 py-3 border-t flex items-center justify-between text-sm">
          <div className="font-semibold">
            Sélection : {selectedIds.length} — 🍽️ Total repas (filtré) : {totalRepas}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-2 py-1 border rounded disabled:opacity-50"
              disabled={page === 0}
            >
              Précédent
            </button>
            <span>Page {Math.min(page + 1, totalPages)} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
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

      <ModalAjoutCoureur
        isOpen={modalAjoutOpen}
        onClose={() => setModalAjoutOpen(false)}
        format={formatData}
        defaultCourseId={formatData?.course_id}
        onSaved={fetchInscriptions}
      />

      <SendEmailModal
        open={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        formatId={format_id}
        selectedIds={selectedIds}
      />
    </div>
  );
}

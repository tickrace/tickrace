import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { Link, useParams } from "react-router-dom";
import ExportCSVModal from "../components/ExportCSVModal";
import ModalAjoutCoureur from "../components/ModalAjoutCoureur";

/* -------------------------- Modal envoi email (inscrits) -------------------------- */
function EmailBlastModalInscrits({ open, onClose, formatId, defaultStatuses = ["validé", "en attente"] }) {
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [statuses, setStatuses] = useState(defaultStatuses);
  const [sending, setSending] = useState(false);
  const allStatuses = ["en attente", "validé", "refusé", "annulé"];

  useEffect(() => {
    if (open) {
      setSubject("");
      setHtml("");
      setStatuses(defaultStatuses);
      setSending(false);
    }
  }, [open, defaultStatuses]);

  const toggleStatus = (s) => {
    setStatuses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  async function send() {
    if (!formatId) return;
    if (!subject.trim() || !html.trim()) {
      alert("Sujet et contenu sont requis.");
      return;
    }
    try {
      setSending(true);
      const { data, error } = await supabase.functions.invoke("organiser-send-emails", {
        body: { format_id: formatId, subject, html, statuses },
      });
      if (error) throw error;
      alert(`Email envoyé à ${data?.sent ?? 0} destinataire(s).`);
      onClose?.();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Échec de l’envoi.");
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/60 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Envoyer un email aux inscrits</h3>
          <button onClick={onClose} className="h-9 w-9 grid place-items-center rounded-xl hover:bg-neutral-100">✕</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-sm font-medium">Filtrer par statut</label>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              {allStatuses.map((s) => (
                <label key={s} className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={statuses.includes(s)}
                    onChange={() => toggleStatus(s)}
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Sujet</label>
            <input
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Informations course — rappel convocation…"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Contenu (HTML autorisé)</label>
            <textarea
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              rows={10}
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              placeholder="<p>Bonjour,</p><p>…</p>"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Astuce : utilisez des paragraphes &lt;p&gt; et des listes &lt;ul&gt;…&lt;/ul&gt;.
            </p>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-neutral-200 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium">Annuler</button>
          <button
            onClick={send}
            disabled={sending}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${sending ? "bg-neutral-400" : "bg-orange-600 hover:brightness-110"}`}
          >
            {sending ? "Envoi…" : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------------- */

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

  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    if (format_id) {
      fetchInscriptions();
      fetchFormatData();
    }
  }, [format_id]);

  const fetchInscriptions = async () => {
    const { data, error } = await supabase
      .from("inscriptions")
      .select("*, formats(id, nom), inscriptions_groupes (id, nom_groupe)")
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
    const { error } = await supabase.from("inscriptions").update({ [field]: value }).eq("id", id);
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

  const filtered = useMemo(() => {
    return (inscriptions || []).filter((insc) => {
      const hay = [
        insc?.nom,
        insc?.prenom,
        insc?.email,
        insc?.club,
        insc?.statut,
        insc?.dossard,
        insc?.groupe_id ? (insc?.inscriptions_groupes?.nom_groupe || "") : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const q = (searchTerm || "").toLowerCase();
      const matchesSearch = !q || hay.includes(q);
      const matchesStatut = !statutFilter || insc.statut === statutFilter;
      return matchesSearch && matchesStatut;
    });
  }, [inscriptions, searchTerm, statutFilter]);

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
            onClick={() => setEmailModalOpen(true)}
            className="px-3 py-1 bg-orange-600 text-white rounded hover:brightness-110"
          >
            ✉️ Envoyer un email
          </button>

          <button
            onClick={() => setModalAjoutOpen(true)}
            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
          >
            + Ajouter un coureur
          </button>
          <button
            onClick={() => {
              setColonnes([
                "nom",
                "prenom",
                "genre",
                "date_naissance",
                "nationalite",
                "email",
                "telephone",
                "adresse",
                "code_postal",
                "ville",
                "pays",
                "club",
                "dossard",
                "nombre_repas",
                "statut",
                "created_at",
              ]);
              setExportData(filtered.map(({ formats, inscriptions_groupes, ...rest }) => rest));
              setModalExportOpen(true);
            }}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Exporter CSV
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="text-left px-3 py-2">Nom</th>
              <th className="text-left px-3 py-2">Prénom</th>
              <th className="text-left px-3 py-2">Team</th>
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
                <td className="px-3 py-2">{renderEditableCell(insc.nom, insc.id, "nom")}</td>
                <td className="px-3 py-2">{renderEditableCell(insc.prenom, insc.id, "prenom")}</td>
                <td className="px-3 py-2">
                  <div className="text-xs text-neutral-700">
                    {insc.groupe_id ? (insc?.inscriptions_groupes?.nom_groupe || "—") : <span className="text-neutral-400">—</span>}
                  </div>
                </td>
                <td className="px-3 py-2">{renderEditableCell(insc.dossard, insc.id, "dossard", "number")}</td>
                <td className="px-3 py-2">{renderEditableCell(insc.email, insc.id, "email")}</td>
                <td className="px-3 py-2">{renderEditableCell(insc.club, insc.id, "club")}</td>
                <td className="px-3 py-2">{renderEditableCell(insc.nombre_repas, insc.id, "nombre_repas", "number")}</td>
                <td className="px-3 py-2">{renderEditableCell(insc.statut, insc.id, "statut")}</td>
                <td className="px-3 py-2">
                  <Link to={`/details-coureur/${insc.id}`} className="text-orange-700 hover:underline">
                    Détails
                  </Link>
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-neutral-500 py-6">
                  Aucune inscription trouvée pour ce format.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="px-4 py-3 border-t border-neutral-200 flex items-center justify-between">
          <div className="text-sm">
            🍽️ Total repas réservés (filtrés) : <b>{totalRepas}</b>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => handlePageChange(-1)}
              className="px-2 py-1 border rounded disabled:opacity-50"
              disabled={page === 0}
            >
              Précédent
            </button>
            <span>
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

      <ModalAjoutCoureur
        isOpen={modalAjoutOpen}
        onClose={() => setModalAjoutOpen(false)}
        format={formatData}
        defaultCourseId={formatData?.course_id}
        onSaved={fetchInscriptions}
      />

      {/* Modal email */}
      <EmailBlastModalInscrits
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        formatId={format_id}
      />
    </div>
  );
}

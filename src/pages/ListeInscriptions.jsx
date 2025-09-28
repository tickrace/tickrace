// src/pages/ListeInscriptions.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { Link, useParams } from "react-router-dom";
import ExportCSVModal from "../components/ExportCSVModal";
import ModalAjoutCoureur from "../components/ModalAjoutCoureur";

function Badge({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-neutral-100 text-neutral-800 border-neutral-200",
    green: "bg-emerald-100 text-emerald-800 border-emerald-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    red: "bg-rose-100 text-rose-800 border-rose-200",
    blue: "bg-blue-100 text-blue-800 border-blue-200",
    violet: "bg-violet-100 text-violet-800 border-violet-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full border ${tones[tone] || tones.neutral}`}>
      {children}
    </span>
  );
}

function StatusBadge({ statut }) {
  const s = (statut || "").toLowerCase();
  if (["validé","valide","payé","paye"].includes(s)) return <Badge tone="green">Validé</Badge>;
  if (["refusé","refuse"].includes(s)) return <Badge tone="red">Refusé</Badge>;
  if (["annulé","annule"].includes(s)) return <Badge tone="amber">Annulé</Badge>;
  return <Badge>En attente</Badge>;
}

function TypeBadge({ type, teamName }) {
  const t = (type || "").toLowerCase();
  if (t === "individuel") return <Badge tone="blue">Individuel</Badge>;
  return (
    <span className="inline-flex items-center gap-1">
      <Badge tone="violet">Équipe</Badge>
      {teamName ? <span className="text-[11px] text-neutral-600">· {teamName}</span> : null}
    </span>
  );
}

export default function ListeInscriptions() {
  const { format_id } = useParams();
  const [inscriptions, setInscriptions] = useState([]);
  const [formatNom, setFormatNom] = useState("");
  const [formatType, setFormatType] = useState(null); // 'individuel' | 'groupe' | 'relais'
  const [searchTerm, setSearchTerm] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // all | individuel | equipe
  const [modalExportOpen, setModalExportOpen] = useState(false);
  const [modalAjoutOpen, setModalAjoutOpen] = useState(false);
  const [formatData, setFormatData] = useState(null);
  const [exportData, setExportData] = useState([]);
  const [colonnes, setColonnes] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  // Emailing
  const [selected, setSelected] = useState({});
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    if (format_id) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format_id]);

  async function fetchData() {
    setLoading(true);

    const [{ data: format, error: fErr }, { data: list, error: iErr }] = await Promise.all([
      supabase
        .from("formats")
        .select("id, nom, type_format, course_id")
        .eq("id", format_id)
        .single(),
      supabase
        .from("inscriptions")
        .select(`
          *,
          formats!inner(id, nom, type_format),
          groupe:inscriptions_groupes(id, nom_groupe)
        `)
        .eq("format_id", format_id)
        .order("created_at", { ascending: true }),
    ]);

    if (fErr) {
      console.error("Erreur chargement format :", fErr);
    } else {
      setFormatData(format);
      setFormatNom(format?.nom || "");
      setFormatType(format?.type_format || null);
    }

    if (iErr) {
      console.error("Erreur chargement inscriptions :", iErr);
      setInscriptions([]);
    } else {
      setInscriptions(list || []);
    }

    setSelected({});
    setPage(0);
    setLoading(false);
  }

  const handleUpdateChamp = async (id, field, value) => {
    const { error } = await supabase
      .from("inscriptions")
      .update({ [field]: value })
      .eq("id", id);

    if (error) {
      console.error(error);
      return;
    }
    fetchData();
  };

  const toggleSelectAll = (checked, list) => {
    if (!checked) {
      setSelected({});
      return;
    }
    const next = {};
    list.forEach((r) => {
      if (r?.email) next[r.id] = true;
    });
    setSelected(next);
  };

  const toggleRow = (id) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const selectedRows = useMemo(() => inscriptions.filter((i) => selected[i.id]), [inscriptions, selected]);
  const selectedEmails = useMemo(
    () => selectedRows.map((r) => r.email).filter(Boolean),
    [selectedRows]
  );

  const filtered = useMemo(() => {
    const term = (searchTerm || "").toLowerCase().trim();
    return (inscriptions || []).filter((insc) => {
      const isTeam = !!insc.groupe_id;
      const typeOk =
        typeFilter === "all" ||
        (typeFilter === "individuel" && !isTeam) ||
        (typeFilter === "equipe" && isTeam);

      if (!typeOk) return false;
      const statutOk = !statutFilter || (insc.statut || "").toLowerCase() === statutFilter;
      if (!statutOk) return false;

      if (!term) return true;

      const hay = [
        insc.nom || "",
        insc.prenom || "",
        insc.email || "",
        insc.club || "",
        insc?.groupe?.nom_groupe || "",
        insc.dossard ? String(insc.dossard) : "",
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(term);
    });
  }, [inscriptions, searchTerm, statutFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  const totalRepas = filtered.reduce((sum, insc) => sum + (parseInt(insc.nombre_repas) || 0), 0);

  function renderEditableCell(value, id, field, type = "text") {
    if (field === "statut") {
      return (
        <select
          className="w-full rounded-lg border border-neutral-300 px-2 py-1 text-sm"
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
        className="w-full rounded-lg border border-neutral-300 px-2 py-1 text-sm"
        defaultValue={value || ""}
        onBlur={(e) => handleUpdateChamp(id, field, e.target.value)}
      />
    );
  }

  // ----- Email modal -----
  async function sendEmails() {
    if (selectedEmails.length === 0) {
      alert("Sélectionnez au moins un coureur avec un email.");
      return;
    }
    if (!emailSubject.trim() || !emailBody.trim()) {
      alert("Sujet et message requis.");
      return;
    }

    setEmailSending(true);
    try {
      // Essayez d'appeler une edge function côté Supabase (à créer)
      const { error } = await supabase.functions.invoke("organiser-send-emails", {
        body: {
          format_id,
          subject: emailSubject,
          body: emailBody,
          recipients: selectedEmails,
        },
      });

      if (error) throw error;

      setEmailModalOpen(false);
      setEmailSubject("");
      setEmailBody("");
      alert(`✅ Email envoyé à ${selectedEmails.length} destinataire(s).`);
    } catch (e) {
      // Fallback mailto
      const bcc = encodeURIComponent(selectedEmails.join(","));
      const subj = encodeURIComponent(emailSubject);
      const body = encodeURIComponent(emailBody);
      const mailto = `mailto:?bcc=${bcc}&subject=${subj}&body=${body}`;
      window.location.href = mailto;
      setEmailModalOpen(false);
    } finally {
      setEmailSending(false);
    }
  }

  // ----- Export -----
  function openExport() {
    setColonnes([
      "nom",
      "prenom",
      "email",
      "club",
      "dossard",
      "nombre_repas",
      "statut",
      "created_at",
      "team_name",
    ]);
    setExportData(
      filtered.map(({ formats, groupe, ...rest }) => ({
        ...rest,
        team_name: groupe?.nom_groupe || "",
      }))
    );
    setModalExportOpen(true);
  }

  return (
    <div className="px-4 sm:px-6 md:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-900 text-white ring-1 ring-black/10 px-3 py-1 text-xs">
            • Liste des inscriptions
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {formatNom || "Format"}{" "}
            {formatType ? (
              <span className="ml-2 align-middle">
                <TypeBadge type={formatType} />
              </span>
            ) : null}
          </h1>
          <p className="text-neutral-600">
            Recherchez, filtrez, éditez les champs, sélectionnez et contactez les coureurs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setModalAjoutOpen(true)}
            className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            + Ajouter un coureur
          </button>
          <button
            onClick={openExport}
            className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            Exporter CSV
          </button>
          <button
            disabled={selectedEmails.length === 0}
            onClick={() => setEmailModalOpen(true)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold text-white ${
              selectedEmails.length === 0
                ? "bg-neutral-400 cursor-not-allowed"
                : "bg-orange-500 hover:brightness-110"
            }`}
            title={selectedEmails.length === 0 ? "Sélectionnez des lignes avec email" : ""}
          >
            Envoyer un email ({selectedEmails.length})
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="px-4 sm:px-5 py-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Rechercher (nom, email, équipe, dossard)…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          />
          <select
            value={statutFilter}
            onChange={(e) => setStatutFilter(e.target.value)}
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">Tous les statuts</option>
            <option value="en attente">En attente</option>
            <option value="validé">Validé</option>
            <option value="refusé">Refusé</option>
            <option value="annulé">Annulé</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="all">Tous (individuel + équipe)</option>
            <option value="individuel">Individuel uniquement</option>
            <option value="equipe">Équipe uniquement</option>
          </select>
          <div className="flex items-center text-sm text-neutral-600">
            🍽️ Total repas filtrés : <b className="ml-1">{totalRepas}</b>
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr className="text-left text-neutral-600">
                <th className="py-2 pl-4 pr-2">
                  <input
                    type="checkbox"
                    checked={
                      paginated.length > 0 &&
                      paginated.every((r) => r.email && selected[r.id])
                    }
                    onChange={(e) => toggleSelectAll(e.target.checked, paginated)}
                    title="Sélectionner cette page (emails uniquement)"
                  />
                </th>
                <th className="py-2 px-2">Type</th>
                <th className="py-2 px-2">Nom</th>
                <th className="py-2 px-2">Prénom</th>
                <th className="py-2 px-2">Équipe</th>
                <th className="py-2 px-2">Email</th>
                <th className="py-2 px-2">Dossard</th>
                <th className="py-2 px-2">Repas</th>
                <th className="py-2 px-2">Statut</th>
                <th className="py-2 px-2">Créé</th>
                <th className="py-2 px-2 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-neutral-500">
                    Chargement…
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-neutral-500">
                    Aucune inscription trouvée pour ce filtre.
                  </td>
                </tr>
              ) : (
                paginated.map((insc) => {
                  const isTeam = !!insc.groupe_id;
                  const teamName = insc?.groupe?.nom_groupe || "";
                  return (
                    <tr key={insc.id} className="border-t border-neutral-200">
                      <td className="py-2 pl-4 pr-2 align-middle">
                        <input
                          type="checkbox"
                          checked={!!selected[insc.id]}
                          onChange={() => toggleRow(insc.id)}
                          disabled={!insc.email}
                          title={insc.email ? "Sélectionner" : "Email manquant"}
                        />
                      </td>
                      <td className="py-2 px-2 align-middle">
                        <TypeBadge type={isTeam ? "equipe" : "individuel"} teamName={teamName} />
                      </td>
                      <td className="py-2 px-2">{renderEditableCell(insc.nom, insc.id, "nom")}</td>
                      <td className="py-2 px-2">{renderEditableCell(insc.prenom, insc.id, "prenom")}</td>
                      <td className="py-2 px-2">
                        {isTeam ? (
                          <span className="text-neutral-900 font-medium">{teamName || "—"}</span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="py-2 px-2">{renderEditableCell(insc.email, insc.id, "email")}</td>
                      <td className="py-2 px-2 w-24">{renderEditableCell(insc.dossard, insc.id, "dossard", "number")}</td>
                      <td className="py-2 px-2 w-24">{renderEditableCell(insc.nombre_repas, insc.id, "nombre_repas", "number")}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <StatusBadge statut={insc.statut} />
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        {insc.created_at
                          ? new Date(insc.created_at).toLocaleString("fr-FR")
                          : "—"}
                      </td>
                      <td className="py-2 px-2 text-right pr-4">
                        <Link
                          to={`/details-coureur/${insc.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          Détails
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer table : pagination */}
        {!loading && (
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-neutral-200 text-sm">
            <div className="text-neutral-600">
              Sélection : <b>{selectedEmails.length}</b> email(s)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-lg border border-neutral-300 px-2 py-1 disabled:opacity-50"
                disabled={page === 0}
              >
                Précédent
              </button>
              <span>
                Page {Math.min(page + 1, totalPages)} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="rounded-lg border border-neutral-300 px-2 py-1 disabled:opacity-50"
                disabled={page >= totalPages - 1}
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
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
        onSaved={fetchData}
      />

      {/* Email composer modal */}
      {emailModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-neutral-900/60 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <button className="absolute inset-0 cursor-default" onClick={() => setEmailModalOpen(false)} aria-label="Fermer" />
          <div className="relative w-full sm:max-w-2xl bg-white rounded-2xl shadow-2xl ring-1 ring-neutral-200 overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-neutral-900 text-white px-3 py-1 text-[11px] ring-1 ring-black/10">
                  Email aux inscrits
                </div>
                <h3 className="mt-2 text-lg font-bold">Composer un message</h3>
                <p className="text-xs text-neutral-600">
                  Destinataires : <b>{selectedEmails.length}</b> (emails valides uniquement)
                </p>
              </div>
              <button
                onClick={() => setEmailModalOpen(false)}
                className="h-9 w-9 grid place-items-center rounded-xl hover:bg-neutral-100 text-neutral-600"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <div className="px-4 sm:px-5 py-4 grid gap-3">
              <input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Sujet"
                className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              />
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Votre message (texte brut ou HTML simple)"
                rows={8}
                className="rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              />
              <p className="text-[12px] text-neutral-500">
                Astuce : vous pouvez utiliser du HTML simple (ex. &lt;b&gt;important&lt;/b&gt;). Si l’envoi serveur échoue,
                un brouillon s’ouvrira dans votre client email avec les destinataires en Cci.
              </p>
            </div>

            <div className="px-4 sm:px-5 py-4 border-t border-neutral-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setEmailModalOpen(false)}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
              >
                Annuler
              </button>
              <button
                onClick={sendEmails}
                disabled={emailSending || selectedEmails.length === 0 || !emailSubject.trim() || !emailBody.trim()}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                  emailSending || selectedEmails.length === 0 || !emailSubject.trim() || !emailBody.trim()
                    ? "bg-neutral-400 cursor-not-allowed"
                    : "bg-orange-500 hover:brightness-110"
                }`}
              >
                {emailSending ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

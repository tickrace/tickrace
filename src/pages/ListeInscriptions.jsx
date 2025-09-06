import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import { Link, useParams } from "react-router-dom";
import ExportCSVModal from "../components/ExportCSVModal";
import ModalAjoutCoureur from "../components/ModalAjoutCoureur";
import { useUser } from "../contexts/UserContext"; // ✅ pour le JWT

export default function ListeInscriptions() {
  const { format_id } = useParams();
  const { session } = useUser();
  const accessToken = session?.access_token || null;

  const [inscriptions, setInscriptions] = useState([]);
  const [formatNom, setFormatNom] = useState("");
  const [formatData, setFormatData] = useState(null); // pour le modal ajout
  const [searchTerm, setSearchTerm] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [modalExportOpen, setModalExportOpen] = useState(false);
  const [modalAjoutOpen, setModalAjoutOpen] = useState(false);
  const [exportData, setExportData] = useState([]);
  const [colonnes, setColonnes] = useState([]);
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 50;

  // ✅ Sélection & modale “Message groupé”
  const [selected, setSelected] = useState(new Set());
  const selectedCount = selected.size;
  const masterRef = useRef(null);

  const [openBulkMail, setOpenBulkMail] = useState(false);
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkBody, setBulkBody] = useState("");
  const [dryRunning, setDryRunning] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (format_id) {
      fetchInscriptions();
      fetchFormatData();
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
    setSelected(new Set()); // reset sélection quand on recharge
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

  // 🔎 Filtre & pagination
  const filtered = useMemo(() => {
    const st = searchTerm.trim().toLowerCase();
    return inscriptions.filter((insc) => {
      const matchesSearch = !st
        ? true
        : Object.values(insc || {})
            .join(" ")
            .toLowerCase()
            .includes(st);
      const matchesStatut = !statutFilter || insc.statut === statutFilter;
      return matchesSearch && matchesStatut;
    });
  }, [inscriptions, searchTerm, statutFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
  const totalRepas = filtered.reduce((sum, insc) => sum + (parseInt(insc.nombre_repas) || 0), 0);

  // ✅ Sélection helpers
  useEffect(() => {
    const total = filtered.length;
    const count = selectedCount;
    if (masterRef.current) {
      masterRef.current.indeterminate = count > 0 && count < total;
    }
  }, [filtered.length, selectedCount]);

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    const ids = filtered.map((r) => r.id);
    const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(ids));
  };

  // ✉️ Bulk message – dry-run + envoi
  const bulkDryRun = async () => {
    if (selected.size === 0) return;
    if (!bulkSubject.trim() || !bulkBody.trim()) {
      alert("Sujet et message sont requis pour le test.");
      return;
    }
    setDryRunning(true);
    setDryRunResult(null);
    try {
      const ids = Array.from(selected);
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/runners-bulk-message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            inscription_ids: ids,
            subject: bulkSubject,
            message: bulkBody,
            dry_run: true,
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Dry-run impossible");
      setDryRunResult(json);
    } catch (e) {
      console.error(e);
      alert("Erreur lors du dry-run.");
    } finally {
      setDryRunning(false);
    }
  };

  const bulkSendMessage = async () => {
    if (selected.size === 0) return;
    if (!bulkSubject.trim() || !bulkBody.trim()) {
      alert("Sujet et message sont requis.");
      return;
    }
    setSending(true);
    try {
      const ids = Array.from(selected);
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/runners-bulk-message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            inscription_ids: ids,
            subject: bulkSubject,
            message: bulkBody,
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Envoi impossible");
      setOpenBulkMail(false);
      setSelected(new Set());
      setBulkSubject("");
      setBulkBody("");
      setDryRunResult(null);
      alert("Message envoyé aux coureurs sélectionnés.");
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l’envoi groupé.");
    } finally {
      setSending(false);
    }
  };

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
            onClick={() => setModalAjoutOpen(true)}
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

      {/* ✅ Barre d’actions sélection */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm text-neutral-600">
          Sélection : <strong>{selectedCount}</strong>
        </div>
        <button
          disabled={selectedCount === 0}
          onClick={() => { setOpenBulkMail(true); setDryRunResult(null); }}
          className="px-3 py-1.5 rounded bg-neutral-900 text-white text-sm font-semibold disabled:opacity-50"
        >
          ✉️ Message…
        </button>
        {selectedCount > 0 && (
          <button
            onClick={() => setSelected(new Set())}
            className="px-3 py-1.5 rounded border bg-white text-sm"
          >
            Effacer la sélection
          </button>
        )}
      </div>

      <div className="border border-gray-300 p-4 rounded-md">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-1 w-10 text-center">
                  <input
                    ref={masterRef}
                    type="checkbox"
                    onChange={toggleAllFiltered}
                    checked={filtered.length > 0 && selectedCount === filtered.length}
                    aria-label="Tout sélectionner"
                  />
                </th>
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
                  <td className="border px-2 py-1 text-center align-top">
                    <input
                      type="checkbox"
                      checked={selected.has(insc.id)}
                      onChange={() => toggleOne(insc.id)}
                      aria-label="Sélectionner"
                    />
                  </td>
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
                  <td colSpan={9} className="text-center text-gray-500 py-4">
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

      {/* Export CSV */}
      <ExportCSVModal
        isOpen={modalExportOpen}
        onClose={() => setModalExportOpen(false)}
        colonnes={colonnes}
        donnees={exportData}
        nomFichier={`inscriptions_format_${format_id}.csv`}
      />

      {/* Ajout coureur */}
      <ModalAjoutCoureur
        isOpen={modalAjoutOpen}
        onClose={() => setModalAjoutOpen(false)}
        format={formatData}
        defaultCourseId={formatData?.course_id}
        onSaved={fetchInscriptions}
      />

      {/* ✉️ Modale message groupé */}
      {openBulkMail && (
        <BulkMailModal
          onClose={() => (!sending && !dryRunning) && setOpenBulkMail(false)}
          subject={bulkSubject}
          setSubject={setBulkSubject}
          body={bulkBody}
          setBody={setBulkBody}
          onDryRun={bulkDryRun}
          dryRunning={dryRunning}
          dryRunResult={dryRunResult}
          onSend={bulkSendMessage}
          sending={sending}
          count={selectedCount}
        />
      )}
    </div>
  );
}

/* ===== Modale ===== */
function BulkMailModal({
  onClose,
  subject,
  setSubject,
  body,
  setBody,
  onDryRun,
  dryRunning,
  dryRunResult,
  onSend,
  sending,
  count,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl rounded-2xl border bg-white shadow-xl">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Message groupé</h3>
            <div className="text-xs text-neutral-600">{count} destinataire(s) sélectionné(s)</div>
          </div>
          <button onClick={onClose} className="rounded-lg border px-2 py-1 text-sm hover:bg-neutral-50">
            Fermer
          </button>
        </div>
        <div className="p-4 space-y-3">
          <label className="block">
            <span className="text-sm font-medium">Sujet</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="Infos course — [Nom/Format]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Message</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              rows={10}
              placeholder={`Bonjour {{prenom}},\n\nMerci pour votre inscription à {{course}} — {{format}}.\nVotre dossard: {{dossard}}\n\nSportivement,\nL’équipe`}
            />
          </label>
          <div className="text-xs text-neutral-500">
            Variables : <code>{"{{prenom}}"}</code>, <code>{"{{nom}}"}</code>, <code>{"{{course}}"}</code>, <code>{"{{format}}"}</code>, <code>{"{{dossard}}"}</code>.
          </div>

          {dryRunResult && (
            <div className="mt-3 rounded-xl border bg-neutral-50 p-3 text-sm">
              <div className="font-medium mb-1">Dry-run : récapitulatif</div>
              <ul className="grid grid-cols-2 gap-2">
                <li>Sélection demandée : <strong>{dryRunResult.requested}</strong></li>
                <li>Autorisées : <strong>{dryRunResult.permitted}</strong></li>
                <li>Après filtres : <strong>{dryRunResult.permitted_after_filters}</strong></li>
                <li>Emails à envoyer : <strong>{dryRunResult.will_send_to ?? dryRunResult.attempted}</strong></li>
              </ul>
              {Array.isArray(dryRunResult.sample) && dryRunResult.sample.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-neutral-600 mb-1">Échantillon :</div>
                  <ul className="list-disc pl-5">
                    {dryRunResult.sample.map((t, i) => (
                      <li key={i}>
                        {t.email} — {t.prenom} {t.nom} ({t.course} — {t.format}) {t.dossard ? `#${t.dossard}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="p-4 border-t flex items-center justify-end gap-2">
          <button
            onClick={onDryRun}
            disabled={dryRunning}
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-60"
          >
            {dryRunning ? "Test…" : "Tester (dry-run)"}
          </button>
          <button
            onClick={onSend}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-white text-sm font-semibold disabled:opacity-60"
          >
            {sending ? "Envoi…" : "Envoyer le message"}
          </button>
        </div>
      </div>
    </div>
  );
}

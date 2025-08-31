// src/pages/ListeBenevoles.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Mail, X } from "lucide-react";

export default function ListeBenevoles() {
  const { session } = useUser();
  const userId = session?.user?.id || null;
  const accessToken = session?.access_token || null;

  const [searchParams, setSearchParams] = useSearchParams();
  const wantedCourse = searchParams.get("course"); // UUID optionnel

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [rows, setRows] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("all");
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(null); // id en cours de sauvegarde

  // Sélection
  const [selected, setSelected] = useState(() => new Set());
  const selectedCount = selected.size;

  // Modal message groupé
  const [openBulkMail, setOpenBulkMail] = useState(false);
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkBody, setBulkBody] = useState("");
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkValidating, setBulkValidating] = useState(false);

  // Dry-run
  const [dryRunning, setDryRunning] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);

  // Master checkbox indeterminate
  const masterRef = useRef(null);

  useEffect(() => {
    if (!userId) return;
    let abort = false;

    async function run() {
      setLoading(true);

      // 1) Épreuves de l'organisateur
      const { data: cList, error: eCourses } = await supabase
        .from("courses")
        .select("id, nom, lieu")
        .eq("organisateur_id", userId)
        .order("created_at", { ascending: false });

      if (eCourses) {
        console.error(eCourses);
        setCourses([]);
      } else {
        setCourses(cList || []);
        // Pré-sélection via ?course=<id> si l'id appartient bien à l'orga
        if (wantedCourse && (cList || []).some((c) => c.id === wantedCourse)) {
          setSelectedCourseId(wantedCourse);
        }
      }

      // 2) Demandes bénévoles
      const { data: bi, error: eBI } = await supabase
        .from("benevoles_inscriptions")
        .select(`
          id, course_id, benevole_id, statut, message, notes_internes, created_at,
          benevole:benevole_id ( id, nom, prenom, email, telephone ),
          course:course_id ( id, nom, lieu )
        `)
        .order("created_at", { ascending: false });

      if (eBI) {
        console.error(eBI);
        setRows([]);
      } else {
        setRows(bi || []);
      }

      if (!abort) setLoading(false);
    }

    run();
    return () => { abort = true; };
  }, [userId, wantedCourse]);

  // Synchroniser l'URL quand on change le filtre
  useEffect(() => {
    const sp = new URLSearchParams(searchParams);
    if (selectedCourseId === "all") {
      if (sp.has("course")) {
        sp.delete("course");
        setSearchParams(sp, { replace: true });
      }
    } else {
      if (sp.get("course") !== selectedCourseId) {
        sp.set("course", selectedCourseId);
        setSearchParams(sp, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId]);

  // Filtrage client (course + recherche texte)
  const filtered = useMemo(() => {
    const list = rows.filter((r) => {
      if (selectedCourseId !== "all" && r.course_id !== selectedCourseId) return false;
      if (!q.trim()) return true;
      const needle = q.trim().toLowerCase();
      const hay = [
        r?.benevole?.nom,
        r?.benevole?.prenom,
        r?.benevole?.email,
        r?.benevole?.telephone,
        r?.message,
        r?.course?.nom,
        r?.course?.lieu,
        r?.notes_internes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
    return list;
  }, [rows, selectedCourseId, q]);

  // Nettoyer la sélection quand la liste change
  useEffect(() => {
    const ids = new Set(filtered.map((r) => r.id));
    setSelected((prev) => {
      const next = new Set(Array.from(prev).filter((id) => ids.has(id)));
      return next;
    });
  }, [filtered]);

  // Master checkbox indeterminate
  useEffect(() => {
    const total = filtered.length;
    const count = selectedCount;
    if (masterRef.current) {
      masterRef.current.indeterminate = count > 0 && count < total;
    }
  }, [filtered.length, selectedCount]);

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    const allIds = filtered.map((r) => r.id);
    const allSelected = allIds.every((id) => selected.has(id)) && allIds.length > 0;
    setSelected(() => (allSelected ? new Set() : new Set(allIds)));
  }

  async function updateStatut(rowId, statut) {
    setSaving(rowId);
    const { error } = await supabase
      .from("benevoles_inscriptions")
      .update({ statut })
      .eq("id", rowId);
    if (error) {
      alert("Impossible de mettre à jour le statut.");
      console.error(error);
    } else {
      setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, statut } : r)));
    }
    setSaving(null);
  }

  async function updateNotes(rowId, notes_internes) {
    setSaving(rowId);
    const { error } = await supabase
      .from("benevoles_inscriptions")
      .update({ notes_internes })
      .eq("id", rowId);
    if (error) {
      alert("Impossible d’enregistrer les notes.");
      console.error(error);
    } else {
      setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, notes_internes } : r)));
    }
    setSaving(null);
  }

  // ====== Actions de masse
  async function bulkValidateSelected(withEmail = true) {
    if (selectedCount === 0) return;
    setBulkValidating(true);
    try {
      const ids = Array.from(selected);
      // 1) MAJ en base (statut = 'valide')
      const { error } = await supabase
        .from("benevoles_inscriptions")
        .update({ statut: "valide" })
        .in("id", ids);
      if (error) throw error;

      // Local update
      setRows((prev) =>
        prev.map((r) => (ids.includes(r.id) ? { ...r, statut: "valide" } : r))
      );

      // 2) (optionnel) email auto de confirmation par inscription
      if (withEmail) {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/volunteer-status-email`;
        const chunks = chunk(ids, 5);
        for (const part of chunks) {
          await Promise.allSettled(
            part.map((id) =>
              fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inscription_id: id }),
              })
            )
          );
        }
      }

      setSelected(new Set());
      alert("Sélection validée.");
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la validation en masse.");
    } finally {
      setBulkValidating(false);
    }
  }

  async function bulkDryRun() {
    if (selectedCount === 0) return;
    if (!bulkSubject.trim() || !bulkBody.trim()) {
      alert("Sujet et message sont requis pour le test.");
      return;
    }
    setDryRunning(true);
    setDryRunResult(null);
    try {
      const ids = Array.from(selected);
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/volunteer-bulk-message`,
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
  }

  async function bulkSendMessage() {
    if (selectedCount === 0) return;
    if (!bulkSubject.trim() || !bulkBody.trim()) {
      alert("Sujet et message sont requis.");
      return;
    }
    setBulkSending(true);
    try {
      const ids = Array.from(selected);
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/volunteer-bulk-message`,
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
      if (!res.ok) {
        throw new Error(json?.error || "Envoi impossible");
      }
      setOpenBulkMail(false);
      setSelected(new Set());
      setBulkSubject("");
      setBulkBody("");
      setDryRunResult(null);
      alert("Message envoyé aux bénévoles sélectionnés.");
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l’envoi groupé.");
    } finally {
      setBulkSending(false);
    }
  }

  if (!userId) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-xl font-semibold">Bénévoles</h1>
        <p className="mt-2 text-neutral-600">Connectez-vous pour accéder à vos demandes.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Bénévoles</h1>
        <Link
          to="/mon-espace"
          className="text-sm text-neutral-600 hover:text-neutral-900 underline underline-offset-4"
        >
          ← Retour à mon espace
        </Link>
      </div>

      {/* Filtres */}
      <div className="mt-4 flex flex-col md:flex-row gap-3 md:items-center">
        <label className="inline-flex items-center gap-2">
          <span className="text-sm text-neutral-700">Épreuve</span>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          >
            <option value="all">Toutes mes épreuves</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom} — {c.lieu}
              </option>
            ))}
          </select>
        </label>

        <div className="md:ml-auto flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Recherche (nom, email, tel, message...)"
            className="w-full md:w-80 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
          <button
            onClick={exportCSV(filtered)}
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Barre d'actions de masse */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="text-sm text-neutral-600">
          Sélection : <strong>{selectedCount}</strong>
        </div>
        <button
          disabled={selectedCount === 0 || bulkValidating}
          onClick={() => bulkValidateSelected(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-white text-sm font-semibold disabled:opacity-60"
          title="Valider la sélection et envoyer l'email de confirmation"
        >
          <Check className="w-4 h-4" />
          Valider la sélection
        </button>
        <button
          disabled={selectedCount === 0}
          onClick={() => {
            setOpenBulkMail(true);
            setDryRunResult(null);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-white text-sm font-semibold disabled:opacity-60"
          title="Envoyer un message aux bénévoles sélectionnés"
        >
          <Mail className="w-4 h-4" />
          Message…
        </button>
        {selectedCount > 0 && (
          <button
            onClick={() => setSelected(new Set())}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            title="Vider la sélection"
          >
            <X className="w-4 h-4" />
            Effacer la sélection
          </button>
        )}
      </div>

      {/* Tableau */}
      <div className="mt-3 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-700">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  ref={masterRef}
                  type="checkbox"
                  onChange={toggleAllFiltered}
                  checked={filtered.length > 0 && selectedCount === filtered.length}
                  aria-label="Tout sélectionner"
                />
              </th>
              <th className="text-left px-4 py-3 w-[140px]">Date</th>
              <th className="text-left px-4 py-3">Épreuve</th>
              <th className="text-left px-4 py-3">Bénévole</th>
              <th className="text-left px-4 py-3">Contact</th>
              <th className="text-left px-4 py-3">Message</th>
              <th className="text-left px-4 py-3 w-[140px]">Statut</th>
              <th className="text-left px-4 py-3 w-[220px]">Notes internes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-neutral-600" colSpan={8}>
                  Chargement…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-neutral-600" colSpan={8}>
                  Aucune demande trouvée.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const isChecked = selected.has(r.id);
                return (
                  <tr key={r.id} className="odd:bg-neutral-50/40">
                    <td className="px-4 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(r.id)}
                        aria-label="Sélectionner"
                      />
                    </td>
                    <td className="px-4 py-3 align-top">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium">{r.course?.nom || "—"}</div>
                      <div className="text-xs text-neutral-600">{r.course?.lieu || "—"}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium">
                        {r.benevole?.prenom} {r.benevole?.nom}
                      </div>
                      <div className="text-xs text-neutral-600">#{r.benevole_id?.slice(0, 8)}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div>
                        {r.benevole?.email ? (
                          <a
                            href={`mailto:${r.benevole.email}`}
                            className="text-orange-700 hover:underline"
                          >
                            {r.benevole.email}
                          </a>
                        ) : (
                          "—"
                        )}
                      </div>
                      <div className="text-xs">
                        {r.benevole?.telephone ? (
                          <a href={`tel:${r.benevole.telephone}`} className="hover:underline">
                            {r.benevole.telephone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-pre-line align-top">
                      {r.message || <span className="text-neutral-500">—</span>}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <select
                        disabled={saving === r.id}
                        value={r.statut}
                        onChange={(e) => updateStatut(r.id, e.target.value)}
                        className="rounded-xl border border-neutral-200 px-2 py-1 text-sm"
                      >
                        <option value="nouveau">nouveau</option>
                        <option value="valide">valide</option>
                        <option value="refuse">refuse</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <textarea
                        defaultValue={r.notes_internes || ""}
                        onBlur={(e) => {
                          const val = e.target.value;
                          if (val !== (r.notes_internes || "")) {
                            updateNotes(r.id, val);
                          }
                        }}
                        placeholder="Ajouter une note interne…"
                        rows={2}
                        className="w-full rounded-xl border border-neutral-200 px-2 py-1 text-sm"
                      />
                      {saving === r.id && (
                        <div className="mt-1 text-[11px] text-neutral-500">Enregistrement…</div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-neutral-500">
        Conseil : la validation peut déclencher un email automatique (<code>volunteer-status-email</code>).
        Pour un message groupé libre, utilisez “Message…”, puis “Tester (dry-run)” avant d’envoyer.
      </div>

      {/* Modal "Message groupé" */}
      {openBulkMail && (
        <BulkMailModal
          onClose={() => (!bulkSending && !dryRunning) && setOpenBulkMail(false)}
          subject={bulkSubject}
          setSubject={setBulkSubject}
          body={bulkBody}
          setBody={setBulkBody}
          onDryRun={bulkDryRun}
          dryRunning={dryRunning}
          dryRunResult={dryRunResult}
          onSend={bulkSendMessage}
          sending={bulkSending}
          count={selectedCount}
        />
      )}
    </div>
  );
}

/* ===== Modal simple ===== */
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
          <button
            onClick={onClose}
            className="rounded-lg border px-2 py-1 text-sm hover:bg-neutral-50"
          >
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
              placeholder="Infos bénévoles — [Nom de l’épreuve]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Message</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              rows={10}
              placeholder={`Bonjour {{prenom}},\n\nMerci pour votre aide. RDV samedi 7h au gymnase.\n\nSportivement,\nL’équipe`}
            />
          </label>
          <div className="text-xs text-neutral-500">
            Variables disponibles : <code>{"{{prenom}}"}</code>, <code>{"{{nom}}"}</code>,{" "}
            <code>{"{{course}}"}</code>, <code>{"{{lieu}}"}</code>.
          </div>

          {/* Résultats du dry-run */}
          {dryRunResult && (
            <div className="mt-3 rounded-xl border bg-neutral-50 p-3 text-sm">
              <div className="font-medium mb-1">Dry-run : récapitulatif</div>
              <ul className="grid grid-cols-2 gap-2">
                <li>Demandes sélectionnées : <strong>{dryRunResult.requested}</strong></li>
                <li>Autorisées (vos épreuves) : <strong>{dryRunResult.permitted}</strong></li>
                <li>Après filtres : <strong>{dryRunResult.permitted_after_filters}</strong></li>
                <li>Emails à envoyer : <strong>{dryRunResult.will_send_to ?? dryRunResult.attempted}</strong></li>
              </ul>
              {Array.isArray(dryRunResult.sample) && dryRunResult.sample.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-neutral-600 mb-1">Échantillon :</div>
                  <ul className="list-disc pl-5">
                    {dryRunResult.sample.map((t, i) => (
                      <li key={i}>
                        {t.email} — {t.prenom} {t.nom} ({t.course}, {t.lieu})
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
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
            title="Simuler l'envoi (aucun email envoyé)"
          >
            {dryRunning ? "Test…" : "Tester (dry-run)"}
          </button>
          <button
            onClick={onSend}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-white text-sm font-semibold disabled:opacity-60"
          >
            <Mail className="w-4 h-4" />
            {sending ? "Envoi…" : "Envoyer le message"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== Helpers ===== */

function fmtDate(d) {
  try {
    const dd = new Date(d);
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dd);
  } catch {
    return "—";
  }
}

function exportCSV(list) {
  return () => {
    const headers = [
      "Date",
      "Épreuve",
      "Lieu",
      "Nom",
      "Prénom",
      "Email",
      "Téléphone",
      "Statut",
      "Message",
      "Notes internes",
    ];
    const lines = [headers.join(";")];
    list.forEach((r) => {
      const cols = [
        fmtDate(r.created_at),
        r.course?.nom || "",
        r.course?.lieu || "",
        r.benevole?.nom || "",
        r.benevole?.prenom || "",
        r.benevole?.email || "",
        r.benevole?.telephone || "",
        r.statut || "",
        clean(r.message),
        clean(r.notes_internes),
      ];
      lines.push(cols.map(csvCell).join(";"));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "benevoles.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
}

function clean(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function csvCell(s) {
  const v = (s ?? "").toString();
  if (/[;"\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

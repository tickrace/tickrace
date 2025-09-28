import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import { Link } from "react-router-dom";

/* ------------------ Modal envoi email (bénévoles par course) ------------------ */
function EmailBlastModalVolunteers({ open, onClose, courseId, defaultStatuses = ["nouveau", "valide"] }) {
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [statuses, setStatuses] = useState(defaultStatuses);
  const [sending, setSending] = useState(false);
  const allStatuses = ["nouveau", "valide", "refuse"];

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
    if (!courseId) {
      alert("Sélectionnez une épreuve pour envoyer un email.");
      return;
    }
    if (!subject.trim() || !html.trim()) {
      alert("Sujet et contenu sont requis.");
      return;
    }
    try {
      setSending(true);
      const { data, error } = await supabase.functions.invoke("organiser-send-volunteer-emails", {
        body: { course_id: courseId, subject, html, statuses },
      });
      if (error) throw error;
      alert(`Email envoyé à ${data?.sent ?? 0} bénévole(s).`);
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
          <h3 className="text-lg font-semibold">Envoyer un email aux bénévoles</h3>
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
              placeholder="Brief bénévoles — convocation, horaires…"
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

/* -------------------------------------------------------------------------------- */

export default function ListeBenevoles() {
  const { session } = useUser();
  const userId = session?.user?.id || null;

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [rows, setRows] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("all");
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(null);

  const [emailModalOpen, setEmailModalOpen] = useState(false);

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
      }

      // 2) Demandes bénévoles (avec jointures)
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
  }, [userId]);

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

  async function updateStatut(rowId, statut) {
    setSaving(rowId);
    const { error } = await supabase.from("benevoles_inscriptions").update({ statut }).eq("id", rowId);
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
    const { error } = await supabase.from("benevoles_inscriptions").update({ notes_internes }).eq("id", rowId);
    if (error) {
      alert("Impossible d’enregistrer les notes.");
      console.error(error);
    } else {
      setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, notes_internes } : r)));
    }
    setSaving(null);
  }

  if (!userId) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-xl font-semibold">Bénévoles</h1>
        <p className="mt-2 text-neutral-600">Connectez-vous pour accéder à vos demandes.</p>
      </div>
    );
    }

  const canEmail = selectedCourseId !== "all";

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

      {/* Filtres + action email */}
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
            onClick={() => setEmailModalOpen(true)}
            disabled={!canEmail}
            title={canEmail ? "Envoyer un email aux bénévoles de l’épreuve sélectionnée" : "Choisissez une épreuve"}
            className={`rounded-xl px-3 py-2 text-sm font-semibold text-white ${canEmail ? "bg-orange-600 hover:brightness-110" : "bg-neutral-400 cursor-not-allowed"}`}
          >
            ✉️ Envoyer un email
          </button>
        </div>
      </div>

      {/* Tableau */}
      <div className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-700">
            <tr>
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
                <td className="px-4 py-6 text-neutral-600" colSpan={7}>
                  Chargement…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-neutral-600" colSpan={7}>
                  Aucune demande trouvée.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="odd:bg-neutral-50/40">
                  <td className="px-4 py-3">{fmtDate(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.course?.nom || "—"}</div>
                    <div className="text-xs text-neutral-600">{r.course?.lieu || "—"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {r.benevole?.prenom} {r.benevole?.nom}
                    </div>
                    <div className="text-xs text-neutral-600">#{r.benevole_id?.slice(0, 8)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      {r.benevole?.email ? (
                        <a href={`mailto:${r.benevole.email}`} className="text-orange-700 hover:underline">
                          {r.benevole.email}
                        </a>
                      ) : ("—")}
                    </div>
                    <div className="text-xs">
                      {r.benevole?.telephone ? (
                        <a href={`tel:${r.benevole.telephone}`} className="hover:underline">
                          {r.benevole.telephone}
                        </a>
                      ) : ("—")}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-pre-line">
                    {r.message || <span className="text-neutral-500">—</span>}
                  </td>
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3">
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
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-neutral-500">
        Conseil : le statut <strong>valide</strong> peut déclencher un envoi groupé (bouton en haut à droite).
      </div>

      {/* Modal email */}
      <EmailBlastModalVolunteers
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        courseId={selectedCourseId !== "all" ? selectedCourseId : null}
      />
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

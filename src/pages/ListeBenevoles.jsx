// src/pages/ListeBenevoles.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import { Link } from "react-router-dom";

/* ----------------------------- TipTap Editor ----------------------------- */
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExt from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";

/* ------------------------------ UI Helpers ------------------------------ */
function Toolbar({ editor }) {
  if (!editor) return null;
  const btn = (active, onClick, label) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 rounded text-sm border ${
        active ? "bg-neutral-900 text-white border-neutral-900" : "bg-white hover:bg-neutral-50 border-neutral-300"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "Gras")}
      {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "Italique")}
      {btn(editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), "Souligné")}
      {btn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), "• Liste")}
      {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "1. Liste")}
      {btn(false, () => {
        const url = window.prompt("Lien (URL) :");
        if (!url) return;
        editor.chain().focus().extendMarkRange("link").setLink({ href: url, target: "_blank" }).run();
      }, "Lien")}
      {btn(false, () => editor.chain().focus().unsetLink().run(), "Retirer lien")}
      {btn(false, () => editor.chain().focus().setParagraph().run(), "Paragraphe")}
      {btn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "Titre")}
      {btn(false, () => editor.chain().focus().undo().run(), "↶")}
      {btn(false, () => editor.chain().focus().redo().run(), "↷")}
    </div>
  );
}

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
function clean(s) { return (s || "").replace(/\s+/g, " ").trim(); }
function csvCell(s) { const v = (s ?? "").toString(); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }

/* ======================================================================= */

export default function ListeBenevoles() {
  const { session } = useUser();
  const userId = session?.user?.id || null;

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [rows, setRows] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("all");
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(null); // id en cours de sauvegarde

  // Sélection pour email
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [subject, setSubject] = useState("Merci pour votre aide bénévole — {{course.nom}}");
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState(null);

  // TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      LinkExt.configure({ openOnClick: true }),
      Placeholder.configure({
        placeholder:
          "Rédige ton message… Variables disponibles : {{benevole.prenom}}, {{benevole.nom}}, {{course.nom}}, {{course.lieu}}, {{date}}",
      }),
    ],
    content: `
<p>Bonjour {{benevole.prenom}},</p>
<p>Merci pour votre proposition d'aide sur <strong>{{course.nom}}</strong> ({{course.lieu}}).</p>
<p>Nous reviendrons vers vous prochainement avec l'organisation détaillée. Date : {{date}}</p>
<p>Sportivement,<br/>L'équipe Tickrace</p>`,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[180px] p-3 rounded-xl border border-neutral-200",
      },
    },
  });

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
  }, [userId]);

  // Filtrage client
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
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(needle);
    });
    return list;
  }, [rows, selectedCourseId, q]);

  function toggleAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.id)));
    }
  }
  function toggleOne(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  function exportCSV() {
    const headers = ["Date", "Épreuve", "Lieu", "Nom", "Prénom", "Email", "Téléphone", "Statut", "Message", "Notes internes"];
    const lines = [headers.join(";")];
    filtered.forEach((r) => {
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
  }

  async function sendEmails() {
    if (sending) return;
    if (selectedIds.size === 0) {
      setSendMsg({ type: "error", text: "Sélectionne au moins un bénévole." });
      return;
    }
    const html = editor?.getHTML() || "";
    if (!subject.trim() || !html.trim()) {
      setSendMsg({ type: "error", text: "Renseigne un objet et un message." });
      return;
    }

    try {
      setSending(true);
      setSendMsg(null);

      const { data, error } = await supabase.functions.invoke("organiser-send-volunteer-emails", {
        body: {
          benevoles_inscription_ids: Array.from(selectedIds),
          subject,
          html, // HTML avec variables; la fonction remplacera {{...}}
          // (optionnel) limite par course côté serveur si tu veux
          course_id: selectedCourseId !== "all" ? selectedCourseId : null,
        },
      });

      if (error) throw error;
      setSendMsg({ type: "success", text: `Email envoyé à ${data?.sent_count ?? selectedIds.size} bénévole(s).` });
      // on garde la sélection pour pouvoir renvoyer au besoin
    } catch (e) {
      console.error(e);
      setSendMsg({ type: "error", text: e?.message ?? "Échec de l’envoi des emails." });
    } finally {
      setSending(false);
      setTimeout(() => setSendMsg(null), 5000);
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

  // Exemple de “preview” variables pour le premier sélectionné
  const sample = filtered.find((r) => selectedIds.has(r.id));
  const sampleVars = {
    "benevole.prenom": sample?.benevole?.prenom ?? "Prénom",
    "benevole.nom": sample?.benevole?.nom ?? "Nom",
    "course.nom": sample?.course?.nom ?? "Course",
    "course.lieu": sample?.course?.lieu ?? "Lieu",
    date: new Date().toLocaleDateString("fr-FR"),
  };
  function previewText(s) {
    return Object.entries(sampleVars).reduce(
      (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, String(v)),
      s || ""
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Bénévoles</h1>
        <Link to="/mon-espace" className="text-sm text-neutral-600 hover:text-neutral-900 underline underline-offset-4">
          ← Retour à mon espace
        </Link>
      </div>

      {/* Filtres + Actions */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="inline-flex items-center gap-2">
              <span className="text-sm text-neutral-700">Épreuve</span>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="all">Toutes mes épreuves</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.nom} — {c.lieu}</option>
                ))}
              </select>
            </label>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Recherche (nom, email, tel, message...)"
              className="w-full sm:ml-auto rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
            <button
              onClick={exportCSV}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              Export CSV
            </button>
          </div>

          <div className="mt-3 flex items-center gap-3 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedIds.size === filtered.length && filtered.length > 0}
                onChange={toggleAll}
              />
              <span>Sélectionner tout ({filtered.length})</span>
            </label>
            <div className="text-neutral-600">
              Sélectionnés : <b>{selectedIds.size}</b>
            </div>
          </div>
        </div>

        {/* Composeur d’email (s’étend sur 2 colonnes à droite) */}
        <div className="lg:col-span-2 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Envoyer un email</h2>
            {sendMsg && (
              <div
                className={`text-sm px-2 py-1 rounded ${
                  sendMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {sendMsg.text}
              </div>
            )}
          </div>

          <div className="mt-3 grid gap-3">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Objet de l'email"
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />

            <Toolbar editor={editor} />
            <div className="mt-2">
              <EditorContent editor={editor} />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-neutral-700">Variables rapides :</span>
              {["{{benevole.prenom}}","{{benevole.nom}}","{{course.nom}}","{{course.lieu}}","{{date}}"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => editor?.chain().focus().insertContent(v).run()}
                  className="rounded-lg border border-neutral-300 px-2 py-1 hover:bg-neutral-50"
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Preview sur un échantillon */}
            <div className="mt-3 grid md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-neutral-200 p-3">
                <div className="text-xs text-neutral-500 mb-1">Aperçu (objet)</div>
                <div className="text-sm font-medium">{previewText(subject)}</div>
              </div>
              <div className="rounded-xl border border-neutral-200 p-3">
                <div className="text-xs text-neutral-500 mb-1">
                  Aperçu (extrait sur un bénévole sélectionné)
                </div>
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: previewText(editor?.getHTML() || "") }}
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-end">
              <button
                onClick={sendEmails}
                disabled={sending || selectedIds.size === 0}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                  sending || selectedIds.size === 0
                    ? "bg-neutral-400 cursor-not-allowed"
                    : "bg-orange-600 hover:brightness-110"
                }`}
              >
                {sending ? "Envoi…" : `Envoyer (${selectedIds.size})`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-700">
            <tr>
              <th className="text-left px-4 py-3 w-8">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll}
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
                <td className="px-4 py-6 text-neutral-600" colSpan={8}>Chargement…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-neutral-600" colSpan={8}>Aucune demande trouvée.</td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="odd:bg-neutral-50/40">
                  <td className="px-4 py-3 align-top">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                    />
                  </td>
                  <td className="px-4 py-3 align-top">{fmtDate(r.created_at)}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium">{r.course?.nom || "—"}</div>
                    <div className="text-xs text-neutral-600">{r.course?.lieu || "—"}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium">{r.benevole?.prenom} {r.benevole?.nom}</div>
                    <div className="text-xs text-neutral-600">#{r.benevole_id?.slice(0, 8)}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div>
                      {r.benevole?.email ? (
                        <a href={`mailto:${r.benevole.email}`} className="text-orange-700 hover:underline">
                          {r.benevole.email}
                        </a>
                      ) : "—"}
                    </div>
                    <div className="text-xs">
                      {r.benevole?.telephone ? (
                        <a href={`tel:${r.benevole.telephone}`} className="hover:underline">
                          {r.benevole.telephone}
                        </a>
                      ) : "—"}
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
                        if (val !== (r.notes_internes || "")) updateNotes(r.id, val);
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
        Astuce : personnalise tes emails avec les variables ci-dessus. L’envoi utilise Resend via une Edge Function.
      </div>
    </div>
  );
}

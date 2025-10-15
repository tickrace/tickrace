// src/pages/ListeInscriptions.jsx
// Tickrace – Page organisateur : liste, filtres, tri, sélection, email ciblé, panneau équipe, export CSV par format
// Dépendances : React, supabase-js v2, TailwindCSS, (optionnel) TipTap

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase"; // ← adapter si chemin différent

/* ===================== CONFIG EMAIL EDGE FUNCTION ===================== */
const EMAIL_FUNCTION_NAME = "organiser-send-emails"; // { subject, html, to: string[] }

/* ---------------------- UI helpers ---------------------- */
function Badge({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-neutral-100 text-neutral-700",
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    blue: "bg-blue-100 text-blue-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
  );
}
function Button({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-neutral-50 active:translate-y-px ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 ${className}`}
      {...props}
    />
  );
}
function Select({ className = "", ...props }) {
  return (
    <select
      className={`w-full appearance-none rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 ${className}`}
      {...props}
    />
  );
}
function Modal({ open, onClose, title, children, footer, widthClass = "max-w-2xl" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={`relative z-10 w-full ${widthClass} rounded-2xl bg-white p-4 shadow-2xl`}>
        <div className="mb-3 flex items-center justify-between border-b pb-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-neutral-100" aria-label="fermer">✕</button>
        </div>
        <div className="max-h-[70vh] overflow-auto pr-1">{children}</div>
        {footer && <div className="mt-4 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
function SidePanel({ open, onClose, title, children }) {
  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/30 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <div className={`absolute right-0 top-0 h-full w-full max-w-xl transform rounded-l-2xl bg-white shadow-2xl transition-transform ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-neutral-100" aria-label="fermer">✕</button>
        </div>
        <div className="h-[calc(100%-56px)] overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------------------- Utils ---------------------- */
const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
};
const dedupe = (arr) => Array.from(new Set(arr.filter(Boolean)));
function csvEscape(val) {
    const s = String(val ?? "");
    const needsQuote = s.includes('"') || s.includes(',') || s.includes('
');
    if (needsQuote) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

/* ---------------------- TipTap lazy (fallback textarea) ---------------------- */
function useTipTap() {
  const [Editor, setEditor] = useState(null);
  const [EditorContent, setEditorContent] = useState(null);
  const [StarterKit, setStarterKit] = useState(null);
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [{ Editor }, { EditorContent }, StarterKit] = await Promise.all([
          import("@tiptap/react"),
          import("@tiptap/react"),
          import("@tiptap/starter-kit").then((m) => m.default),
        ]);
        if (!mounted) return;
        setEditor(() => Editor); setEditorContent(() => EditorContent); setStarterKit(() => StarterKit); setIsReady(true);
      } catch { setIsReady(false); }
    })();
    return () => { mounted = false; };
  }, []);
  return { Editor, EditorContent, StarterKit, isReady };
}
function EmailEditor({ value, onChange }) {
  const { Editor, EditorContent, StarterKit, isReady } = useTipTap();
  const editorRef = useRef(null);
  useEffect(() => {
    if (!isReady || !Editor || !StarterKit) return;
    const instance = new Editor({
      extensions: [StarterKit],
      content: value || "",
      editorProps: { attributes: { class: "prose max-w-none focus:outline-none" } },
      onUpdate({ editor }) { onChange?.(editor.getHTML()); },
    });
    editorRef.current = instance;
    return () => instance?.destroy();
  }, [isReady, Editor, StarterKit, onChange, value]);
  if (!isReady) {
    return (
      <textarea className="h-64 w-full rounded-xl border border-neutral-200 p-3 text-sm" defaultValue={value} onChange={(e) => onChange?.(e.target.value)} placeholder="Votre message (HTML ou texte)" />
    );
  }
  return <EditorContent editor={editorRef.current} />;
}

/* ---------------------- Page principale ---------------------- */
export default function ListeInscriptions({ courseId = null }) {
  // Filtres & tri
  const [formatId, setFormatId] = useState("");
  const [statutInscription, setStatutInscription] = useState("");
  const [statutGroupe, setStatutGroupe] = useState("");
  const [search, setSearch] = useState("");
  const [onlyCompleteTeams, setOnlyCompleteTeams] = useState(false);
  const [orderBy, setOrderBy] = useState({ column: "created_at", ascending: false });

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  // Données
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Enrichissements
  const [groupsById, setGroupsById] = useState({});
  const [formatsById, setFormatsById] = useState({});
  const [formatsList, setFormatsList] = useState([]); // formats de la course
  const [optionsByInscrId, setOptionsByInscrId] = useState({});

  // Sélection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Email modal
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailHtml, setEmailHtml] = useState("<p>Bonjour,</p><p>…</p>");
  const [emailSending, setEmailSending] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState("");

  // Export modal
  const [exportOpen, setExportOpen] = useState(false);

  // Panneau équipe
  const [teamPanelOpen, setTeamPanelOpen] = useState(false);
  const [teamPanelGroupId, setTeamPanelGroupId] = useState(null);
  const [teamPanelMembers, setTeamPanelMembers] = useState([]);
  const [teamPanelGroup, setTeamPanelGroup] = useState(null);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [formatId, statutInscription, statutGroupe, search, onlyCompleteTeams, pageSize, orderBy]);

  // Charger formats pour la course
  useEffect(() => { (async () => {
    try {
      if (!courseId) { setFormatsList([]); return; }
      const { data, error } = await supabase
        .from("formats")
        .select("id, nom, distance_km, denivele_dplus, course_id")
        .eq("course_id", courseId)
        .order("nom", { ascending: true });
      if (error) throw error;
      setFormatsList(data || []);
      const map = {}; (data || []).forEach((f) => (map[f.id] = f));
      setFormatsById((prev) => ({ ...prev, ...map }));
    } catch (e) { console.error(e); }
  })(); }, [courseId]);

  // Chargement principal
  useEffect(() => { fetchPage(); }, [page, formatId, statutInscription, search, orderBy, pageSize, courseId]);

  async function fetchPage() {
    setLoading(true); setError("");
    try {
      let query = supabase
        .from("inscriptions")
        .select("id, created_at, nom, prenom, email, format_id, statut, member_of_group_id, team_name, dossard, is_waitlist, course_id", { count: "exact" });
      if (courseId) query = query.eq("course_id", courseId);
      if (formatId) query = query.eq("format_id", formatId);
      if (statutInscription) query = query.eq("statut", statutInscription);
      if (search) {
        const s = `%${search}%`;
        query = query.or(`email.ilike.${s},nom.ilike.${s},prenom.ilike.${s},team_name.ilike.${s}`);
      }
      query = query.order(orderBy.column, { ascending: orderBy.ascending, nullsFirst: false });
      const from = (page - 1) * pageSize; const to = from + pageSize - 1; query = query.range(from, to);
      const { data: inscriptions, count, error: e1 } = await query; if (e1) throw e1;
      setRows(inscriptions || []); setTotal(count || 0);

      const groupIds = dedupe((inscriptions || []).map((r) => r.member_of_group_id));
      if (groupIds.length) {
        const { data: groupes, error: e2 } = await supabase
          .from("inscriptions_groupes")
          .select("id, team_name, statut, team_category, team_size, members_count, format_id")
          .in("id", groupIds);
        if (e2) throw e2; const map = {}; (groupes || []).forEach((g) => (map[g.id] = g)); setGroupsById(map);
      } else { setGroupsById({}); }

      const formatIds = dedupe((inscriptions || []).map((r) => r.format_id));
      if (formatIds.length) {
        const { data: formats, error: e3 } = await supabase
          .from("formats").select("id, nom, distance_km, denivele_dplus").in("id", formatIds);
        if (e3) throw e3; const map = {}; (formats || []).forEach((f) => (map[f.id] = f)); setFormatsById((prev) => ({ ...prev, ...map }));
      }

      const inscrIds = dedupe((inscriptions || []).map((r) => r.id));
      if (inscrIds.length) {
        const { data: opts, error: e4 } = await supabase
          .from("inscriptions_options").select("id, inscription_id, option_id, quantity, prix_unitaire_cents, status")
          .eq("status", "confirmed").in("inscription_id", inscrIds);
        if (e4) throw e4; const byInscr = {}; (opts || []).forEach((o) => { (byInscr[o.inscription_id] ||= []).push(o); }); setOptionsByInscrId(byInscr);
      } else { setOptionsByInscrId({}); }
    } catch (e) { console.error(e); setError(e.message || "Erreur inconnue"); } finally { setLoading(false); }
  }

  const filteredRows = useMemo(() => {
    let list = rows;
    if (onlyCompleteTeams) {
      list = list.filter((r) => {
        const g = r.member_of_group_id ? groupsById[r.member_of_group_id] : null;
        if (!g) return false; return (g.members_count || 0) >= (g.team_size || 0);
      });
    }
    if (statutGroupe) {
      list = list.filter((r) => {
        if (!r.member_of_group_id) return false; const g = groupsById[r.member_of_group_id]; return g && g.statut === statutGroupe;
      });
    }
    return list;
  }, [rows, onlyCompleteTeams, groupsById, statutGroupe]);

  const allSelectedOnPage = useMemo(() => filteredRows.length > 0 && filteredRows.every((r) => selectedIds.has(r.id)), [filteredRows, selectedIds]);
  function toggleRow(id) { setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  function toggleAllOnPage() {
    if (allSelectedOnPage) setSelectedIds((prev) => { const next = new Set(prev); filteredRows.forEach((r) => next.delete(r.id)); return next; });
    else setSelectedIds((prev) => { const next = new Set(prev); filteredRows.forEach((r) => next.add(r.id)); return next; });
  }

  const selectedRows = filteredRows.filter((r) => selectedIds.has(r.id));
  const audienceEmails = useMemo(() => dedupe(selectedRows.map((r) => r.email)), [selectedRows]);

  async function sendEmail() {
    setEmailSending(true); setEmailFeedback("");
    try {
      if (!emailSubject.trim()) throw new Error("Sujet requis");
      const to = audienceEmails; if (!to.length) throw new Error("Aucun destinataire sélectionné");
      const { error } = await supabase.functions.invoke(EMAIL_FUNCTION_NAME, { body: { subject: emailSubject, html: emailHtml, to } });
      if (error) throw error; setEmailFeedback(`Email envoyé à ${to.length} destinataire(s).`); setEmailOpen(false);
    } catch (e) { setEmailFeedback(e.message || "Échec envoi"); } finally { setEmailSending(false); }
  }

  function statutBadge(s) {
    if (!s) return <Badge>—</Badge>;
    const map = { en_attente: { label: "en attente", tone: "amber" }, "en attente": { label: "en attente", tone: "amber" }, pending: { label: "en attente", tone: "amber" }, paye: { label: "payé", tone: "green" }, "payé": { label: "payé", tone: "green" }, annule: { label: "annulé", tone: "rose" }, "annulé": { label: "annulé", tone: "rose" } };
    const m = map[s] || { label: s, tone: "slate" }; return <Badge tone={m.tone}>{m.label}</Badge>;
  }
  function optionsSummary(inscriptionId) {
    const list = optionsByInscrId[inscriptionId] || []; if (!list.length) return <span className="text-neutral-400">—</span>;
    const txt = list.map((o) => `#${String(o.option_id).slice(0, 6)} x${o.quantity}`).join(", "); return <span>{txt}</span>;
  }
  function formatLabel(id) {
    const f = formatsById[id]; if (!f) return "—"; const parts = [f.nom].filter(Boolean); if (f.distance_km) parts.push(`${f.distance_km} km`); if (f.denivele_dplus) parts.push(`+${f.denivele_dplus} m`); return parts.join(" · ");
  }
  function openTeamPanel(groupId) { setTeamPanelGroupId(groupId); setTeamPanelOpen(true); loadTeamPanel(groupId); }
  async function loadTeamPanel(groupId) {
    try {
      if (!groupId) return;
      const [{ data: grp }, { data: members }] = await Promise.all([
        supabase.from("inscriptions_groupes").select("id, team_name, statut, team_category, team_size, members_count, format_id").eq("id", groupId).maybeSingle(),
        supabase.from("inscriptions").select("id, nom, prenom, email, statut, dossard, created_at").eq("member_of_group_id", groupId).order("created_at", { ascending: true }),
      ]);
      setTeamPanelGroup(grp || null); setTeamPanelMembers(members || []);
    } catch (e) { console.error(e); }
  }
  function teamCell(row) {
    if (!row.member_of_group_id) return <span className="text-neutral-400">—</span>;
    const g = groupsById[row.member_of_group_id]; if (!g) return (
      <button className="text-blue-600 underline-offset-2 hover:underline" onClick={() => openTeamPanel(row.member_of_group_id)}>{row.team_name || "Équipe"} →</button>
    );
    const isComplete = (g.members_count || 0) >= (g.team_size || 0);
    return (
      <div className="flex flex-col">
        <button className="text-left font-medium text-blue-600 underline-offset-2 hover:underline" onClick={() => openTeamPanel(row.member_of_group_id)}>
          {g.team_name || row.team_name || "Équipe"} →
        </button>
        <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
          <span>{g.team_category || "—"}</span><span>•</span>
          <span>{g.members_count || 0}/{g.team_size || 0} {isComplete ? "(complet)" : "(incomplet)"}</span>
        </div>
        <div className="mt-1">{statutBadge(g.statut)}</div>
      </div>
    );
  }

  async function exportCSVForFormat(fId) {
    try {
      let q = supabase.from("inscriptions").select("id, created_at, nom, prenom, email, format_id, statut, member_of_group_id, team_name, dossard, is_waitlist, course_id").eq("format_id", fId);
      if (courseId) q = q.eq("course_id", courseId);
      if (statutInscription) q = q.eq("statut", statutInscription);
      if (search) { const s = `%${search}%`; q = q.or(`email.ilike.${s},nom.ilike.${s},prenom.ilike.${s},team_name.ilike.${s}`); }
      const { data: allInscr, error } = await q.order("created_at", { ascending: false }); if (error) throw error;
      const groupIds = dedupe((allInscr || []).map((r) => r.member_of_group_id));
      let groupsMap = {}; if (groupIds.length) { const { data: gs } = await supabase.from("inscriptions_groupes").select("id, team_name, statut, team_category, team_size, members_count").in("id", groupIds); (gs || []).forEach((g) => (groupsMap[g.id] = g)); }
      const inscrIds = dedupe((allInscr || []).map((r) => r.id)); let optionsMap = {};
      if (inscrIds.length) { const { data: opts } = await supabase.from("inscriptions_options").select("inscription_id, option_id, quantity, prix_unitaire_cents, status").eq("status", "confirmed").in("inscription_id", inscrIds); (opts || []).forEach((o) => { (optionsMap[o.inscription_id] ||= []).push(o); }); }
      const f = formatsById[fId] || formatsList.find((x) => x.id === fId) || {};
      const headers = ["nom","prenom","email","format","team_name","groupe_statut","groupe_categorie","groupe_members","inscription_statut","created_at","dossard","is_waitlist","options"];
      const rowsCsv = (allInscr || []).map((r) => {
        const g = r.member_of_group_id ? groupsMap[r.member_of_group_id] : null;
        const opts = (optionsMap[r.id] || []).map((o) => `#${String(o.option_id).slice(0, 6)} x${o.quantity}`).join(" | ");
        const formatText = f?.nom ? `${f.nom}${f.distance_km ? ` ${f.distance_km}km` : ''}${f.denivele_dplus ? ` +${f.denivele_dplus}m` : ''}` : String(r.format_id);
        return [ r.nom || "", r.prenom || "", r.email || "", formatText, (g?.team_name || r.team_name || ""), (g?.statut || ""), (g?.team_category || ""), g ? `${g.members_count || 0}/${g.team_size || 0}` : "", r.statut || "", r.created_at || "", r.dossard ?? "", r.is_waitlist ? "1" : "0", opts ];
      });
      const csv = [headers.join(","), ...rowsCsv.map((arr) => arr.map(csvEscape).join(","))].join("
");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url;
      a.download = `inscriptions_${(f?.nom || fId).toString().replace(/[^a-z0-9_-]+/gi, "_")}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (e) { console.error("exportCSVForFormat", e); alert("Export CSV échoué : " + (e.message || e)); }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const selectedCount = selectedIds.size;
  const exportableFormats = useMemo(() => {
    if (formatId) { const f = formatsById[formatId] || formatsList.find((x) => x.id === formatId); return f ? [f] : []; }
    return formatsList;
  }, [formatId, formatsById, formatsList]);

  return (
    <div className="mx-auto max-w-7xl p-4">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 mb-4 rounded-2xl border border-neutral-200 bg-white/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm text-neutral-600"><span className="font-medium">{selectedCount}</span> sélectionné(s)</div>
          <Button onClick={() => setEmailOpen(true)} disabled={!selectedCount}>📧 Email</Button>
          <Button onClick={() => setExportOpen(true)} disabled={exportableFormats.length === 0}>⬇️ Export CSV</Button>
          <div className="mx-2 h-6 w-px bg-neutral-200" />
          <div className="flex items-center gap-2">
            <Input placeholder="Recherche : nom, prénom, email, équipe" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 260 }} />
            <Select value={formatId} onChange={(e) => setFormatId(e.target.value)} style={{ minWidth: 220 }}>
              <option value="">Tous formats (course)</option>
              {formatsList.map((f) => (
                <option key={f.id} value={f.id}>{f.nom}{f.distance_km ? ` • ${f.distance_km}km` : ''}{f.denivele_dplus ? ` • +${f.denivele_dplus}m` : ''}</option>
              ))}
            </Select>
            <Select value={statutInscription} onChange={(e) => setStatutInscription(e.target.value)}>
              <option value="">Statut (inscription)</option>
              <option value="en_attente">en attente</option>
              <option value="paye">payé</option>
              <option value="annule">annulé</option>
            </Select>
            <Select value={statutGroupe} onChange={(e) => setStatutGroupe(e.target.value)}>
              <option value="">Statut (groupe)</option>
              <option value="en_attente">en attente</option>
              <option value="paye">payé</option>
              <option value="annule">annulé</option>
            </Select>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="rounded" checked={onlyCompleteTeams} onChange={(e) => setOnlyCompleteTeams(e.target.checked)} />Uniquement équipes complètes</label>
          </div>
          <div className="mx-2 h-6 w-px bg-neutral-200" />
          <div className="flex items-center gap-2">
            <Select value={`${orderBy.column}:${orderBy.ascending ? "asc" : "desc"}`} onChange={(e) => { const [col, dir] = e.target.value.split(":"); setOrderBy({ column: col, ascending: dir === "asc" }); }}>
              <option value="created_at:desc">Tri : Date ↓</option>
              <option value="created_at:asc">Tri : Date ↑</option>
              <option value="nom:asc">Tri : Nom A→Z</option>
              <option value="nom:desc">Tri : Nom Z→A</option>
              <option value="statut:asc">Tri : Statut A→Z</option>
              <option value="statut:desc">Tri : Statut Z→A</option>
            </Select>
            <Select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-600">
            <tr>
              <th className="p-3"><input type="checkbox" checked={allSelectedOnPage} onChange={toggleAllOnPage} /></th>
              <th className="p-3">Nom</th>
              <th className="p-3">Prénom</th>
              <th className="p-3">Email</th>
              <th className="p-3">Format</th>
              <th className="p-3">Équipe</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Date</th>
              <th className="p-3">Options</th>
              <th className="p-3"># Dossard</th>
            </tr>
          </thead>
          <tbody>
            {loading && (<tr><td colSpan={10} className="p-6 text-center text-neutral-500">Chargement…</td></tr>)}
            {!loading && filteredRows.length === 0 && (<tr><td colSpan={10} className="p-8 text-center text-neutral-400">Aucune inscription.</td></tr>)}
            {!loading && filteredRows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 align-top"><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleRow(r.id)} /></td>
                <td className="p-3 align-top font-medium">{r.nom || "—"}</td>
                <td className="p-3 align-top">{r.prenom || "—"}</td>
                <td className="p-3 align-top"><a href={`mailto:${r.email}`} className="text-blue-600 hover:underline">{r.email || "—"}</a></td>
                <td className="p-3 align-top">{formatLabel(r.format_id)}</td>
                <td className="p-3 align-top">{teamCell(r)}</td>
                <td className="p-3 align-top"><div className="flex flex-col gap-1">{statutBadge(r.statut)}{r.is_waitlist ? <Badge tone="blue">liste d'attente</Badge> : null}</div></td>
                <td className="p-3 align-top text-neutral-600">{fmtDate(r.created_at)}</td>
                <td className="p-3 align-top">{optionsSummary(r.id)}</td>
                <td className="p-3 align-top">{r.dossard ?? <span className="text-neutral-400">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="text-neutral-600">{total} résultat(s) • Page {page}/{totalPages}</div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setPage(1)} disabled={page === 1}>⏮ Première</Button>
          <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>◀ Précédent</Button>
          <Button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Suivant ▶</Button>
          <Button onClick={() => setPage(totalPages)} disabled={page === totalPages}>Dernière ⏭</Button>
        </div>
      </div>

      {/* Erreur */}
      {error && (<div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-rose-700">{error}</div>)}

      {/* Modal Email */}
      <Modal open={emailOpen} onClose={() => setEmailOpen(false)} title={`Envoyer un email (${audienceEmails.length} destinataire${audienceEmails.length > 1 ? "s" : ""})`}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-600">Sujet</label>
            <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Objet du message" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-600">Message</label>
            <div className="rounded-xl border border-neutral-200 p-2"><EmailEditor value={emailHtml} onChange={setEmailHtml} /></div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-600">Aperçu (HTML brut)</label>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm"><div dangerouslySetInnerHTML={{ __html: emailHtml }} /></div>
          </div>
          <div className="text-xs text-neutral-500">Les emails seront envoyés à : {audienceEmails.slice(0, 5).join(", ")}{audienceEmails.length > 5 ? `, +${audienceEmails.length - 5}…` : ""}</div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button onClick={() => setEmailOpen(false)} className="border-neutral-300">Annuler</Button>
          <Button onClick={sendEmail} disabled={emailSending || audienceEmails.length === 0} className="bg-orange-500 text-white hover:bg-orange-600">{emailSending ? "Envoi…" : "Envoyer"}</Button>
        </div>
        {emailFeedback && <div className="mt-3 text-sm text-neutral-600">{emailFeedback}</div>}
      </Modal>

      {/* Modal Export CSV */}
      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="Exporter en CSV" widthClass="max-w-xl">
        <p className="text-sm text-neutral-600">Choisissez un format à exporter. Les filtres de recherche et de statut (inscription) seront appliqués à l'export.</p>
        <div className="mt-3 grid gap-2">
          {exportableFormats.length === 0 && (<div className="rounded-xl border border-neutral-200 p-3 text-sm text-neutral-500">Aucun format disponible.</div>)}
          {exportableFormats.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-xl border border-neutral-200 p-3">
              <div className="text-sm">
                <div className="font-medium">{f.nom}</div>
                <div className="text-neutral-500">{[f.distance_km && `${f.distance_km} km`, f.denivele_dplus && `+${f.denivele_dplus} m`].filter(Boolean).join(" · ")}</div>
              </div>
              <Button onClick={() => exportCSVForFormat(f.id)} className="bg-orange-50 hover:bg-orange-100">Exporter CSV</Button>
            </div>
          ))}
        </div>
      </Modal>

      {/* Panneau latéral équipe */}
      <SidePanel open={teamPanelOpen} onClose={() => setTeamPanelOpen(false)} title={teamPanelGroup?.team_name || "Équipe"}>
        {!teamPanelGroup && (<div className="text-sm text-neutral-500">Chargement…</div>)}
        {teamPanelGroup && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-neutral-500">Statut</div><div>{statutBadge(teamPanelGroup.statut)}</div></div>
              <div><div className="text-neutral-500">Catégorie</div><div>{teamPanelGroup.team_category || "—"}</div></div>
              <div><div className="text-neutral-500">Taille</div><div>{teamPanelGroup.members_count || 0}/{teamPanelGroup.team_size || 0}</div></div>
              <div><div className="text-neutral-500">Format</div><div>{formatLabel(teamPanelGroup.format_id)}</div></div>
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold">Membres</div>
              <div className="overflow-hidden rounded-xl border">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-600">
                    <tr>
                      <th className="p-2">Nom</th>
                      <th className="p-2">Prénom</th>
                      <th className="p-2">Email</th>
                      <th className="p-2">Statut</th>
                      <th className="p-2">Dossard</th>
                      <th className="p-2">Inscrit le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamPanelMembers.map((m) => (
                      <tr key={m.id} className="border-t">
                        <td className="p-2">{m.nom || "—"}</td>
                        <td className="p-2">{m.prenom || "—"}</td>
                        <td className="p-2"><a href={`mailto:${m.email}`} className="text-blue-600 hover:underline">{m.email || "—"}</a></td>
                        <td className="p-2">{statutBadge(m.statut)}</td>
                        <td className="p-2">{m.dossard ?? "—"}</td>
                        <td className="p-2">{fmtDate(m.created_at)}</td>
                      </tr>
                    ))}
                    {teamPanelMembers.length === 0 && (<tr><td colSpan={6} className="p-3 text-center text-neutral-500">Aucun membre.</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </SidePanel>

      <div className="mt-8 text-xs text-neutral-400">
        NB : le sélecteur de formats se base sur <code>courseId</code>. Pour un mode multi-courses, requêter tous les formats où <code>courses.organisateur_id = auth.uid()</code>.
      </div>
    </div>
  );
}

/*
===========================
SUGGESTIONS D'INDEX SQL
===========================
create index if not exists idx_inscriptions_course_id on public.inscriptions(course_id);
create index if not exists idx_inscriptions_format_id on public.inscriptions(format_id);
create index if not exists idx_inscriptions_member_group on public.inscriptions(member_of_group_id);
create index if not exists idx_inscriptions_email on public.inscriptions(email);
create index if not exists idx_inscriptions_statut on public.inscriptions(statut);
create index if not exists idx_inscriptions_created_at on public.inscriptions(created_at desc);
create index if not exists idx_inscr_groupes_statut on public.inscriptions_groupes(statut);
create index if not exists idx_inscr_groupes_team_name on public.inscriptions_groupes(team_name);
create index if not exists idx_inscriptions_options_inscription_id on public.inscriptions_options(inscription_id);
create index if not exists idx_inscriptions_options_status on public.inscriptions_options(status);

===========================
POLICIES (exemple indicatif)
===========================
-- L'organisateur peut lire les inscriptions des formats de ses courses
-- (courses.organisateur_id -> formats.course_id -> inscriptions.format_id)
-- create policy "read organiser inscriptions" on public.inscriptions for select to authenticated using (
--   exists (
--     select 1 from public.formats f join public.courses c on c.id = f.course_id
--     where f.id = inscriptions.format_id and c.organisateur_id = auth.uid()
--   )
-- );
*/

// EOF

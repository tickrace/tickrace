// src/pages/ListeInscriptions.jsx
// Tickrace – Page organisateur : liste, filtres, tri, sélection, email ciblé, panneau équipe, export CSV par format
// Dépendances :
// - React, supabase-js v2, TailwindCSS
// - (optionnel) TipTap pour l'éditeur riche. Fallback automatique en <textarea> si non dispo.
// - (optionnel) dayjs pour le formatage de date (fallback simple inclus)
//
// Hypothèses RLS : l'utilisateur organisateur a le droit SELECT sur inscriptions / inscriptions_groupes / inscriptions_options
// pour les formats/courses dont il est propriétaire.
//
// Edge Function email : renommer ici si besoin.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase"; // ← adapter l'import selon votre projet

/* ===================== CONFIG EMAIL EDGE FUNCTION ===================== */
const EMAIL_FUNCTION_NAME = "organiser-send-emails"; // ← adapte si nom différent
// Contrat attendu : { subject, html, to: string[] }

/* ---------------------- UI helpers minimalistes ---------------------- */
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

/* ---------------------- Utilitaires ---------------------- */
const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch (e) {
    return iso;
  }
};

const dedupe = (arr) => Array.from(new Set(arr.filter(Boolean)));

/* ---------------------- TipTap (lazy) + Fallback ---------------------- */
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
        setEditor(() => Editor);
        setEditorContent(() => EditorContent);
        setStarterKit(() => StarterKit);
        setIsReady(true);
      } catch (e) {
        setIsReady(false);
      }
    })();
    return () => {
      mounted = false;
    };
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
      editorProps: {
        attributes: { class: "prose max-w-none focus:outline-none" },
      },
      onUpdate({ editor }) {
        onChange?.(editor.getHTML());
      },
    });
    editorRef.current = instance;
    return () => instance?.destroy();
  }, [isReady, Editor, StarterKit]);

  if (!isReady) {
    // Fallback simple
    return (
      <textarea
        className="h-64 w-full rounded-xl border border-neutral-200 p-3 text-sm"
        defaultValue={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="Votre message (HTML ou texte)"
      />
    );
  }

  return <EditorContent editor={editorRef.current} />;
}

/* ---------------------- Panneau latéral (détails d'équipe) ---------------------- */
function SidePanel({ open, onClose, title, children }) {
  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}>
      {/* Overlay */}
      <div className={`absolute inset-0 bg-black/30 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      {/* Panel */}
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

/* ---------------------- Composant principal ---------------------- */
export default function ListeInscriptions({ courseId = null }) {
  // Filtres & tri
  const [formatId, setFormatId] = useState("");
  const [statutInscription, setStatutInscription] = useState(""); // en_attente | paye | annule | ""
  const [statutGroupe, setStatutGroupe] = useState(""); // idem pour groupe
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
  const [formatsList, setFormatsList] = useState([]); // ← formats de l'organisateur (par course)
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

  // Charger les formats (sélecteur organisateur) pour la course courante
  useEffect(() => { loadFormatsForCourse(); }, [courseId]);
  async function loadFormatsForCourse() {
    try {
      if (!courseId) { setFormatsList([]); return; }
      const { data, error } = await supabase
        .from("formats")
        .select("id, nom, distance_km, denivele_dplus, course_id")
        .eq("course_id", courseId)
        .order("nom", { ascending: true });
      if (error) throw error;
      setFormatsList(data || []);
      // garder aussi une map pour affichage label
      const map = {};
      (data || []).forEach((f) => (map[f.id] = f));
      setFormatsById((prev) => ({ ...prev, ...map }));
    } catch (e) {
      console.error("loadFormatsForCourse", e);
    }
  }

  // Chargement principal
  useEffect(() => { fetchPage(); }, [page, formatId, statutInscription, search, orderBy, pageSize, courseId]);

  async function fetchPage() {
    setLoading(true);
    setError("");
    try {
      // 1) Query inscriptions paginées
      let query = supabase
        .from("inscriptions")
        .select(
          "id, created_at, nom, prenom, email, format_id, statut, member_of_group_id, team_name, dossard, is_waitlist, course_id",
          { count: "exact" }
        );

      if (courseId) query = query.eq("course_id", courseId);
      if (formatId) query = query.eq("format_id", formatId);
      if (statutInscription) query = query.eq("statut", statutInscription);

      if (search) {
        const s = `%${search}%`;
        query = query.or(`email.ilike.${s},nom.ilike.${s},prenom.ilike.${s},team_name.ilike.${s}`);
      }

      // Tri & pagination
      query = query.order(orderBy.column, { ascending: orderBy.ascending, nullsFirst: false });
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data: inscriptions, count, error: e1 } = await query;
      if (e1) throw e1;
      setRows(inscriptions || []);
      setTotal(count || 0);

      // 2) Charger groupes si besoin
      const groupIds = dedupe((inscriptions || []).map((r) => r.member_of_group_id));
      if (groupIds.length) {
        const { data: groupes, error: e2 } = await supabase
          .from("inscriptions_groupes")
          .select("id, team_name, statut, team_category, team_size, members_count")
          .in("id", groupIds);
        if (e2) throw e2;
        const map = {};
        (groupes || []).forEach((g) => (map[g.id] = g));
        setGroupsById(map);
      } else {
        setGroupsById({});
      }

      // 3) Charger formats affichés (nom du format)
      const formatIds = dedupe((inscriptions || []).map((r) => r.format_id));
      if (formatIds.length) {
        const { data: formats, error: e3 } = await supabase
          .from("formats")
          .select("id, nom, distance_km, denivele_dplus")
          .in("id", formatIds);
        if (e3) throw e3;
        const map = {};
        (formats || []).forEach((f) => (map[f.id] = f));
        setFormatsById((prev) => ({ ...prev, ...map }));
      }

      // 4) Options confirmées par inscription
      const inscrIds = dedupe((inscriptions || []).map((r) => r.id));
      if (inscrIds.length) {
        const { data: opts, error: e4 } = await supabase
          .from("inscriptions_options")
          .select("id, inscription_id, option_id, quantity, prix_unitaire_cents, status")
          .eq("status", "confirmed")
          .in("inscription_id", inscrIds);
        if (e4) throw e4;
        const byInscr = {};
        (opts || []).forEach((o) => {
          if (!byInscr[o.inscription_id]) byInscr[o.inscription_id] = [];
          byInscr[o.inscription_id].push(o);
        });
        setOptionsByInscrId(byInscr);
      } else {
        setOptionsByInscrId({});
      }
    } catch (e) {
      console.error(e);
      setError(e.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  // Filtre client pour équipes complètes (limité à la page courante)
  const filteredRows = useMemo(() => {
    let list = rows;
    if (onlyCompleteTeams) {
      list = list.filter((r) => {
        const g = r.member_of_group_id ? groupsById[r.member_of_group_id] : null;
        if (!g) return false; // si activé, n'affiche que les membres d'équipes connues
        return (g.members_count || 0) >= (g.team_size || 0);
      });
    }
    if (statutGroupe) {
      list = list.filter((r) => {
        if (!r.member_of_group_id) return false;
        const g = groupsById[r.member_of_group_id];
        return g && g.statut === statutGroupe;
      });
    }
    return list;
  }, [rows, onlyCompleteTeams, groupsById, statutGroupe]);

  // Sélection helpers
  function toggleRow(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelectedOnPage = useMemo(() => filteredRows.length > 0 && filteredRows.every((r) => selectedIds.has(r.id)), [filteredRows, selectedIds]);

  function toggleAllOnPage() {
    if (allSelectedOnPage) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredRows.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredRows.forEach((r) => next.add(r.id));
        return next;
      });
    }
  }

  const selectedCount = selectedIds.size;

  // Audience emails
  const selectedRows = filteredRows.filter((r) => selectedIds.has(r.id));
  const audienceEmails = useMemo(() => dedupe(selectedRows.map((r) => r.email)), [selectedRows]);

  // Envoi email (Edge Function)
  async function sendEmail() {
    setEmailSending(true);
    setEmailFeedback("");
    try {
      if (!emailSubject.trim()) throw new Error("Sujet requis");
      const to = audienceEmails;
      if (!to.length) throw new Error("Aucun destinataire sélectionné");

      const { error } = await supabase.functions.invoke(EMAIL_FUNCTION_NAME, {
        body: { subject: emailSubject, html: emailHtml, to },
      });
      if (error) throw error;
      setEmailFeedback(`Email envoyé à ${to.length} destinataire(s).`);
      setEmailOpen(false);
    } catch (e) {
      setEmailFeedback(e.message || "Échec envoi");
    } finally {
      setEmailSending(false);
    }
  }

  // Helpers rendu
  function statutBadge(s) {
    if (!s) return <Badge>—</Badge>;
    const map = {
      en_attente: { label: "en attente", tone: "amber" },
      "en attente": { label: "en attente", tone: "amber" },
      pending: { label: "en attente", tone: "amber" },
      paye: { label: "payé", tone: "green" },
      "payé": { label: "payé", tone: "green" },
      annule: { label: "annulé", tone: "rose" },
      "annulé": { label: "annulé", tone: "rose" },
    };
    const m = map[s] || { label: s, tone: "slate" };
    return <Badge tone={m.tone}>{m.label}</Badge>;
  }

  function optionsSummary(inscriptionId) {
    const list = optionsByInscrId[inscriptionId] || [];
    if (!list.length) return <span className="text-neutral-400">—</span>;
    const txt = list
      .map((o) => `#${String(o.option_id).slice(0, 6)} x${o.quantity}`)
      .join(", ");
    return <span>{txt}</span>;
  }

  function formatLabel(id) {
    const f = formatsById[id];
    if (!f) return "—";
    const parts = [f.nom].filter(Boolean);
    if (f.distance_km) parts.push(`${f.distance_km} km`);
    if (f.denivele_dplus) parts.push(`+${f.denivele_dplus} m`);
    return parts.join(" · ");
  }

  function openTeamPanel(groupId) {
    setTeamPanelGroupId(groupId);
    setTeamPanelOpen(true);
    loadTeamPanel(groupId);
  }

  async function loadTeamPanel(groupId) {
    try {
      if (!groupId) return;
      const [{ data: grp }, { data: members }] = await Promise.all([
        supabase.from("inscriptions_groupes").select("id, team_name, statut, team_category, team_size, members_count, format_id").eq("id", groupId).maybeSingle(),
        supabase.from("inscriptions").select("id, nom, prenom, email, statut, dossard, created_at").eq("member_of_group_id", groupId).order("created_at", { ascending: true }),
      ]);
      setTeamPanelGroup(grp || null);
      setTeamPanelMembers(members || []);
    } catch (e) {
      console.error("loadTeamPanel", e);
    }
  }

  function teamCell(row) {
    if (!row.member_of_group_id) return <span className="text-neutral-400">—</span>;
    const g = groupsById[row.member_of_group_id];
    if (!g) return (
      <button className="text-blue-600 underline-offset-2 hover:underline" onClick={() => openTeamPanel(row.member_of_group_id)}>
        {row.team_name || "Équipe"} →
      </button>
    );
    const isComplete = (g.members_count || 0) >= (g.team_size || 0);
    return (
      <div className="flex flex-col">
        <button className="text-left font-medium text-blue-600 underline-offset-2 hover:underline" onClick={() => openTeamPanel(row.member_of_group_id)}>
          {g.team_name || row.team_name || "Équipe"} →
        </button>
        <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
          <span>{g.team_category || "—"}</span>
          <span>•</span>
          <span>
            {g.members_count || 0}/{g.team_size || 0} {isComplete ? "(complet)" : "(incomplet)"}
          </span>
        </div>
        <div className="mt-1">{statutBadge(g.statut)}</div>
      </div>
    );
  }

  // EXPORT CSV PAR FORMAT (respecte filtres search/statut sur l'ensemble du format)
  async function exportCSVForFormat(fId) {
    try {
      // Charger toutes les inscriptions correspondant au format + filtres
      let q = supabase
        .from("inscriptions")
        .select("id, created_at, nom, prenom, email, format_id, statut, member_of_group_id, team_name, dossard, is_waitlist, course_id")
        .eq("format_id", fId);
      if (courseId) q = q.eq("course_id", courseId);
      if (statutInscription) q = q.eq("statut", statutInscription);
      if (search) {
        const s = `%${search}%`;
        q = q.or(`email.ilike.${s},nom.ilike.${s},prenom.ilike.${s},team_name.ilike.${s}`);
      }

      const { data: allInscr, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      const groupIds = dedupe((allInscr || []).map((r) => r.member_of_group_id));

      let groupsMap = {};
      if (groupIds.length) {
        const { data: gs } = await supabase
          .from("inscriptions_groupes")
          .select("id, team_name, statut, team_category, team_size, members_count")
          .in("id", groupIds);
        (gs || []).forEach((g) => (groupsMap[g.id] = g));
      }

      const inscrIds = dedupe((allInscr || []).map((r) => r.id));
      let optionsMap = {};
      if (inscrIds.length) {
        const { data: opts } = await supabase
          .from("inscriptions_options")
          .select("inscription_id, option_id, quantity, prix_unitaire_cents, status")
          .eq("status", "confirmed")
          .in("inscription_id", inscrIds);
        (opts || []).forEach((o) => {
          if (!optionsMap[o.inscription_id]) optionsMap[o.inscription_id] = [];
          optionsMap[o.inscription_id].push(o);
        });
      }

      const f = formatsById[fId] || formatsList.find((x) => x.id === fId) || {};

      const headers = [
        "nom",
        "prenom",
        "email",
        "format",
        "team_name",
        "groupe_statut",
        "groupe_categorie",
        "groupe_members",
        "inscription_statut",
        "created_at",
        "dossard",
        "is_waitlist",
        "options",
      ];

      const rowsCsv = (allInscr || []).map((r) => {
        const g = r.member_of_group_id ? groupsMap[r.member_of_group_id] : null;
        const opts = (optionsMap[r.id] || [])
          .map((o) => `#${String(o.option_id).slice(0, 6)} x${o.quantity}`)
          .join(" | ");
        const formatText = f?.nom ? `${f.nom}${f.distance_km ? ` ${f.distance_km}km` : ''}${f.denivele_dplus ? ` +${f.denivele_dplus}m` : ''}` : String(r.format_id);
        return [
          r.nom || "",
          r.prenom || "",
          r.email || "",
          formatText,
          (g?.team_name || r.team_name || "") ,
          (g?.statut || ""),
          (g?.team_category || ""),
          g ? `${g.members_count || 0}/${g.team_size || 0}` : "",
          r.statut || "",
          r.created_at || "",
          r.dossard ?? "",
          r.is_waitlist ? "1" : "0",
          opts,
        ];
      });

      const csv = [headers.join(","), ...rowsCsv.map((arr) => arr.map(csvEscape).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inscriptions_${(f?.nom || fId).toString().replace(/[^a-z0-9_-]+/gi, "_")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("exportCSVForFormat", e);
      alert("Export CSV échoué : " + (e.message || e));
    }
  }

  function csvEscape(val) {
    const s = String(val ?? "");
    // Entoure de quotes si la valeur contient une virgule, un guillemet ou un saut de ligne
    if (/[",
]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

/*
===========================
SUGGESTIONS D'INDEX SQL
===========================

-- Inscriptions (recherche & filtres)
create index if not exists idx_inscriptions_course_id on public.inscriptions(course_id);
create index if not exists idx_inscriptions_format_id on public.inscriptions(format_id);
create index if not exists idx_inscriptions_member_group on public.inscriptions(member_of_group_id);
create index if not exists idx_inscriptions_email on public.inscriptions(email);
create index if not exists idx_inscriptions_statut on public.inscriptions(statut);
create index if not exists idx_inscriptions_created_at on public.inscriptions(created_at desc);

-- Groupes
create index if not exists idx_inscr_groupes_statut on public.inscriptions_groupes(statut);
create index if not exists idx_inscr_groupes_team_name on public.inscriptions_groupes(team_name);

-- Options
create index if not exists idx_inscriptions_options_inscription_id on public.inscriptions_options(inscription_id);
create index if not exists idx_inscriptions_options_status on public.inscriptions_options(status);

===========================
POLICIES (exemple indicatif)
===========================
-- L'organisateur peut lire les inscriptions des formats de ses courses
-- (à adapter à votre modèle : courses(organisateur_id) -> formats(course_id) -> inscriptions(format_id))

-- Exemple :
-- create policy "read organiser inscriptions" on public.inscriptions
-- for select to authenticated
-- using (
--   exists (
--     select 1 from public.formats f
--     join public.courses c on c.id = f.course_id
--     where f.id = inscriptions.format_id
--       and c.organisateur_id = auth.uid()
--   )
-- );
*/

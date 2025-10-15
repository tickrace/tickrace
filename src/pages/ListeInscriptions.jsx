// src/pages/ListeInscriptions.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabase";

/* ------------------------------ TipTap ------------------------------ */
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

/* ----------------------------- Utils ----------------------------- */
function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}
function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function eurCents(cents) {
  const n = Number(cents || 0) / 100;
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}
function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  const map = {
    paye: "bg-emerald-100 text-emerald-800",
    "en attente": "bg-amber-100 text-amber-800",
    en_attente: "bg-amber-100 text-amber-800",
    pending: "bg-amber-100 text-amber-800",
    annule: "bg-rose-100 text-rose-800",
  };
  const txt =
    s === "paye" ? "Payé" : s === "annule" ? "Annulé" : "En attente";
  return (
    <span className={cls("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", map[s] || "bg-neutral-100 text-neutral-800")}>
      {txt}
    </span>
  );
}
function GroupBadge({ status }) {
  const s = (status || "").toLowerCase();
  const map = {
    paye: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    en_attente: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    annule: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  };
  const txt =
    s === "paye" ? "Groupe payé" : s === "annule" ? "Groupe annulé" : "Groupe en attente";
  return (
    <span className={cls("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", map[s] || "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200")}>
      {txt}
    </span>
  );
}
function useDebounced(value, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/* -------------------------- Modale Email -------------------------- */
function EmailModal({ open, onClose, recipients, onSend }) {
  const [subject, setSubject] = useState("");
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Tapez votre message…" }),
    ],
    content: "<p>Bonjour,</p><p>…</p>",
  });

  useEffect(() => {
    if (!open) {
      setSubject("");
      editor?.commands.setContent("<p>Bonjour,</p><p>…</p>");
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl ring-1 ring-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Envoyer un email</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-800 text-sm">Fermer</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-xs text-neutral-600">
            Destinataires&nbsp;: <b>{recipients.length}</b> adresse{recipients.length > 1 ? "s" : ""} unique{recipients.length > 1 ? "s" : ""}
          </div>

          <div>
            <label className="text-sm font-medium">Sujet</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
              placeholder="Sujet de l’email"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Message</label>
            <div className="mt-1 rounded-xl border border-neutral-300">
              <div className="px-2 py-1 border-b border-neutral-200 text-xs text-neutral-600">
                <span className="mr-3">Mise en forme basique</span>
                <span className="text-neutral-400">TipTap</span>
              </div>
              <div className="p-2">
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-white">
            Annuler
          </button>
          <button
            onClick={() => onSend({ subject, html: editor?.getHTML() || "" })}
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- Modale Ajout Manuel ---------------------- */
function AddInscriptionModal({ open, onClose, onCreated, formats, courseId }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    email: "",
    team_name: "",
    format_id: "",
    statut: "en_attente",
  });

  useEffect(() => {
    if (!open) {
      setForm({ nom: "", prenom: "", email: "", team_name: "", format_id: "", statut: "en_attente" });
      setSaving(false);
    }
  }, [open]);

  if (!open) return null;

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSave = async () => {
    if (!form.nom.trim() || !form.prenom.trim() || !form.format_id) {
      alert("Nom, prénom et format sont requis.");
      return;
    }
    setSaving(true);
    try {
      const fmt = formats.find((f) => f.id === form.format_id);
      const payload = {
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        email: form.email.trim() || null,
        team_name: form.team_name.trim() || null,
        format_id: form.format_id,
        statut: form.statut,
        // essaye d'affecter course_id si disponible dans le contexte ou via le format
        ...(courseId ? { course_id: courseId } : fmt?.course_id ? { course_id: fmt.course_id } : {}),
      };

      const { data, error } = await supabase.from("inscriptions").insert(payload).select("id").single();
      if (error) throw error;
      onCreated?.(data?.id);
      onClose();
      alert("Coureur ajouté.");
    } catch (e) {
      console.error("ADD_INSCRIPTION_ERROR", e);
      alert("Erreur lors de l’ajout.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl ring-1 ring-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Ajouter un coureur</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-800 text-sm">Fermer</button>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Nom *</label>
            <input name="nom" value={form.nom} onChange={onChange} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2" />
          </div>
          <div>
            <label className="text-sm font-medium">Prénom *</label>
            <input name="prenom" value={form.prenom} onChange={onChange} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Email</label>
            <input name="email" value={form.email} onChange={onChange} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Équipe</label>
            <input name="team_name" value={form.team_name} onChange={onChange} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2" />
          </div>
          <div>
            <label className="text-sm font-medium">Format *</label>
            <select name="format_id" value={form.format_id} onChange={onChange} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2">
              <option value="">—</option>
              {formats.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom} {f.date ? `— ${f.date}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Statut</label>
            <select name="statut" value={form.statut} onChange={onChange} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2">
              <option value="en_attente">En attente</option>
              <option value="paye">Payé</option>
              <option value="annule">Annulé</option>
            </select>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-white">
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={cls(
              "rounded-xl px-4 py-2 text-sm font-semibold text-white",
              saving ? "bg-neutral-400 cursor-not-allowed" : "bg-neutral-900 hover:bg-black"
            )}
          >
            {saving ? "Ajout…" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- Modale Export CSV ---------------------- */
function ExportCsvModal({ open, onClose, rows, groupsById, optionsById }) {
  const [cols, setCols] = useState([
    "id",
    "created_at",
    "nom",
    "prenom",
    "email",
    "team_name",
    "statut",
    "group_status",
    "options",
  ]);

  const allCols = [
    { key: "id", label: "ID inscription" },
    { key: "created_at", label: "Créé le" },
    { key: "nom", label: "Nom" },
    { key: "prenom", label: "Prénom" },
    { key: "email", label: "Email" },
    { key: "team_name", label: "Équipe" },
    { key: "statut", label: "Statut" },
    { key: "group_status", label: "Statut groupe" },
    { key: "options", label: "Options confirmées" },
  ];

  useEffect(() => {
    if (!open) {
      // reset par défaut à l'ouverture suivante
      setCols(["id","created_at","nom","prenom","email","team_name","statut","group_status","options"]);
    }
  }, [open]);

  if (!open) return null;

  const toggleCol = (k) => {
    setCols((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));
  };

  const csvEscape = (v) => {
    if (v == null) return "";
    const s = String(v);
    if (s.includes('"') || s.includes(";") || s.includes("\n")) {
      return `"${s.replaceAll('"', '""')}"`;
    }
    return s;
  };

  const handleExport = () => {
    if (cols.length === 0) {
      alert("Sélectionnez au moins une colonne.");
      return;
    }
    const header = cols.map((k) => csvEscape(allCols.find((c) => c.key === k)?.label || k)).join(";");
    const lines = rows.map((r) => {
      const group = r.member_of_group_id ? groupsById.get(r.member_of_group_id) : null;
      const opts = optionsById.get(r.id) || [];
      const optsTxt = opts.length
        ? opts.map((o) => `#${o.option_id.slice(0, 8)}×${o.quantity}`).join(", ")
        : "—";

      const map = {
        id: r.id,
        created_at: formatDateTime(r.created_at),
        nom: r.nom || "—",
        prenom: r.prenom || "—",
        email: r.email || "—",
        team_name: r.team_name || "—",
        statut: r.statut || "—",
        group_status: group?.statut || "—",
        options: optsTxt,
      };
      return cols.map((k) => csvEscape(map[k])).join(";");
    });

    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
    a.href = url;
    a.download = `inscriptions-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl ring-1 ring-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Exporter en CSV</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-800 text-sm">Fermer</button>
        </div>

        <div className="p-5">
          <div className="text-sm font-medium mb-2">Colonnes à inclure</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allCols.map((c) => (
              <label key={c.key} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={cols.includes(c.key)}
                  onChange={() => toggleCol(c.key)}
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-white">
            Annuler
          </button>
          <button
            onClick={handleExport}
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Exporter
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------- Page ListeInscriptions ----------------------- */
export default function ListeInscriptions() {
  const { courseId } = useParams(); // facultatif : si ta page est par course
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  // Maps d’enrichissement
  const [groupMap, setGroupMap] = useState(new Map());        // groupId -> group row
  const [optionsMap, setOptionsMap] = useState(new Map());    // inscriptionId -> [{...}]

  // Filtres & tri
  const [formats, setFormats] = useState([]);
  const [formatId, setFormatId] = useState("");
  const [statut, setStatut] = useState("all"); // all | paye | en_attente | annule
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 400);

  const [sortBy, setSortBy] = useState("created_at"); // 'created_at' | 'nom' | 'statut'
  const [sortDir, setSortDir] = useState("desc");     // 'asc' | 'desc'

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Sélection
  const [selected, setSelected] = useState(() => new Set());
  const allChecked = rows.length > 0 && rows.every(r => selected.has(r.id));
  const toggleRow = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allChecked) {
        rows.forEach(r => next.delete(r.id));
      } else {
        rows.forEach(r => next.add(r.id));
      }
      return next;
    });
  };

  // Modales
  const [showEmail, setShowEmail] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showExport, setShowExport] = useState(false);

  /* -------------------------- Charger Formats -------------------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      // Charge les formats (pour le filtre) – si courseId est présent, filtre par course
      const query = supabase
        .from("formats")
        .select("id, nom, date, course_id")
        .order("date", { ascending: true });

      const { data, error } = courseId
        ? await query.eq("course_id", courseId)
        : await query;

      if (!alive) return;
      if (!error && data) setFormats(data);
    })();
    return () => { alive = false; };
  }, [courseId]);

  /* ---------------------- Charger Inscriptions page ---------------------- */
  const load = useCallback(async () => {
    setLoading(true);
    setSelected(new Set()); // reset la sélection à chaque chargement
    try {
      let query = supabase
        .from("inscriptions")
        .select("id, created_at, nom, prenom, email, statut, format_id, member_of_group_id, team_name, course_id", { count: "exact" });

      if (courseId) query = query.eq("course_id", courseId);
      if (formatId) query = query.eq("format_id", formatId);
      if (statut && statut !== "all") query = query.eq("statut", statut);

      if (debouncedQ) {
        // recherche sur nom/prenom/email/team_name
        query = query.or([
          `nom.ilike.%${debouncedQ}%`,
          `prenom.ilike.%${debouncedQ}%`,
          `email.ilike.%${debouncedQ}%`,
          `team_name.ilike.%${debouncedQ}%`,
        ].join(","));
      }

      // Tri
      if (sortBy === "nom") {
        query = query.order("nom", { ascending: sortDir === "asc", nullsFirst: false });
      } else if (sortBy === "statut") {
        query = query.order("statut", { ascending: sortDir === "asc", nullsFirst: false });
      } else {
        query = query.order("created_at", { ascending: sortDir === "asc", nullsFirst: false });
      }

      // Pagination
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      setRows(data || []);
      setTotal(count || 0);

      // Enrichissements : groupes + options confirmées
      const ids = (data || []).map(r => r.id);
      const grpIds = [...new Set((data || []).map(r => r.member_of_group_id).filter(Boolean))];

      // Groupes
      if (grpIds.length > 0) {
        const { data: groups, error: ge } = await supabase
          .from("inscriptions_groupes")
          .select("id, team_name, team_category, statut, members_count")
          .in("id", grpIds);
        if (!ge && groups) {
          const m = new Map();
          groups.forEach(g => m.set(g.id, g));
          setGroupMap(m);
        } else {
          setGroupMap(new Map());
        }
      } else {
        setGroupMap(new Map());
      }

      // Options confirmées
      if (ids.length > 0) {
        const { data: opts, error: oe } = await supabase
          .from("inscriptions_options")
          .select("inscription_id, option_id, quantity, prix_unitaire_cents, status")
          .in("inscription_id", ids)
          .eq("status", "confirmed");

        if (!oe && opts) {
          const m = new Map();
          for (const o of opts) {
            if (!m.has(o.inscription_id)) m.set(o.inscription_id, []);
            m.get(o.inscription_id).push(o);
          }
          setOptionsMap(m);
        } else {
          setOptionsMap(new Map());
        }
      } else {
        setOptionsMap(new Map());
      }
    } catch (e) {
      console.error("LOAD_INSC_ERROR", e);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, formatId, statut, debouncedQ, sortBy, sortDir, page]);

  useEffect(() => {
    setPage(1); // reset page si filtres changent
  }, [formatId, statut, debouncedQ, sortBy, sortDir]);

  useEffect(() => {
    load();
  }, [load]);

  /* ----------------------------- Recipients ----------------------------- */
  const recipients = useMemo(() => {
    const emails = new Set();
    rows.forEach(r => {
      if (selected.has(r.id) && r.email) emails.add(r.email.trim().toLowerCase());
    });
    return Array.from(emails);
  }, [rows, selected]);

  /* --------------------------- Send Emails --------------------------- */
  const handleSendEmails = async ({ subject, html }) => {
    try {
      if (recipients.length === 0) {
        alert("Aucun destinataire sélectionné.");
        return;
      }
      if (!subject.trim()) {
        alert("Le sujet est requis.");
        return;
      }
      if (!html || !html.trim()) {
        alert("Le message est requis.");
        return;
      }

      // Edge Function à adapter si ton nom diffère
      const { data, error } = await supabase.functions.invoke("organiser-send-emails", {
        body: { subject, html, to: recipients },
      });

      if (error) {
        console.error("organiser-send-emails error", error);
        alert("Erreur d’envoi des emails.");
        return;
      }
      setShowEmail(false);
      alert(`Email envoyé à ${recipients.length} destinataire(s).`);
    } catch (e) {
      console.error("SEND_EMAIL_FATAL", e);
      alert("Erreur d’envoi.");
    }
  };

  /* -------------------------- Update Statut -------------------------- */
  const handleUpdateStatut = async (id, newStatut) => {
    try {
      const { error } = await supabase.from("inscriptions").update({ statut: newStatut }).eq("id", id);
      if (error) throw error;
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, statut: newStatut } : r)));
    } catch (e) {
      console.error("UPDATE_STATUT_ERROR", e);
      alert("Impossible de mettre à jour le statut.");
    }
  };

  /* ----------------------------- Rendu UI ----------------------------- */
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const changeSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir(col === "created_at" ? "desc" : "asc");
    }
  };

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          {courseId ? (
            <Link to={`/courses/${courseId}`} className="text-sm text-neutral-500 hover:text-neutral-800">
              ← Retour à la course
            </Link>
          ) : (
            <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-800">
              ← Accueil
            </Link>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">Inscriptions</h1>
          <p className="text-neutral-600 mt-1">
            {total} résultat{total > 1 ? "s" : ""} — page {page}/{pageCount}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowEmail(true)}
            disabled={recipients.length === 0}
            className={cls(
              "rounded-xl px-4 py-2 text-sm font-semibold",
              recipients.length === 0
                ? "bg-neutral-300 text-neutral-600 cursor-not-allowed"
                : "bg-neutral-900 text-white hover:bg-black"
            )}
          >
            Email aux sélectionnés ({recipients.length})
          </button>

          {/* (2) Ajouter manuellement */}
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
          >
            + Ajouter un coureur
          </button>

          {/* (4) Export CSV avec sélection */}
          <button
            onClick={() => {
              if (selectedRows.length === 0) {
                alert("Sélectionnez au moins une inscription (case à cocher).");
                return;
              }
              setShowExport(true);
            }}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
          >
            Export CSV ({selectedRows.length})
          </button>

          <button
            onClick={load}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
          >
            Rafraîchir
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-sm font-medium">Format</label>
          <select
            value={formatId}
            onChange={(e) => setFormatId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
          >
            <option value="">Tous les formats</option>
            {formats.map(f => (
              <option key={f.id} value={f.id}>
                {f.nom} {f.date ? `— ${f.date}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Statut</label>
          <select
            value={statut}
            onChange={(e) => setStatut(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
          >
            <option value="all">Tous</option>
            <option value="paye">Payé</option>
            <option value="en attente">En attente</option>
            <option value="en_attente">En attente (underscore)</option>
            <option value="annule">Annulé</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Recherche</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            placeholder="Nom, prénom, email, équipe…"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Tri</label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-neutral-300 px-3 py-2"
            >
              <option value="created_at">Date</option>
              <option value="nom">Nom</option>
              <option value="statut">Statut</option>
            </select>
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value)}
              className="rounded-xl border border-neutral-300 px-3 py-2"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-2 bg-neutral-50 border-b border-neutral-200 text-sm flex items-center gap-3">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={allChecked} onChange={toggleAll} />
            Tout sélectionner (page)
          </label>
          <div className="text-neutral-500">
            {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-600">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                </th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => changeSort("nom")}>Nom</th>
                <th className="px-4 py-3">Prénom</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Équipe</th>
                <th className="px-4 py-3">Groupe</th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => changeSort("statut")}>Statut</th>
                <th className="px-4 py-3">Options</th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => changeSort("created_at")}>Créé le</th>
                {/* (1) Lien vers détails */}
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 w-4 rounded bg-neutral-100" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-neutral-100" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-neutral-100" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-40 rounded bg-neutral-100" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-neutral-100" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-28 rounded bg-neutral-100" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-20 rounded bg-neutral-100" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-neutral-100" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-28 rounded bg-neutral-100" /></td>
                    <td className="px-4 py-3"><div className="h-7 w-20 rounded bg-neutral-100" /></td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-neutral-600">
                    Aucun résultat — ajustez vos filtres.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const group = r.member_of_group_id ? groupMap.get(r.member_of_group_id) : null;
                  const opts = optionsMap.get(r.id) || [];
                  const optsTxt = opts.length
                    ? opts.map(o => `#${o.option_id.slice(0, 8)}×${o.quantity}`).join(", ")
                    : "—";

                  return (
                    <tr key={r.id} className="hover:bg-neutral-50/60">
                      <td className="px-4 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleRow(r.id)}
                        />
                      </td>
                      <td className="px-4 py-3 align-top font-medium">{r.nom || "—"}</td>
                      <td className="px-4 py-3 align-top">{r.prenom || "—"}</td>
                      <td className="px-4 py-3 align-top">
                        {r.email ? <a className="text-neutral-900 hover:underline" href={`mailto:${r.email}`}>{r.email}</a> : "—"}
                      </td>
                      <td className="px-4 py-3 align-top">{r.team_name || "—"}</td>
                      <td className="px-4 py-3 align-top">
                        {group ? <GroupBadge status={group.statut} /> : <span className="text-neutral-500">—</span>}
                      </td>

                      {/* (3) Statut modifiable */}
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={r.statut} />
                          <select
                            value={(r.statut || "").toLowerCase() === "en attente" ? "en_attente" : (r.statut || "")}
                            onChange={(e) => handleUpdateStatut(r.id, e.target.value)}
                            className="rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                          >
                            <option value="en_attente">En attente</option>
                            <option value="paye">Payé</option>
                            <option value="annule">Annulé</option>
                          </select>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top text-neutral-700">{optsTxt}</td>
                      <td className="px-4 py-3 align-top text-neutral-600">{formatDateTime(r.created_at)}</td>

                      {/* (1) Lien vers détails */}
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-2">
                          {/* Adapte la route si nécessaire (ex: /mon-inscription/:id) */}
                          <Link
  to={`/mon-inscription/${r.id}`}
  className="inline-flex items-center rounded-lg border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
  title="Voir le détail de l'inscription"
>
  Voir
</Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-neutral-200 flex items-center justify-between text-sm">
          <div className="text-neutral-600">
            {total} résultat{total > 1 ? "s" : ""} • {pageSize} par page
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={cls(
                "rounded-lg border px-3 py-1.5",
                page <= 1 ? "text-neutral-400 border-neutral-200 cursor-not-allowed" : "hover:bg-neutral-50"
              )}
            >
              Précédent
            </button>
            <span className="text-neutral-600">
              Page {page} / {pageCount}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className={cls(
                "rounded-lg border px-3 py-1.5",
                page >= pageCount ? "text-neutral-400 border-neutral-200 cursor-not-allowed" : "hover:bg-neutral-50"
              )}
            >
              Suivant
            </button>
          </div>
        </div>
      </div>

      {/* Modales */}
      <EmailModal
        open={showEmail}
        onClose={() => setShowEmail(false)}
        recipients={recipients}
        onSend={handleSendEmails}
      />

      <AddInscriptionModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => load()}
        formats={formats}
        courseId={courseId}
      />

      <ExportCsvModal
        open={showExport}
        onClose={() => setShowExport(false)}
        rows={selectedRows}
        groupsById={groupMap}
        optionsById={optionsMap}
      />
    </div>
  );
}

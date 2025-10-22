// src/pages/ListeInscriptions.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
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
function useDebounced(value, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
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
  const txt = s === "paye" ? "Payé" : s === "annule" ? "Annulé" : "En attente";
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

/* -------------------------- Modale Email -------------------------- */
function EmailModal({ open, onClose, recipients, onSend }) {
  const [subject, setSubject] = useState("");
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: "Tapez votre message…" })],
    content: "<p>Bonjour,</p><p>…</p>",
  });

  useEffect(() => {
    if (!open) {
      setSubject("");
      editor?.commands.setContent("<p>Bonjour,</p><p>…</p>");
    }
  }, [open]); // eslint-disable-line

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

/* ---------------------- Modale Ajout Manuel (format figé) ---------------------- */
function AddInscriptionModal({ open, onClose, onCreated, courseId, fixedFormatId }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nom: "", prenom: "", email: "", team_name: "", statut: "en_attente",
  });

  useEffect(() => {
    if (!open) {
      setForm({ nom: "", prenom: "", email: "", team_name: "", statut: "en_attente" });
      setSaving(false);
    }
  }, [open]);

  if (!open) return null;

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSave = async () => {
    if (!form.nom.trim() || !form.prenom.trim()) {
      alert("Nom et prénom sont requis.");
      return;
    }
    if (!fixedFormatId) {
      alert("Format introuvable.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        email: form.email.trim() || null,
        team_name: form.team_name.trim() || null,
        format_id: fixedFormatId,
        course_id: courseId || null,
        statut: form.statut,
      };

      const { data, error } = await supabase
        .from("inscriptions")
        .insert(payload)
        .select("id")
        .single();
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
            <label className="text-sm font-medium">Statut</label>
            <select name="statut" value={form.statut} onChange={onChange} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2">
              <option value="en_attente">En attente</option>
              <option value="paye">Payé</option>
              <option value="annule">Annulé</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <div className="text-xs text-neutral-600 rounded-lg bg-neutral-50 ring-1 ring-neutral-200 px-3 py-2">
              Format sélectionné&nbsp;: <b>{fixedFormatId || "—"}</b>
            </div>
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
function ExportCsvModal({ open, onClose, rows, groupsById, optionsById, optionLabelById, filenameBase }) {
  const [cols, setCols] = useState([
    "id","created_at","nom","prenom","email","team_name","statut","group_status","options",
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
        ? opts.map((o) => {
            const label = optionLabelById.get(o.option_id) || `#${String(o.option_id).slice(0, 8)}`;
            return `${label}×${o.quantity}`;
          }).join(", ")
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
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `${filenameBase || "inscriptions"}-${ts}.csv`;
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
                <input type="checkbox" checked={cols.includes(c.key)} onChange={() => toggleCol(c.key)} />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-white">
            Annuler
          </button>
          <button onClick={handleExport} className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">
            Exporter
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------- Page ListeInscriptions ----------------------- */
export default function ListeInscriptions() {
  // --- Paramètres & Querystring (auto-détection courseId/formatId)
  const { courseId: routeParam } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [resolvedCourseId, setResolvedCourseId] = useState(null);

  // format = obligatoire pour cette page (mais pas d’UI). On le prend dans la query.
  const initialFormatId = searchParams.get("formatId") || "";
  const [formatId, setFormatId] = useState(initialFormatId);

  const [statut, setStatut] = useState(searchParams.get("statut") || "all"); // all | paye | en_attente | annule
  const [q, setQ] = useState(searchParams.get("q") || "");
  const debouncedQ = useDebounced(q, 400);

  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") || "created_at");
  const [sortDir, setSortDir] = useState(searchParams.get("sortDir") || "desc");

  // Données / enrichissements
  const [formats, setFormats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inscriptions, setInscriptions] = useState([]);
  const [total, setTotal] = useState(0);
  const [groupMap, setGroupMap] = useState(new Map());
  const [optionsMap, setOptionsMap] = useState(new Map());
  const [optionLabelMap, setOptionLabelMap] = useState(new Map());

  // Pagination & sélection
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [showEmail, setShowEmail] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const updateQueryString = useCallback(
    (next) => {
      const merged = new URLSearchParams(searchParams.toString());
      Object.entries(next).forEach(([k, v]) => {
        if (v === "" || v == null) merged.delete(k);
        else merged.set(k, String(v));
      });
      setSearchParams(merged, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  /* -------------------- Auto-détection courseId ⇄ formatId -------------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!routeParam) {
        setResolvedCourseId(null);
        return;
      }

      // 1) routeParam comme courseId → a-t-il des formats ?
      const { data: fmtByCourse } = await supabase
        .from("formats")
        .select("id")
        .eq("course_id", routeParam)
        .limit(1);
      if (!alive) return;

      if (fmtByCourse && fmtByCourse.length > 0) {
        setResolvedCourseId(routeParam);
        return;
      }

      // 2) routeParam comme formatId → récupère sa course et force formatId si absent
      const { data: fmt } = await supabase
        .from("formats")
        .select("id, course_id")
        .eq("id", routeParam)
        .maybeSingle();

      if (!alive) return;

      if (fmt?.course_id) {
        setResolvedCourseId(fmt.course_id);
        if (!initialFormatId) {
          setFormatId(fmt.id);
          const next = new URLSearchParams(searchParams.toString());
          next.set("formatId", fmt.id);
          setSearchParams(next, { replace: true });
        }
        return;
      }

      // 3) rien trouvé
      setResolvedCourseId(null);
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeParam]);

  /* -------------------------- Charger Formats (pour le libellé) -------------------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const query = supabase
        .from("formats")
        .select("id, nom, date, course_id") // colonnes sûres
        .order("date", { ascending: true });

      const { data, error } = resolvedCourseId
        ? await query.eq("course_id", resolvedCourseId)
        : await query;

      if (!alive) return;
      if (!error && data) setFormats(data);
    })();
    return () => { alive = false; };
  }, [resolvedCourseId]);

  const formatObj = useMemo(
    () => (formatId ? formats.find(f => f.id === formatId) : null),
    [formats, formatId]
  );
  const formatLabel = formatObj ? `${formatObj.nom}${formatObj.date ? ` — ${formatObj.date}` : ""}` : (formatId || "—");

  /* ---------------------- Charger Inscriptions (course + format) ---------------------- */
  const load = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      // Garde-fou : format obligatoire sur cette page
      if (!formatId) {
        setInscriptions([]); setTotal(0);
        setOptionsMap(new Map()); setOptionLabelMap(new Map()); setGroupMap(new Map());
        setLoading(false);
        return;
      }

      // Si on a course + format, vérifier l’appartenance
      if (resolvedCourseId && formatObj && formatObj.course_id && formatObj.course_id !== resolvedCourseId) {
        setInscriptions([]); setTotal(0);
        setOptionsMap(new Map()); setOptionLabelMap(new Map()); setGroupMap(new Map());
        setLoading(false);
        return;
      }

      let query = supabase
        .from("inscriptions")
        .select(
          "id, created_at, nom, prenom, email, statut, format_id, member_of_group_id, team_name, course_id",
          { count: "exact" }
        );

      if (resolvedCourseId) query = query.eq("course_id", resolvedCourseId);
      query = query.eq("format_id", formatId);

      if (statut && statut !== "all") {
        const s = (statut || "").toLowerCase();
        const STATUS_SET = {
          paye: ["paye", "payé", "payee", "paid", "valide", "validé", "confirme", "confirmé", "confirmed"],
          annule: ["annule", "annulé", "canceled", "cancelled"],
          en_attente: ["en_attente", "en attente", "pending", "attente"],
        };
        const key =
          s === "paye" ? "paye" :
          s === "annule" ? "annule" :
          s === "en_attente" || s === "en attente" ? "en_attente" :
          null;
        if (key) query = query.in("statut", STATUS_SET[key]);
      }

      if (debouncedQ) {
        query = query.or(
          [
            `nom.ilike.%${debouncedQ}%`,
            `prenom.ilike.%${debouncedQ}%`,
            `email.ilike.%${debouncedQ}%`,
            `team_name.ilike.%${debouncedQ}%`,
          ].join(",")
        );
      }

      if (sortBy === "nom") {
        query = query.order("nom", { ascending: sortDir === "asc", nullsFirst: false });
      } else if (sortBy === "statut") {
        query = query.order("statut", { ascending: sortDir === "asc", nullsFirst: false });
      } else {
        query = query.order("created_at", { ascending: sortDir === "asc", nullsFirst: false });
      }

      const { data, error, count } = await query;
      if (error) throw error;

      setInscriptions(data || []);
      setTotal(count || 0);

      const ids = (data || []).map((r) => r.id);
      const grpIds = [...new Set((data || []).map((r) => r.member_of_group_id).filter(Boolean))];

      // Groupes
      if (grpIds.length > 0) {
        const { data: groups, error: ge } = await supabase
          .from("inscriptions_groupes")
          .select("id, team_name, team_category, statut, members_count")
          .in("id", grpIds);
        if (!ge && groups) {
          const m = new Map();
          groups.forEach((g) => m.set(g.id, g));
          setGroupMap(m);
        } else {
          setGroupMap(new Map());
        }
      } else {
        setGroupMap(new Map());
      }

      // Options confirmées + libellés
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

          const optionIds = [...new Set(opts.map((o) => o.option_id))];
          if (optionIds.length > 0) {
            const { data: defs, error: de } = await supabase
              .from("options")
              .select("id, nom, name, label")
              .in("id", optionIds);
            if (!de && defs) {
              const mm = new Map();
              defs.forEach((d) => {
                const l = d.nom || d.name || d.label || `#${String(d.id).slice(0, 8)}`;
                mm.set(d.id, l);
              });
              setOptionLabelMap(mm);
            } else {
              const mm = new Map();
              optionIds.forEach((id) => mm.set(id, `#${String(id).slice(0, 8)}`));
              setOptionLabelMap(mm);
            }
          } else {
            setOptionLabelMap(new Map());
          }
        } else {
          setOptionsMap(new Map());
          setOptionLabelMap(new Map());
        }
      } else {
        setOptionsMap(new Map());
        setOptionLabelMap(new Map());
      }
    } catch (e) {
      console.error("LOAD_INSC_ERROR", e);
    } finally {
      setLoading(false);
    }
  }, [formatId, statut, debouncedQ, sortBy, sortDir, resolvedCourseId, formatObj]);

  // Sync URL sur changement de filtres (sans format UI, on garde formatId si présent)
  useEffect(() => {
    updateQueryString({ formatId, statut, q, sortBy, sortDir });
  }, [formatId, statut, q, sortBy, sortDir]); // eslint-disable-line

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [formatId, statut, debouncedQ, sortBy, sortDir]);

  useEffect(() => {
    load();
  }, [load]);

  // Pagination & sélection
  const pageCount = Math.max(1, Math.ceil((inscriptions.length || 0) / PAGE_SIZE));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE;
  const pageRows = inscriptions.slice(from, to);

  const allChecked = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) pageRows.forEach((r) => next.delete(r.id));
      else pageRows.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const recipients = useMemo(() => {
    const emails = new Set();
    inscriptions.forEach(r => {
      if (selected.has(r.id) && r.email) emails.add(r.email.trim().toLowerCase());
    });
    return Array.from(emails);
  }, [inscriptions, selected]);

  const selectedRows = inscriptions.filter((r) => selected.has(r.id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header global */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          {resolvedCourseId ? (
            <Link to={`/courses/${resolvedCourseId}`} className="text-sm text-neutral-500 hover:text-neutral-800">
              ← Retour à la course
            </Link>
          ) : (
            <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-800">
              ← Accueil
            </Link>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">Inscriptions</h1>
          <p className="text-neutral-600 mt-1">
            {total} résultat{total > 1 ? "s" : ""}{formatObj ? ` — ${formatLabel}` : ""}
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

          <button
            onClick={() => setShowAdd(true)}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
          >
            + Ajouter un coureur
          </button>

          <button
            onClick={() => setShowExport(true)}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
          >
            Export CSV {selectedRows.length > 0 ? `(${selectedRows.length})` : "(tout)"}
          </button>

          <button
            onClick={() => load()}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
          >
            Rafraîchir
          </button>
        </div>
      </div>

      {/* Filtres (sans sélecteur de format) */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium">Statut</label>
          <select
            value={statut}
            onChange={(e) => setStatut(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
          >
            <option value="all">Tous</option>
            <option value="paye">Payé</option>
            <option value="en_attente">En attente</option>
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
                <th className="px-4 py-3 cursor-pointer" onClick={() => { setSortBy("nom"); setSortDir(sortDir === "asc" ? "desc" : "asc"); }}>Nom</th>
                <th className="px-4 py-3">Prénom</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Équipe</th>
                <th className="px-4 py-3">Groupe</th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => { setSortBy("statut"); setSortDir(sortDir === "asc" ? "desc" : "asc"); }}>Statut</th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => { setSortBy("created_at"); setSortDir(sortDir === "asc" ? "desc" : "asc"); }}>Créé le</th>
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
                    <td className="px-4 py-3"><div className="h-4 w-28 rounded bg-neutral-100" /></td>
                    <td className="px-4 py-3"><div className="h-7 w-20 rounded bg-neutral-100" /></td>
                  </tr>
                ))
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-neutral-600">
                    Aucun résultat — ajustez vos filtres.
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => {
                  const group = r.member_of_group_id ? groupMap.get(r.member_of_group_id) : null;

                  return (
                    <tr key={r.id} className="hover:bg-neutral-50/60">
                      <td className="px-4 py-3 align-top">
                        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} />
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
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={r.statut} />
                          <select
                            value={(r.statut || "").toLowerCase() === "en attente" ? "en_attente" : (r.statut || "")}
                            onChange={(e) => {
                              const newStatut = e.target.value;
                              // MAJ optimiste
                              setInscriptions((rs) => rs.map((x) => (x.id === r.id ? { ...x, statut: newStatut } : x)));
                              // envoi serveur
                              supabase.from("inscriptions").update({ statut: newStatut }).eq("id", r.id).then(({ error }) => {
                                if (error) {
                                  // rollback
                                  setInscriptions((rs) => rs.map((x) => (x.id === r.id ? { ...x, statut: r.statut } : x)));
                                  alert("Impossible de mettre à jour le statut.");
                                }
                              });
                            }}
                            className="rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                          >
                            <option value="en_attente">En attente</option>
                            <option value="paye">Payé</option>
                            <option value="annule">Annulé</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-neutral-600">{formatDateTime(r.created_at)}</td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={r.id ? `/inscription/${encodeURIComponent(r.id)}` : "#"}
                            onClick={(e) => { if (!r.id) e.preventDefault(); }}
                            className="inline-flex items-center rounded-lg border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
                            title="Voir le détail de l’inscription"
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
            {inscriptions.length} résultat{inscriptions.length > 1 ? "s" : ""} • {PAGE_SIZE} par page
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
        onSend={({ subject, html }) => {
          if (recipients.length === 0) return alert("Aucun destinataire sélectionné.");
          if (!subject?.trim()) return alert("Le sujet est requis.");
          if (!html?.trim()) return alert("Le message est requis.");
          supabase.functions
            .invoke("organiser-send-emails", { body: { subject, html, to: recipients } })
            .then(({ error }) => {
              if (error) {
                console.error("organiser-send-emails error", error);
                alert("Erreur d’envoi des emails.");
              } else {
                alert(`Email envoyé à ${recipients.length} destinataire(s).`);
                setShowEmail(false);
              }
            })
            .catch(() => alert("Erreur d’envoi."));
        }}
      />

      <AddInscriptionModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => load()}
        courseId={resolvedCourseId}
        fixedFormatId={formatId}
      />

      <ExportCsvModal
        open={showExport}
        onClose={() => setShowExport(false)}
        rows={selectedRows.length > 0 ? selectedRows : inscriptions}
        groupsById={groupMap}
        optionsById={optionsMap}
        optionLabelById={optionLabelMap}
        filenameBase={`inscriptions-${(formatObj?.nom || "format").toString().toLowerCase().replace(/\s+/g, "-")}`}
      />
    </div>
  );
}

// src/pages/ListeInscriptions.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "../supabase";
import AssignBibModal from "../components/AssignBibModal";
import { computeCategoryForAthlete } from "../utils/ageCategories";
import WaitlistPanel from "../components/WaitlistPanel";

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
function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit" });
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
    "payé": "bg-emerald-100 text-emerald-800",
    en_attente: "bg-amber-100 text-amber-800",
    "en attente": "bg-amber-100 text-amber-800",
    annule: "bg-rose-100 text-rose-800",
    "annulé": "bg-rose-100 text-rose-800",
  };
  const txt =
    ["paye", "payé"].includes(s) ? "Payé" : ["annule", "annulé"].includes(s) ? "Annulé" : "En attente";
  return (
    <span
      className={cls(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        map[s] || "bg-neutral-100 text-neutral-800"
      )}
    >
      {txt}
    </span>
  );
}

/* -------------------------- Modale Email -------------------------- */
function EmailModal({ open, onClose, recipients, onSend }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("Bonjour,\n\n…\n");
  useEffect(() => {
    if (!open) {
      setSubject("");
      setMessage("Bonjour,\n\n…\n");
    }
  }, [open]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl ring-1 ring-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Envoyer un email</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-800 text-sm">
            Fermer
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-xs text-neutral-600">
            Destinataires : <b>{recipients.length}</b> adresse{recipients.length > 1 ? "s" : ""} unique
            {recipients.length > 1 ? "s" : ""}
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
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 font-mono text-sm"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-white">
            Annuler
          </button>
          <button
            onClick={() => onSend({ subject, html: message.replace(/\n/g, "<br/>") })}
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- Modale Ajout Coureur ---------------------- */
function AddRunnerModal({ open, onClose, onCreated, courseId, formatId }) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    nom: "",
    prenom: "",
    email: "",
    genre: "",
    date_naissance: "",
    nationalite: "",
    telephone: "",
    adresse: "",
    adresse_complement: "",
    code_postal: "",
    ville: "",
    pays: "",
    club: "",
    justificatif_type: "",
    numero_licence: "",
    pps_identifier: "",
    contact_urgence_nom: "",
    contact_urgence_telephone: "",
    apparaitre_resultats: true,
    statut: "en_attente",
    team_name: "",
    dossard: "",
  });

  useEffect(() => {
    if (!open) {
      setSaving(false);
      setF({
        nom: "",
        prenom: "",
        email: "",
        genre: "",
        date_naissance: "",
        nationalite: "",
        telephone: "",
        adresse: "",
        adresse_complement: "",
        code_postal: "",
        ville: "",
        pays: "",
        club: "",
        justificatif_type: "",
        numero_licence: "",
        pps_identifier: "",
        contact_urgence_nom: "",
        contact_urgence_telephone: "",
        apparaitre_resultats: true,
        statut: "en_attente",
        team_name: "",
        dossard: "",
      });
    }
  }, [open]);

  if (!open) return null;

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setF((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  };

  const save = async () => {
    if (!formatId) return alert("Format introuvable.");
    if (!f.nom.trim() || !f.prenom.trim()) return alert("Nom et prénom requis.");

    setSaving(true);
    try {
      const payload = {
        ...f,
        nom: f.nom.trim(),
        prenom: f.prenom.trim(),
        email: f.email?.trim() || null,
        course_id: courseId || null,
        format_id: formatId,
        team_name: f.team_name?.trim() || null,
        dossard: f.dossard !== "" ? Number(f.dossard) : null,
      };

      const { error } = await supabase.from("inscriptions").insert(payload);
      if (error) throw error;

      onCreated?.();
      onClose();
      alert("Coureur ajouté.");
    } catch (e) {
      console.error(e);
      alert("Erreur d’ajout.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl ring-1 ring-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Ajouter un coureur</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-800 text-sm">
            Fermer
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <input name="nom" value={f.nom} onChange={onChange} className="rounded-xl border px-3 py-2" placeholder="Nom *" />
          <input
            name="prenom"
            value={f.prenom}
            onChange={onChange}
            className="rounded-xl border px-3 py-2"
            placeholder="Prénom *"
          />
          <input
            name="email"
            value={f.email}
            onChange={onChange}
            className="rounded-xl border px-3 py-2 md:col-span-2"
            placeholder="Email"
          />

          <div className="grid grid-cols-2 gap-3 md:col-span-2">
            <select name="genre" value={f.genre} onChange={onChange} className="rounded-xl border px-3 py-2">
              <option value="">Genre</option>
              <option>Homme</option>
              <option>Femme</option>
            </select>
            <input type="date" name="date_naissance" value={f.date_naissance} onChange={onChange} className="rounded-xl border px-3 py-2" />
          </div>

          <input
            name="numero_licence"
            value={f.numero_licence}
            onChange={onChange}
            className="rounded-xl border px-3 py-2"
            placeholder="N° licence / PPS"
          />
          <input name="club" value={f.club} onChange={onChange} className="rounded-xl border px-3 py-2" placeholder="Club" />

          <input
            name="telephone"
            value={f.telephone}
            onChange={onChange}
            className="rounded-xl border px-3 py-2 md:col-span-2"
            placeholder="Téléphone"
          />

          <input name="adresse" value={f.adresse} onChange={onChange} className="rounded-xl border px-3 py-2 md:col-span-2" placeholder="Adresse" />
          <input name="adresse_complement" value={f.adresse_complement} onChange={onChange} className="rounded-xl border px-3 py-2" placeholder="Complément" />
          <input name="code_postal" value={f.code_postal} onChange={onChange} className="rounded-xl border px-3 py-2" placeholder="Code postal" />
          <input name="ville" value={f.ville} onChange={onChange} className="rounded-xl border px-3 py-2" placeholder="Ville" />
          <input name="pays" value={f.pays} onChange={onChange} className="rounded-xl border px-3 py-2" placeholder="Pays" />

          <input
            name="justificatif_type"
            value={f.justificatif_type}
            onChange={onChange}
            className="rounded-xl border px-3 py-2"
            placeholder="Type justificatif"
          />
          <input
            name="pps_identifier"
            value={f.pps_identifier}
            onChange={onChange}
            className="rounded-xl border px-3 py-2"
            placeholder="Identifiant PPS"
          />

          <input
            name="contact_urgence_nom"
            value={f.contact_urgence_nom}
            onChange={onChange}
            className="rounded-xl border px-3 py-2"
            placeholder="Contact urgence - Nom"
          />
          <input
            name="contact_urgence_telephone"
            value={f.contact_urgence_telephone}
            onChange={onChange}
            className="rounded-xl border px-3 py-2"
            placeholder="Contact urgence - Téléphone"
          />

          <input name="team_name" value={f.team_name} onChange={onChange} className="rounded-xl border px-3 py-2" placeholder="Équipe (si applicable)" />
          <input name="dossard" value={f.dossard} onChange={onChange} className="rounded-xl border px-3 py-2" placeholder="Dossard (optionnel)" />

          <div className="flex items-center gap-2 md:col-span-2">
            <input id="apres" type="checkbox" name="apparaitre_resultats" checked={f.apparaitre_resultats} onChange={onChange} />
            <label htmlFor="apres" className="text-sm">
              Apparaître dans les résultats
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 md:col-span-2">
            <select name="statut" value={f.statut} onChange={onChange} className="rounded-xl border px-3 py-2">
              <option value="en_attente">En attente</option>
              <option value="paye">Payé</option>
              <option value="annule">Annulé</option>
            </select>
            <div className="text-xs text-neutral-600 flex items-center">
              Format : <b className="ml-1">{formatId || "—"}</b>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border px-4 py-2 text-sm hover:bg-white">
            Annuler
          </button>
          <button
            onClick={save}
            disabled={saving}
            className={cls("rounded-xl px-4 py-2 text-sm font-semibold text-white", saving ? "bg-neutral-400" : "bg-neutral-900 hover:bg-black")}
          >
            {saving ? "Ajout…" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- Modale Export CSV ---------------------- */
function ExportCsvModal({ open, onClose, rows, columns, filenameBase = "inscriptions" }) {
  if (!open) return null;

  const csvEscape = (v) => {
    if (v == null) return "";
    const s = String(v);
    if (s.includes('"') || s.includes(";") || s.includes("\n")) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };

  const exportCsv = () => {
    const visible = columns.filter((c) => c.visible);
    const header = visible.map((c) => csvEscape(c.label)).join(";");
    const lines = rows.map((r) =>
      visible
        .map((c) => {
          const v = typeof c.accessor === "function" ? c.accessor(r) : r[c.key];
          return csvEscape(v);
        })
        .join(";")
    );

    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `${filenameBase}-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl ring-1 ring-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Exporter en CSV</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-800 text-sm">
            Fermer
          </button>
        </div>

        <div className="p-5">
          <div className="text-sm font-medium mb-2">Colonnes à inclure</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {columns.map((c, i) => (
              <label key={c.key} className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={c.visible} onChange={(e) => c.onToggle?.(i, e.target.checked)} />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-white">
            Annuler
          </button>
          <button onClick={exportCsv} className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">
            Exporter
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------- Page ListeInscriptions ----------------------- */
export default function ListeInscriptions() {
  const { courseId: routeParam } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [resolvedCourseId, setResolvedCourseId] = useState(null);
  const initialFormatId = searchParams.get("formatId") || "";
  const [formatId, setFormatId] = useState(initialFormatId);

  const [statut, setStatut] = useState(searchParams.get("statut") || "all");
  const [q, setQ] = useState(searchParams.get("q") || "");
  const debouncedQ = useDebounced(q, 400);
  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") || "created_at");
  const [sortDir, setSortDir] = useState(searchParams.get("sortDir") || "desc");

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [formats, setFormats] = useState([]);
  const [formatType, setFormatType] = useState("individuel");
  const [defaultTeamSize, setDefaultTeamSize] = useState(2);

  const [optionsMap, setOptionsMap] = useState(new Map());
  const [optionLabelMap, setOptionLabelMap] = useState(new Map());

  // UI
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  const [selected, setSelected] = useState(new Set());
  const [showEmail, setShowEmail] = useState(false);
  const [showAddRunner, setShowAddRunner] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showAssignBib, setShowAssignBib] = useState(false);

  // Catégories
  const [federations, setFederations] = useState([]);
  const [federationCode, setFederationCode] = useState("FFA");
  const [previewCategories, setPreviewCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesApplying, setCategoriesApplying] = useState(false);
  const [categoriesError, setCategoriesError] = useState(null);

  const updateQS = useCallback(
    (next) => {
      const sp = new URLSearchParams(searchParams.toString());
      Object.entries(next).forEach(([k, v]) => {
        if (v === "" || v == null) sp.delete(k);
        else sp.set(k, String(v));
      });
      setSearchParams(sp, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  /* -------- Auto-détection courseId ⇄ formatId -------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!routeParam) {
        setResolvedCourseId(null);
        return;
      }

      // routeParam est un courseId ?
      const { data: fmtByCourse } = await supabase.from("formats").select("id").eq("course_id", routeParam).limit(1);
      if (!alive) return;

      if (fmtByCourse && fmtByCourse.length > 0) {
        setResolvedCourseId(routeParam);
      } else {
        // sinon routeParam est peut-être un formatId
        const { data: fmt } = await supabase.from("formats").select("id, course_id").eq("id", routeParam).maybeSingle();
        if (!alive) return;

        if (fmt?.course_id) {
          setResolvedCourseId(fmt.course_id);
          if (!initialFormatId) {
            setFormatId(fmt.id);
            const sp = new URLSearchParams(searchParams.toString());
            sp.set("formatId", fmt.id);
            setSearchParams(sp, { replace: true });
          }
        } else {
          setResolvedCourseId(null);
        }
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeParam]);

  /* ---------------- Charger Formats ---------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const base = supabase
        .from("formats")
        .select("id, nom, date, course_id, type_format, team_size, nb_coureurs_min, nb_coureurs_max, waitlist_enabled, quota_attente")
        .order("date", { ascending: true });

      const { data, error } = resolvedCourseId ? await base.eq("course_id", resolvedCourseId) : await base;

      if (!alive) return;
      if (!error && data) {
        setFormats(data);
 // ✅ Si on arrive via /listeinscriptions/:courseId et qu’aucun formatId n’est défini,
     // on prend automatiquement le 1er format.
     if ((!formatId || formatId === "") && data.length > 0) {
       const firstId = data[0].id;
       setFormatId(firstId);
       const sp = new URLSearchParams(searchParams.toString());
       sp.set("formatId", firstId);
       setSearchParams(sp, { replace: true });
     }

        if (formatId) {
          const f = data.find((x) => x.id === formatId);
          if (f) {
            setFormatType(f.type_format || "individuel");
            setDefaultTeamSize(f.team_size || f.nb_coureurs_min || 2);
          }
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [resolvedCourseId, formatId]);

  const formatObj = useMemo(() => (formatId ? formats.find((f) => f.id === formatId) : null), [formats, formatId]);

  /* ---------------- Charger fédérations ---------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from("federations").select("code, name, season_start_month").order("code", { ascending: true });
      if (!alive) return;
      if (!error && data) {
        setFederations(data);
        if (!federationCode && data.length > 0) setFederationCode(data[0].code);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------- Colonnes ------------------------- */
  const [columns, setColumns] = useState([
    { key: "id", label: "ID", visible: false },
    { key: "created_at", label: "Créé le", visible: true, accessor: (r) => formatDateTime(r.created_at) },
    { key: "statut", label: "Statut", visible: true },
    { key: "nom", label: "Nom", visible: true },
    { key: "prenom", label: "Prénom", visible: true },
    { key: "dossard", label: "Dossard", visible: true },
    { key: "email", label: "Email", visible: true },
    { key: "options", label: "Options", visible: false },
    { key: "numero_licence", label: "N° licence/PPS", visible: true },
    { key: "team_name", label: "Équipe", visible: true },
    { key: "categorie_age_label", label: "Catégorie d’âge", visible: true },
  ]);

  const toggleCol = (i, vis) => setColumns((prev) => prev.map((c, idx) => (idx === i ? { ...c, visible: vis } : c)));

  /* ---------------------- Helpers Options ---------------------- */
  const optionsToString = useCallback(
    (r) => {
      const opts = optionsMap.get(r.id) || [];
      if (!opts.length) return "";
      return opts
        .map((o) => {
          const label = optionLabelMap.get(o.option_id) || "Option";
          const qty = o.quantity ?? 1;
          return `${label} x${qty}`;
        })
        .join(" | ");
    },
    [optionsMap, optionLabelMap]
  );

  const renderOptionsChips = useCallback(
    (r) => {
      const opts = optionsMap.get(r.id) || [];
      if (!opts.length) return <span className="text-neutral-400">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {opts.map((o, idx) => {
            const label = optionLabelMap.get(o.option_id) || "Option";
            const qty = o.quantity ?? 1;
            return (
              <span
                key={`${o.option_id}-${idx}`}
                className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700"
                title={`${label} x${qty}`}
              >
                {label} ×{qty}
              </span>
            );
          })}
        </div>
      );
    },
    [optionsMap, optionLabelMap]
  );

  /* ---------------------- Charger Inscriptions ---------------------- */
  const load = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());

    try {
      if (!formatId) {
        setRows([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      let query = supabase
        .from("inscriptions")
        .select(
          "id, created_at, statut, course_id, format_id, member_of_group_id, team_name, " +
            "nom, prenom, email, genre, date_naissance, nationalite, telephone, adresse, adresse_complement, code_postal, ville, pays, apparaitre_resultats, club, justificatif_type, numero_licence, pps_identifier, contact_urgence_nom, contact_urgence_telephone, dossard, " +
            "federation_code, categorie_age_code, categorie_age_label",
          { count: "exact" }
        )
        .eq("format_id", formatId);

      if (resolvedCourseId) query = query.eq("course_id", resolvedCourseId);

      if (statut && statut !== "all") {
        const s = (statut || "").toLowerCase();
        const SET = {
          paye: ["paye", "payé", "paid", "validé", "confirmé", "confirmed"],
          annule: ["annule", "annulé", "canceled", "cancelled"],
          en_attente: ["en_attente", "en attente", "pending", "attente"],
        };
        const key = s === "paye" ? "paye" : s === "annule" ? "annule" : "en_attente";
        query = query.in("statut", SET[key]);
      }

      if (debouncedQ) {
        query = query.or(
          [
            `nom.ilike.%${debouncedQ}%`,
            `prenom.ilike.%${debouncedQ}%`,
            `email.ilike.%${debouncedQ}%`,
            `team_name.ilike.%${debouncedQ}%`,
            `numero_licence.ilike.%${debouncedQ}%`,
            `club.ilike.%${debouncedQ}%`,
            `ville.ilike.%${debouncedQ}%`,
            `dossard::text.ilike.%${debouncedQ}%`,
          ].join(",")
        );
      }

      if (sortBy === "nom") query = query.order("nom", { ascending: sortDir === "asc" });
      else if (sortBy === "statut") query = query.order("statut", { ascending: sortDir === "asc" });
      else query = query.order("created_at", { ascending: sortDir === "asc" });

      const { data, error, count } = await query;
      if (error) throw error;

      setRows(data || []);
      setTotal(count || (data?.length || 0));

      // Options confirmées
      const ids = (data || []).map((r) => r.id);
      if (ids.length) {
        const { data: opts } = await supabase
          .from("inscriptions_options")
          .select("inscription_id, option_id, quantity, prix_unitaire_cents, status")
          .in("inscription_id", ids)
          .eq("status", "confirmed");

        const m = new Map();
        (opts || []).forEach((o) => {
          if (!m.has(o.inscription_id)) m.set(o.inscription_id, []);
          m.get(o.inscription_id).push(o);
        });
        setOptionsMap(m);

        const optionIds = [...new Set((opts || []).map((o) => o.option_id))];
        if (optionIds.length) {
          const { data: defs } = await supabase.from("options_catalogue").select("id, label").in("id", optionIds);
          const mm = new Map();
          (defs || []).forEach((d) => mm.set(d.id, d.label || `#${String(d.id).slice(0, 8)}`));
          setOptionLabelMap(mm);
        } else {
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
  }, [formatId, resolvedCourseId, statut, debouncedQ, sortBy, sortDir]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    updateQS({ formatId, statut, q, sortBy, sortDir });
  }, [formatId, statut, q, sortBy, sortDir]); // eslint-disable-line

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [formatId, statut, debouncedQ, sortBy, sortDir]);

  // Pagination (client)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE;
  const pageRows = rows.slice(from, to);

  // Sélection
  const allChecked = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  const toggleRow = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) pageRows.forEach((r) => next.delete(r.id));
      else pageRows.forEach((r) => next.add(r.id));
      return next;
    });

  const recipients = useMemo(() => {
    const emails = new Set();
    rows.forEach((r) => {
      if (selected.has(r.id) && r.email) emails.add(r.email.trim().toLowerCase());
    });
    return Array.from(emails);
  }, [rows, selected]);

  const updateStatut = async (row, newStatut) => {
    const prev = row.statut;
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, statut: newStatut } : r)));
    const { error } = await supabase.from("inscriptions").update({ statut: newStatut }).eq("id", row.id);
    if (error) {
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, statut: prev } : r)));
      alert("Impossible de mettre à jour le statut.");
    }
  };

  const updateField = async (row, key, value) => {
    const prev = row[key];
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, [key]: value } : r)));

    const payload =
      key === "dossard" && value !== ""
        ? { dossard: Number(value) }
        : { [key]: value === "" ? null : value };

    const { error } = await supabase.from("inscriptions").update(payload).eq("id", row.id);

    if (error) {
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, [key]: prev } : r)));
      alert("Sauvegarde impossible.");
    }
  };

  const clearBibNumbers = async (scope = "selected") => {
    const ids = scope === "selected" ? Array.from(selected) : rows.map((r) => r.id);
    if (ids.length === 0) return alert("Aucun coureur concerné.");

    const confirm = window.confirm(`Effacer le dossard de ${ids.length} coureur(s) ?`);
    if (!confirm) return;

    try {
      const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, (i + 1) * n));
      const batches = chunks(ids, 500).map((part) => supabase.from("inscriptions").update({ dossard: null }).in("id", part));

      const res = await Promise.allSettled(batches);
      const allOk = res.every((r) => r.status === "fulfilled");

      if (allOk) alert("Dossards effacés.");
      else {
        console.warn("Certaines opérations ont échoué:", res);
        alert("Certains effacements ont échoué (voir console).");
      }

      load();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l’effacement des dossards.");
    }
  };

  /* ---------------------- Catégories d'âge : calcul ---------------------- */
  const handleComputeCategories = async () => {
    if (!formatId || rows.length === 0) return;
    setCategoriesLoading(true);
    setCategoriesError(null);
    setPreviewCategories([]);

    try {
      const [fedRes, catRes] = await Promise.all([
        supabase.from("federations").select("*").eq("code", federationCode).maybeSingle(),
        supabase
          .from("federation_categories")
          .select("*")
          .eq("federation_code", federationCode)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);

      if (fedRes.error) throw fedRes.error;
      if (catRes.error) throw catRes.error;

      const federation = fedRes.data;
      const categories = catRes.data || [];
      if (!federation) {
        setCategoriesError("Fédération introuvable.");
        return;
      }
      if (categories.length === 0) {
        setCategoriesError("Aucune catégorie active pour cette fédération.");
        return;
      }

      const eventDate = formatObj?.date ? new Date(formatObj.date) : new Date();

      const preview = rows.map((ins) => {
        const sex = ins.genre === "Homme" ? "M" : ins.genre === "Femme" ? "F" : "ALL";

        const cat = computeCategoryForAthlete({
          birthDate: ins.date_naissance,
          eventDate,
          sex,
          categories,
          federationSeasonStartMonth: federation.season_start_month || 1,
        });

        return {
          inscriptionId: ins.id,
          nom: ins.nom,
          prenom: ins.prenom,
          dossard: ins.dossard,
          birthYear: ins.date_naissance ? new Date(ins.date_naissance).getFullYear() : null,
          currentCode: ins.categorie_age_code || null,
          currentLabel: ins.categorie_age_label || null,
          newCode: cat ? cat.code : null,
          newLabel: cat ? cat.label : null,
        };
      });

      setPreviewCategories(preview);
    } catch (e) {
      console.error(e);
      setCategoriesError("Erreur lors du calcul des catégories.");
    } finally {
      setCategoriesLoading(false);
    }
  };

  const handleApplyCategories = async () => {
    if (!previewCategories.length) return;
    setCategoriesApplying(true);

    try {
      const withCat = previewCategories.filter((p) => p.newCode);
      for (const row of withCat) {
        const { error } = await supabase
          .from("inscriptions")
          .update({ federation_code: federationCode, categorie_age_code: row.newCode, categorie_age_label: row.newLabel })
          .eq("id", row.inscriptionId);

        if (error) console.error("Erreur update catégorie", row.inscriptionId, error);
      }

      await load();
      setPreviewCategories([]);
      alert("Catégories d’âge appliquées aux inscrits.");
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l’application des catégories.");
    } finally {
      setCategoriesApplying(false);
    }
  };

  const previewChangedCount = useMemo(
    () => previewCategories.filter((p) => p.newCode && p.newCode !== p.currentCode).length,
    [previewCategories]
  );

  const currentFed = federations.find((f) => f.code === federationCode);

  /* ---------------------- Export columns ---------------------- */
  const exportColumns = useMemo(() => {
    return columns.map((c, i) => {
      if (c.key === "options") {
        return { ...c, onToggle: (idx, vis) => toggleCol(idx, vis), accessor: (r) => optionsToString(r) };
      }
      return { ...c, onToggle: (idx, vis) => toggleCol(idx, vis) };
    });
  }, [columns, optionsToString]);

  const visibleColumns = exportColumns;

  const formatLabel = useMemo(() => {
    if (!formatObj) return formatId || "";
    return `${formatObj.nom}${formatObj.date ? ` — ${formatDate(formatObj.date)}` : ""}`;
  }, [formatObj, formatId]);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            {total} résultat{total > 1 ? "s" : ""} — {formatObj ? formatObj.nom : `Format ${formatId || "?"}`}{" "}
            {formatObj?.date ? `(${formatDate(formatObj.date)})` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowEmail(true)}
            disabled={recipients.length === 0}
            className={cls(
              "rounded-xl px-4 py-2 text-sm font-semibold",
              recipients.length === 0 ? "bg-neutral-300 text-neutral-600 cursor-not-allowed" : "bg-neutral-900 text-white hover:bg-black"
            )}
          >
            Email aux sélectionnés ({recipients.length})
          </button>

          <button
            onClick={() => setShowAddRunner(true)}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
          >
            + Ajouter un coureur
          </button>

          <button
            onClick={() => setShowExport(true)}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
          >
            Export CSV {selected.size > 0 ? `(${selected.size})` : "(tout)"}
          </button>

          <button onClick={() => load()} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">
            Rafraîchir
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-sm font-medium">Statut</label>
          <select value={statut} onChange={(e) => setStatut(e.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2">
            <option value="all">Tous</option>
            <option value="paye">Payé</option>
            <option value="en_attente">En attente</option>
            <option value="annule">Annulé</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium">Recherche</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            placeholder="Nom, prénom, email, équipe, licence, ville, dossard…"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Tri</label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-xl border border-neutral-300 px-3 py-2">
              <option value="created_at">Date</option>
              <option value="nom">Nom</option>
              <option value="statut">Statut</option>
            </select>
            <select value={sortDir} onChange={(e) => setSortDir(e.target.value)} className="rounded-xl border border-neutral-300 px-3 py-2">
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dossards / Waitlist / Catégories */}
      <div className="mb-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Dossards */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-neutral-800">Gestion des dossards</h2>
            <span className="text-xs text-neutral-500">
              {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
            </span>
          </div>

          <p className="text-xs text-neutral-500 mb-3">
            Attribuez / effacez les dossards sur le périmètre filtré.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowAssignBib(true)}
              className="rounded-xl border border-neutral-300 px-4 py-2 text-xs sm:text-sm hover:bg-neutral-50"
            >
              Attribuer des dossards {selected.size > 0 ? `(${selected.size})` : ""}
            </button>

            <div className="relative inline-flex">
              <button
                onClick={() => clearBibNumbers("selected")}
                className="rounded-l-xl border border-neutral-300 px-4 py-2 text-xs sm:text-sm hover:bg-neutral-50"
              >
                Effacer (sélection)
              </button>
              <button
                onClick={() => clearBibNumbers("all")}
                className="rounded-r-xl border-t border-b border-r border-neutral-300 px-3 py-2 text-xs sm:text-sm hover:bg-neutral-50"
              >
                Tout filtré
              </button>
            </div>
          </div>
        </div>

        {/* Waitlist */}
        <WaitlistPanel
          courseId={resolvedCourseId}
          formatId={formatId}
          formatLabel={formatLabel}
          enabled={!!formatObj?.waitlist_enabled}
          quotaAttente={formatObj?.quota_attente ?? null}
          onChanged={() => {
            // si un invite consomme / etc, tu peux rafraîchir d'autres choses ici
          }}
        />

        {/* Catégories */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-neutral-800">Catégories d&apos;âge</h2>
            {currentFed && (
              <span className="text-xs text-neutral-500">
                Saison : début <b>{currentFed.season_start_month || 1}/</b>
              </span>
            )}
          </div>

          <p className="text-xs text-neutral-500 mb-3">
            Pré-calculer puis appliquer les catégories d&apos;âge pour le format courant.
          </p>

          <div className="flex flex-wrap items-end gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Fédération</label>
              <select
                value={federationCode}
                onChange={(e) => setFederationCode(e.target.value)}
                className="rounded-xl border border-neutral-300 px-3 py-2 text-sm bg-white"
              >
                {federations.length === 0 && <option value="FFA">FFA - Athlétisme</option>}
                {federations.map((fed) => (
                  <option key={fed.code} value={fed.code}>
                    {fed.code} — {fed.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleComputeCategories}
              disabled={categoriesLoading || rows.length === 0}
              className={cls(
                "rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold",
                rows.length === 0 ? "bg-neutral-200 text-neutral-500 cursor-not-allowed" : "bg-neutral-900 text-white hover:bg-black",
                categoriesLoading && "opacity-70 cursor-wait"
              )}
            >
              {categoriesLoading ? "Calcul en cours…" : "Pré-calculer"}
            </button>

            <button
              type="button"
              onClick={handleApplyCategories}
              disabled={categoriesApplying || previewCategories.length === 0 || rows.length === 0}
              className={cls(
                "rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold",
                previewCategories.length === 0 ? "bg-neutral-200 text-neutral-500 cursor-not-allowed" : "bg-emerald-600 text-white hover:bg-emerald-500",
                categoriesApplying && "opacity-70 cursor-wait"
              )}
            >
              {categoriesApplying ? "Application…" : `Appliquer${previewChangedCount ? ` (${previewChangedCount} changés)` : ""}`}
            </button>
          </div>

          {categoriesError && <div className="mb-2 text-xs text-red-600">{categoriesError}</div>}

          {previewCategories.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-500">Prévisualisation sur {previewCategories.length} inscrit(s).</span>
                {previewChangedCount > 0 && (
                  <span className="text-xs font-medium text-emerald-700">{previewChangedCount} modifiée(s)</span>
                )}
              </div>

              <div className="max-h-56 overflow-auto border border-neutral-200 rounded-xl bg-neutral-50">
                <table className="min-w-full text-[11px]">
                  <thead className="bg-neutral-100 text-neutral-600">
                    <tr>
                      <th className="px-2 py-1 text-left">Dossard</th>
                      <th className="px-2 py-1 text-left">Nom</th>
                      <th className="px-2 py-1 text-left">Année</th>
                      <th className="px-2 py-1 text-left">Actuelle</th>
                      <th className="px-2 py-1 text-left">Proposée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewCategories.map((row) => (
                      <tr key={row.inscriptionId} className="border-t border-neutral-200">
                        <td className="px-2 py-1">{row.dossard || "—"}</td>
                        <td className="px-2 py-1">
                          {row.nom} {row.prenom}
                        </td>
                        <td className="px-2 py-1">{row.birthYear || "—"}</td>
                        <td className="px-2 py-1 text-neutral-500">
                          {row.currentCode ? `${row.currentCode} – ${row.currentLabel}` : "—"}
                        </td>
                        <td className="px-2 py-1 font-medium">
                          {row.newCode ? (
                            row.newCode === row.currentCode ? (
                              <span className="text-neutral-700">
                                {row.newCode} – {row.newLabel}
                              </span>
                            ) : (
                              <span className="text-emerald-700">
                                {row.newCode} – {row.newLabel}
                              </span>
                            )
                          ) : (
                            <span className="text-red-500">Aucune catégorie</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Colonnes visibles */}
      <div className="mb-3 rounded-xl border border-neutral-200 bg-white p-3">
        <div className="text-sm font-medium mb-2">Colonnes affichées</div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {columns.map((c, i) => (
            <label key={c.key} className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={c.visible} onChange={(e) => toggleCol(i, e.target.checked)} /> {c.label}
            </label>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-2 bg-neutral-50 border-b border-neutral-200 text-sm flex items-center gap-3">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={allChecked} onChange={toggleAll} />
            Tout sélectionner (page)
          </label>
          <div className="text-neutral-500">{selected.size} sélectionné(s)</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-600">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                </th>

                {columns
                  .filter((c) => c.visible)
                  .map((c) => (
                    <th
                      key={c.key}
                      className={cls("px-4 py-3", ["nom", "statut", "created_at"].includes(c.key) ? "cursor-pointer" : "")}
                      onClick={() => {
                        if (["nom", "statut", "created_at"].includes(c.key)) {
                          setSortBy(c.key);
                          setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        }
                      }}
                    >
                      {c.label}
                    </th>
                  ))}

                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3">
                      <div className="h-4 w-4 rounded bg-neutral-100" />
                    </td>
                    {columns
                      .filter((c) => c.visible)
                      .map((c, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 w-28 rounded bg-neutral-100" />
                        </td>
                      ))}
                    <td className="px-4 py-3">
                      <div className="h-6 w-20 rounded bg-neutral-100" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.filter((c) => c.visible).length + 2} className="px-4 py-6 text-center text-neutral-600">
                    Aucun résultat — ajustez vos filtres.
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50/60">
                    <td className="px-4 py-3 align-top">
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} />
                    </td>

                    {columns
                      .filter((c) => c.visible)
                      .map((c) => {
                        if (c.key === "options") {
                          return (
                            <td key={c.key} className="px-4 py-2 align-top">
                              {renderOptionsChips(r)}
                            </td>
                          );
                        }

                        const content = typeof c.accessor === "function" ? c.accessor(r) : r[c.key];

                        if (["numero_licence", "email", "team_name", "dossard"].includes(c.key)) {
                          return (
                            <td key={c.key} className="px-4 py-2 align-top">
                              <input
                                className="w-40 rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                                value={content ?? ""}
                                onChange={(e) => updateField(r, c.key, e.target.value)}
                                placeholder={c.key === "dossard" ? "—" : ""}
                              />
                            </td>
                          );
                        }

                        if (c.key === "statut") {
                          const v = (r.statut || "").toLowerCase() === "en attente" ? "en_attente" : r.statut || "";
                          return (
                            <td key={c.key} className="px-4 py-2 align-top">
                              <div className="flex items-center gap-2">
                                <StatusBadge status={r.statut} />
                                <select
                                  value={v}
                                  onChange={(e) => updateStatut(r, e.target.value)}
                                  className="rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                                >
                                  <option value="en_attente">En attente</option>
                                  <option value="paye">Payé</option>
                                  <option value="annule">Annulé</option>
                                </select>
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td key={c.key} className="px-4 py-2 align-top">
                            {content ?? "—"}
                          </td>
                        );
                      })}

                    <td className="px-4 py-2 align-top">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/details-coureur/${r.id}`}
                          className="inline-flex items-center rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                        >
                          Fiche
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-neutral-200 flex items-center justify-between text-sm">
          <div className="text-neutral-600">
            {total} résultat{total > 1 ? "s" : ""} • {PAGE_SIZE} par page
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
                console.error("organiser-send-emails", error);
                alert("Erreur d’envoi.");
              } else {
                alert(`Email envoyé à ${recipients.length} destinataire(s).`);
                setShowEmail(false);
              }
            })
            .catch(() => alert("Erreur d’envoi."));
        }}
      />

      <AddRunnerModal
        open={showAddRunner}
        onClose={() => setShowAddRunner(false)}
        onCreated={() => load()}
        courseId={resolvedCourseId}
        formatId={formatId}
      />

      <AssignBibModal
        open={showAssignBib}
        onClose={() => setShowAssignBib(false)}
        rows={rows}
        selectedIds={Array.from(selected)}
        onDone={() => {
          setShowAssignBib(false);
          load();
        }}
      />

      <ExportCsvModal
        open={showExport}
        onClose={() => setShowExport(false)}
        rows={selected.size > 0 ? rows.filter((r) => selected.has(r.id)) : rows}
        columns={visibleColumns}
        filenameBase={`inscriptions-${(formatObj?.nom || "format").toString().toLowerCase().replace(/\s+/g, "-")}`}
      />
    </div>
  );
}

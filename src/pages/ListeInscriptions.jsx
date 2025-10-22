// src/pages/ListeInscriptions.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
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
  const txt =
    s === "paye" ? "Payé" : s === "annule" ? "Annulé" : "En attente";
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
function GroupBadge({ status }) {
  const s = (status || "").toLowerCase();
  const map = {
    paye: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    en_attente: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    annule: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  };
  const txt =
    s === "paye"
      ? "Groupe payé"
      : s === "annule"
      ? "Groupe annulé"
      : "Groupe en attente";
  return (
    <span
      className={cls(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        map[s] || "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200"
      )}
    >
      {txt}
    </span>
  );
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
  }, [open]); // eslint-disable-line

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl ring-1 ring-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Envoyer un email</h3>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-800 text-sm"
          >
            Fermer
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-xs text-neutral-600">
            Destinataires&nbsp;: <b>{recipients.length}</b>{" "}
            adresse{recipients.length > 1 ? "s" : ""} unique
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
          <button
            onClick={onClose}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-white"
          >
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

/* ---------------------- Modale Ajout Manuel (riche) ---------------------- */
function AddInscriptionModal({ open, onClose, onCreated, formats, courseId }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    email: "",
    team_name: "",
    format_id: "",
    statut: "en_attente",
    genre: "",
    date_naissance: "",
    nationalite: "",
    telephone: "",
    adresse: "",
    code_postal: "",
    ville: "",
    pays: "",
    club: "",
    justificatif_type: "",
    justificatif_numero: "",
    contact_urgence_nom: "",
    contact_urgence_tel: "",
    dossard: "",
    nombre_repas: 0,
  });

  const formatSelected = useMemo(
    () => formats.find((f) => f.id === form.format_id),
    [formats, form.format_id]
  );

  useEffect(() => {
    if (!open) {
      setForm({
        nom: "",
        prenom: "",
        email: "",
        team_name: "",
        format_id: "",
        statut: "en_attente",
        genre: "",
        date_naissance: "",
        nationalite: "",
        telephone: "",
        adresse: "",
        code_postal: "",
        ville: "",
        pays: "",
        club: "",
        justificatif_type: "",
        justificatif_numero: "",
        contact_urgence_nom: "",
        contact_urgence_tel: "",
        dossard: "",
        nombre_repas: 0,
      });
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
        course_id: courseId || fmt?.course_id || null,
        genre: form.genre || null,
        date_naissance: form.date_naissance || null,
        nationalite: form.nationalite || null,
        telephone: form.telephone || null,
        adresse: form.adresse || null,
        code_postal: form.code_postal || null,
        ville: form.ville || null,
        pays: form.pays || null,
        club: form.club || null,
        justificatif_type: form.justificatif_type || null,
        justificatif_numero: form.justificatif_numero || null,
        contact_urgence_nom: form.contact_urgence_nom || null,
        contact_urgence_tel: form.contact_urgence_tel || null,
        dossard: form.dossard ? Number(form.dossard) : null,
        // Bloc repas (si pris en charge côté base)
        prix_total_repas:
          fmt?.propose_repas && fmt?.prix_repas != null
            ? Number(form.nombre_repas || 0) * Number(fmt.prix_repas || 0)
            : null,
        nombre_repas:
          fmt?.propose_repas ? Number(form.nombre_repas || 0) : null,
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
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl ring-1 ring-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Ajouter un coureur</h3>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-800 text-sm"
          >
            Fermer
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="text-sm font-medium">Format *</label>
            <select
              name="format_id"
              value={form.format_id}
              onChange={onChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            >
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
            <select
              name="statut"
              value={form.statut}
              onChange={onChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            >
              <option value="en_attente">En attente</option>
              <option value="paye">Payé</option>
              <option value="annule">Annulé</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Équipe</label>
            <input
              name="team_name"
              value={form.team_name}
              onChange={onChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
              placeholder="Team / Relais"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Nom *</label>
            <input
              name="nom"
              value={form.nom}
              onChange={onChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Prénom *</label>
            <input
              name="prenom"
              value={form.prenom}
              onChange={onChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              name="email"
              value={form.email}
              onChange={onChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
              placeholder="ex: nom@domaine.com"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Genre</label>
            <select
              name="genre"
              value={form.genre}
              onChange={onChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            >
              <option value="">—</option>
              <option value="F">F</option>
              <option value="M">M</option>
              <option value="X">X</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Date de naissance</label>
            <input
              type="date"
              name="date_naissance"
              value={form.date_naissance}
              onChange={onChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Nationalité</label>
            <input
              name="nationalite"
              value={form.nationalite}
              onChange={onChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Téléphone</label>
            <input
              name="telephone"
              value={form.telephone}
              onChange={onChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Adresse</label>
            <input
              name="adresse"
              value={form.adresse}
              onChange={onChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Code postal</label>
            <input
              name="code_postal"
              value={form.code_postal}
              onChange={onChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Ville</label>
            <input
              name="ville"
              value={form.ville}
              onChange={onChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Pays</label>
            <input
              name="pays"
              value={form.pays}
              onChange={onChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Club</label>
            <input
              name="club"
              value={form.club}
              onChange={onChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Justificatif (type)</label>
            <input
              name="justificatif_type"
              value={form.justificatif_type}
              onChange={onChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
              placeholder="Licence / PPS"
            />
          </div>
          <div>
            <label className="text-sm font-medium">N° licence / PPS</label>
            <input
              name="justificatif_numero"
              value={form.justificatif_numero}
              onChange={onChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Contact urgence (nom)</label>
            <input
              name="contact_urgence_nom"
              value={form.contact_urgence_nom}
              onChange={onChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Contact urgence (téléphone)</label>
            <input
              name="contact_urgence_tel"
              value={form.contact_urgence_tel}
              onChange={onChange}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Dossard</label>
            <input
              name="dossard"
              value={form.dossard}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d]/g, "");
                setForm((f) => ({ ...f, dossard: v }));
              }}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
              placeholder="ex: 125"
              inputMode="numeric"
            />
          </div>

          {formatSelected?.propose_repas && (
            <>
              <div>
                <label className="text-sm font-medium">
                  Nombre de repas {formatSelected?.prix_repas != null ? `(× ${Number(formatSelected.prix_repas).toFixed(2)} €)` : ""}
                </label>
                <input
                  name="nombre_repas"
                  value={form.nombre_repas}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      nombre_repas: e.target.value.replace(/[^\d]/g, ""),
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                  placeholder="0"
                  inputMode="numeric"
                />
              </div>
              <div className="md:col-span-2 text-sm text-neutral-600 flex items-end">
                Total repas estimé&nbsp;:
                <b className="ml-1">
                  {(() => {
                    const n = Number(form.nombre_repas || 0);
                    const pu = Number(formatSelected?.prix_repas || 0);
                    return (n * pu).toFixed(2) + " €";
                  })()}
                </b>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-white"
          >
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

/* ---------------------- Modale Export CSV (par format) ---------------------- */
function ExportCsvModal({ open, onClose, rows, groupsById, optionsById, optionLabelById, filenameBase }) {
  const [cols, setCols] = useState([
    "id",
    "created_at",
    "nom",
    "prenom",
    "email",
    "team_name",
    "statut",
    "group_status",
    "dossard",
    "licence",
    "club",
    "telephone",
    "adresse",
    "code_postal",
    "ville",
    "pays",
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
    { key: "dossard", label: "Dossard" },
    { key: "licence", label: "Licence/PPS" },
    { key: "club", label: "Club" },
    { key: "telephone", label: "Téléphone" },
    { key: "adresse", label: "Adresse" },
    { key: "code_postal", label: "Code postal" },
    { key: "ville", label: "Ville" },
    { key: "pays", label: "Pays" },
    { key: "options", label: "Options confirmées" },
  ];

  useEffect(() => {
    if (!open) {
      setCols([
        "id",
        "created_at",
        "nom",
        "prenom",
        "email",
        "team_name",
        "statut",
        "group_status",
        "dossard",
        "licence",
        "club",
        "telephone",
        "adresse",
        "code_postal",
        "ville",
        "pays",
        "options",
      ]);
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
    const header = cols
      .map((k) => csvEscape(allCols.find((c) => c.key === k)?.label || k))
      .join(";");

    const lines = rows.map((r) => {
      const group = r.member_of_group_id ? groupsById.get(r.member_of_group_id) : null;
      const opts = optionsById.get(r.id) || [];
      const optsTxt = opts.length
        ? opts
            .map((o) => {
              const label = optionLabelById.get(o.option_id) || `#${String(o.option_id).slice(0, 8)}`;
              return `${label}×${o.quantity}`;
            })
            .join(", ")
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
        dossard: r.dossard ?? "—",
        licence: r.justificatif_numero || "—",
        club: r.club || "—",
        telephone: r.telephone || "—",
        adresse: r.adresse || "—",
        code_postal: r.code_postal || "—",
        ville: r.ville || "—",
        pays: r.pays || "—",
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
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-800 text-sm"
          >
            Fermer
          </button>
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
          <button
            onClick={onClose}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-white"
          >
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
 // ...
const { courseId: courseIdParam } = useParams();
const [searchParams, setSearchParams] = useSearchParams();
const courseId = courseIdParam || searchParams.get("courseId") || null;
// ...


  // Formats + filtre format (verrouillable par ?formatId=)
  const [formats, setFormats] = useState([]);
  const initialFormatId = searchParams.get("formatId") || "";
  const lockedFormat = !!initialFormatId;
  const [formatId, setFormatId] = useState(initialFormatId);

  // Filtres globaux
  const [statut, setStatut] = useState(searchParams.get("statut") || "all"); // all | paye | en_attente | annule
  const [q, setQ] = useState(searchParams.get("q") || "");
  const debouncedQ = useDebounced(q, 400);

  // Tri (appliqué par section, même réglage)
  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") || "created_at"); // 'created_at' | 'nom' | 'statut'
  const [sortDir, setSortDir] = useState(searchParams.get("sortDir") || "desc"); // 'asc' | 'desc'

  // Données
  const [loading, setLoading] = useState(true);
  const [inscriptions, setInscriptions] = useState([]); // toutes les lignes matching filtres
  const [total, setTotal] = useState(0);

  // Enrichissements
  const [groupMap, setGroupMap] = useState(new Map()); // groupId -> group row
  const [optionsMap, setOptionsMap] = useState(new Map()); // inscriptionId -> options[]
  const [optionLabelMap, setOptionLabelMap] = useState(new Map()); // optionId -> label

  // Pagination PAR FORMAT (clé = formatId | '__nofmt__')
  const PAGE_SIZE = 25;
  const [pageByFormat, setPageByFormat] = useState({}); // { [key]: number }

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

  /* -------------------------- Charger Formats -------------------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const query = supabase
        .from("formats")
        .select("id, nom, date, course_id, nb_max_coureurs, propose_repas, prix_repas")
        .order("date", { ascending: true });

      const { data, error } = courseId
        ? await query.eq("course_id", courseId)
        : await query;

      if (!alive) return;
      if (!error && data) setFormats(data);
    })();
    return () => {
      alive = false;
    };
  }, [courseId]);

  const targetedFormatIds = useMemo(() => {
    if (formatId) return [formatId];
    return formats.map((f) => f.id);
  }, [formats, formatId]);

  const currentFormatLabel = useMemo(() => {
    const f = formats.find((x) => x.id === formatId);
    if (!f) return formatId ? `Format ${formatId}` : "Tous les formats";
    return `${f.nom}${f.date ? ` — ${f.date}` : ""}`;
  }, [formats, formatId]);

  /* ---------------------- Charger Inscriptions (une fois) ---------------------- */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("inscriptions")
        .select(
          "id, created_at, nom, prenom, email, statut, format_id, member_of_group_id, team_name, course_id, dossard, justificatif_numero, club, telephone, adresse, code_postal, ville, pays",
          { count: "exact" }
        );

    //  if (courseId) query = query.eq("course_id", courseId);
      if (targetedFormatIds.length > 0) {
        query = query.in("format_id", targetedFormatIds);
      } else {
        // aucun format (encore) -> vide
        setInscriptions([]);
        setTotal(0);
        setOptionsMap(new Map());
        setOptionLabelMap(new Map());
        setGroupMap(new Map());
        setLoading(false);
        return;
      }

      if (statut && statut !== "all") {
        // normaliser "en attente" vers "en_attente"
        const normalized = statut === "en attente" ? "en_attente" : statut;
        query = query.eq("statut", normalized);
      }

      if (debouncedQ) {
        // recherche large (si colonnes absentes, PostgREST ignore silencieusement)
        query = query.or(
          [
            `nom.ilike.%${debouncedQ}%`,
            `prenom.ilike.%${debouncedQ}%`,
            `email.ilike.%${debouncedQ}%`,
            `team_name.ilike.%${debouncedQ}%`,
            `justificatif_numero.ilike.%${debouncedQ}%`,
            `club.ilike.%${debouncedQ}%`,
            `telephone.ilike.%${debouncedQ}%`,
            `adresse.ilike.%${debouncedQ}%`,
            `ville.ilike.%${debouncedQ}%`,
            `pays.ilike.%${debouncedQ}%`,
          ].join(",")
        );
      }

      // tri global (on re-triera par section aussi si besoin)
      if (sortBy === "nom") {
        query = query.order("nom", {
          ascending: sortDir === "asc",
          nullsFirst: false,
        });
      } else if (sortBy === "statut") {
        query = query.order("statut", {
          ascending: sortDir === "asc",
          nullsFirst: false,
        });
      } else {
        query = query.order("created_at", {
          ascending: sortDir === "asc",
          nullsFirst: false,
        });
      }

      const { data, error, count } = await query;
      if (error) throw error;

      setInscriptions(data || []);
      setTotal(count || 0);

      const ids = (data || []).map((r) => r.id);
      const grpIds = [
        ...new Set(
          (data || [])
            .map((r) => r.member_of_group_id)
            .filter(Boolean)
        ),
      ];

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
                const l =
                  d.nom || d.name || d.label || `#${String(d.id).slice(0, 8)}`;
                mm.set(d.id, l);
              });
              setOptionLabelMap(mm);
            } else {
              const mm = new Map();
              optionIds.forEach((id) =>
                mm.set(id, `#${String(id).slice(0, 8)}`)
              );
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
  }, [courseId, targetedFormatIds, statut, debouncedQ, sortBy, sortDir]);

  // Sync URL avec filtres
  useEffect(() => {
    updateQueryString({
      formatId,
      statut,
      q,
      sortBy,
      sortDir,
    });
  }, [formatId, statut, q, sortBy, sortDir]); // eslint-disable-line

  // Reset pagination par format quand filtres changent
  useEffect(() => {
    setPageByFormat({});
  }, [formatId, statut, debouncedQ, sortBy, sortDir]);

  useEffect(() => {
    load();
  }, [load]);

  /* ----------------------------- Groupage par format ----------------------------- */
  const byFormat = useMemo(() => {
    const map = new Map(); // formatId -> rows[]
    for (const r of inscriptions) {
      const fid = r.format_id || "__nofmt__";
      if (!map.has(fid)) map.set(fid, []);
      map.get(fid).push(r);
    }
    // tri par section (au cas où l'ordre global n'ait pas suffi après filtrage)
    const sorters = {
      created_at: (a, b) =>
        sortDir === "asc"
          ? new Date(a.created_at) - new Date(b.created_at)
          : new Date(b.created_at) - new Date(a.created_at),
      nom: (a, b) => {
        const an = (a.nom || "").toLowerCase();
        const bn = (b.nom || "").toLowerCase();
        if (an < bn) return sortDir === "asc" ? -1 : 1;
        if (an > bn) return sortDir === "asc" ? 1 : -1;
        return 0;
      },
      statut: (a, b) => {
        const an = (a.statut || "").toLowerCase();
        const bn = (b.statut || "").toLowerCase();
        if (an < bn) return sortDir === "asc" ? -1 : 1;
        if (an > bn) return sortDir === "asc" ? 1 : -1;
        return 0;
      },
    };
    const sorter = sorters[sortBy] || sorters.created_at;
    for (const [k, arr] of map.entries()) {
      map.set(k, [...arr].sort(sorter));
    }
    return map;
  }, [inscriptions, sortBy, sortDir]);

  // Sélection par format
  const [selectedByFormat, setSelectedByFormat] = useState({}); // { [formatId]: Set(ids) }
  const resetSelection = useCallback(() => setSelectedByFormat({}), []);
  useEffect(() => {
    // reset sélection si on recharge
    resetSelection();
  }, [inscriptions.length]); // eslint-disable-line

  const setSelectedForFormat = (fid, updater) => {
    setSelectedByFormat((prev) => {
      const cur = new Set(prev[fid] || []);
      const next = updater(cur);
      return { ...prev, [fid]: next };
    });
  };

  /* ----------------------------- Actions ----------------------------- */
  const handleSendEmails = async (emails, { subject, html }) => {
    try {
      if (!emails || emails.length === 0) {
        alert("Aucun destinataire sélectionné.");
        return;
      }
      if (!subject?.trim()) {
        alert("Le sujet est requis.");
        return;
      }
      if (!html?.trim()) {
        alert("Le message est requis.");
        return;
      }
      const { error } = await supabase.functions.invoke("organiser-send-emails", {
        body: { subject, html, to: emails },
      });
      if (error) {
        console.error("organiser-send-emails error", error);
        alert(
          "Erreur d’envoi des emails. (Vérifiez la fonction Edge et les en-têtes CORS/allowed-origins.)"
        );
        return;
      }
      alert(`Email envoyé à ${emails.length} destinataire(s).`);
    } catch (e) {
      console.error("SEND_EMAIL_FATAL", e);
      alert("Erreur d’envoi.");
    }
  };

  const handleUpdateStatut = async (id, newStatut) => {
    try {
      const { error } = await supabase
        .from("inscriptions")
        .update({ statut: newStatut })
        .eq("id", id);
      if (error) throw error;
      setInscriptions((rs) =>
        rs.map((r) => (r.id === id ? { ...r, statut: newStatut } : r))
      );
    } catch (e) {
      console.error("UPDATE_STATUT_ERROR", e);
      alert("Impossible de mettre à jour le statut.");
    }
  };

  const handleUpdateDossard = async (id, newDossard) => {
    try {
      const val = newDossard === "" ? null : Number(newDossard);
      if (val != null && (Number.isNaN(val) || val < 0)) {
        alert("Dossard invalide.");
        return;
      }
      const { error } = await supabase
        .from("inscriptions")
        .update({ dossard: val })
        .eq("id", id);
      if (error) throw error;
      setInscriptions((rs) =>
        rs.map((r) => (r.id === id ? { ...r, dossard: val } : r))
      );
    } catch (e) {
      console.error("UPDATE_DOSSARD_ERROR", e);
      alert("Impossible de mettre à jour le dossard.");
    }
  };

  /* ----------------------------- UI Helpers ----------------------------- */
  const changeSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir(col === "created_at" ? "desc" : "asc");
    }
  };

  const pageOf = (fid) => pageByFormat[fid] || 1;
  const setPageOf = (fid, n) =>
    setPageByFormat((p) => ({ ...p, [fid]: Math.max(1, n) }));

  const sectionMeta = (fid, arr) => {
    const totalRows = arr.length;
    const pageCount = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
    const page = Math.min(pageOf(fid), pageCount);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE;
    return { page, pageCount, from, to, totalRows };
  };

  const formatName = (fid) => {
    const f = formats.find((x) => x.id === fid);
    if (!f) return "Format inconnu";
    return `${f.nom}${f.date ? ` — ${f.date}` : ""}`;
  };

  const selectedRowsFor = (fid, arr) => {
    const set = selectedByFormat[fid] || new Set();
    return arr.filter((r) => set.has(r.id));
  };

  /* ----------------------------- Rendu ----------------------------- */
  const allSections = useMemo(() => {
    const keys = targetedFormatIds.length ? targetedFormatIds : [];
    // Si un format est verrouillé mais n’existe pas encore (chargement), on n’affiche rien
    return keys.filter((fid) => byFormat.has(fid));
  }, [byFormat, targetedFormatIds]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header global */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          {courseId ? (
            <Link
              to={`/courses/${courseId}`}
              className="text-sm text-neutral-500 hover:text-neutral-800"
            >
              ← Retour à la course
            </Link>
          ) : (
            <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-800">
              ← Accueil
            </Link>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">Inscriptions</h1>
          <p className="text-neutral-600 mt-1">
            {total} résultat{total > 1 ? "s" : ""}
          </p>
        </div>

        {/* Filtres globaux */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => load()}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
          >
            Rafraîchir
          </button>
        </div>
      </div>

      {/* Filtres ligne 2 */}
      <div className="mb-4 grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* Format : verrouillé (via ?formatId=) ou sélecteur */}
        <div>
          <label className="block text-sm font-medium">Format</label>
          {lockedFormat ? (
            <div className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 bg-neutral-50 text-neutral-800 flex items-center justify-between">
              <span>{currentFormatLabel}</span>
              <span className="text-xs rounded-full bg-neutral-200 px-2 py-0.5">
                verrouillé
              </span>
            </div>
          ) : (
            <select
              value={formatId}
              onChange={(e) => {
                setFormatId(e.target.value);
              }}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            >
              <option value="">Tous les formats</option>
              {formats.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom} {f.date ? `— ${f.date}` : ""}
                </option>
              ))}
            </select>
          )}
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
            placeholder="Nom, prénom, email, équipe, licence, club, téléphone…"
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

      {/* Sections par format */}
      {loading && (
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden mb-6">
          <div className="p-6 text-neutral-600">Chargement…</div>
        </div>
      )}

      {!loading && allSections.length === 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="p-6 text-neutral-600">Aucun format disponible.</div>
        </div>
      )}

      {!loading &&
        allSections.map((fid) => {
          const rows = byFormat.get(fid) || [];
          const meta = sectionMeta(fid, rows);
          const pageRows = rows.slice(meta.from, meta.to);
          const selectedSet = selectedByFormat[fid] || new Set();
          const allChecked = pageRows.length > 0 && pageRows.every((r) => selectedSet.has(r.id));
          const selectedRows = selectedRowsFor(fid, rows);

          const f = formats.find((x) => x.id === fid);
          const filenameBase = `inscriptions-${(f?.nom || "format").toString().toLowerCase().replace(/\s+/g, "-")}`;

          const toggleRow = (id) =>
            setSelectedForFormat(fid, (cur) => {
              const next = new Set(cur);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });

          const toggleAll = () =>
            setSelectedForFormat(fid, (cur) => {
              const next = new Set(cur);
              if (allChecked) {
                pageRows.forEach((r) => next.delete(r.id));
              } else {
                pageRows.forEach((r) => next.add(r.id));
              }
              return next;
            });

          const recipients = Array.from(
            new Set(
              selectedRows
                .map((r) => (r.email || "").trim().toLowerCase())
                .filter(Boolean)
            )
          );

          const [showEmail, setShowEmail] = [
            sectionShowEmailState(f),
            sectionSetShowEmailState(f),
          ];

          const [showAdd, setShowAdd] = [
            sectionShowAddState(f),
            sectionSetShowAddState(f),
          ];

          const [showExport, setShowExport] = [
            sectionShowExportState(f),
            sectionSetShowExportState(f),
          ];

          return (
            <SectionStateBridge key={fid}>
              {/* Entête de section */}
              <div className="mb-6 rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-neutral-700">
                      {formatName(fid)}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {rows.length} inscrit{rows.length > 1 ? "s" : ""} •{" "}
                      {PAGE_SIZE} par page
                      {f?.nb_max_coureurs ? (
                        <>
                          {" "}
                          • capacité&nbsp;: {f.nb_max_coureurs}
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setShowEmail(true)}
                      disabled={recipients.length === 0}
                      className={cls(
                        "rounded-xl px-3 py-2 text-xs font-semibold",
                        recipients.length === 0
                          ? "bg-neutral-300 text-neutral-600 cursor-not-allowed"
                          : "bg-neutral-900 text-white hover:bg-black"
                      )}
                    >
                      Email aux sélectionnés ({recipients.length})
                    </button>

                    <button
                      onClick={() => setShowAdd(true)}
                      className="rounded-xl border border-neutral-300 px-3 py-2 text-xs hover:bg-neutral-50"
                    >
                      + Ajouter un coureur
                    </button>

                    <button
                      onClick={() => {
                        if (selectedRows.length === 0) {
                          // Autoriser l’export de tout le tableau si rien n’est coché
                          setShowExport(true);
                        } else {
                          setShowExport(true);
                        }
                      }}
                      className="rounded-xl border border-neutral-300 px-3 py-2 text-xs hover:bg-neutral-50"
                    >
                      Export CSV{" "}
                      {selectedRows.length > 0 ? `(${selectedRows.length})` : "(tout)"}
                    </button>

                    <button
                      onClick={() => load()}
                      className="rounded-xl border border-neutral-300 px-3 py-2 text-xs hover:bg-neutral-50"
                    >
                      Rafraîchir
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-neutral-600">
                        <th className="px-4 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            onChange={toggleAll}
                          />
                        </th>
                        <th
                          className="px-4 py-3 cursor-pointer"
                          onClick={() => changeSort("nom")}
                        >
                          Nom
                        </th>
                        <th className="px-4 py-3">Prénom</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Équipe</th>
                        <th className="px-4 py-3">Groupe</th>
                        <th
                          className="px-4 py-3 cursor-pointer"
                          onClick={() => changeSort("statut")}
                        >
                          Statut
                        </th>
                        <th className="px-4 py-3">Dossard</th>
                        <th className="px-4 py-3">Options</th>
                        <th
                          className="px-4 py-3 cursor-pointer"
                          onClick={() => changeSort("created_at")}
                        >
                          Créé le
                        </th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pageRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={11}
                            className="px-4 py-6 text-center text-neutral-600"
                          >
                            Aucun résultat — ajustez vos filtres.
                          </td>
                        </tr>
                      ) : (
                        pageRows.map((r) => {
                          const group = r.member_of_group_id
                            ? groupMap.get(r.member_of_group_id)
                            : null;
                          const opts = optionsMap.get(r.id) || [];
                          const optBadges = opts.length ? (
                            <div className="flex flex-wrap gap-1.5">
                              {opts.map((o, i) => {
                                const label =
                                  optionLabelMap.get(o.option_id) ||
                                  `#${String(o.option_id).slice(0, 8)}`;
                                return (
                                  <span
                                    key={o.option_id + i}
                                    className="inline-flex items-center rounded-full bg-neutral-100 text-neutral-800 px-2 py-0.5 text-xs ring-1 ring-neutral-200"
                                  >
                                    {label}
                                    {o.quantity > 1 ? ` ×${o.quantity}` : ""}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-neutral-500">—</span>
                          );

                          const detailUrl = r.id
                            ? `/inscription/${encodeURIComponent(r.id)}`
                            : "#";

                          return (
                            <tr key={r.id} className="hover:bg-neutral-50/60">
                              <td className="px-4 py-3 align-top">
                                <input
                                  type="checkbox"
                                  checked={selectedSet.has(r.id)}
                                  onChange={() => toggleRow(r.id)}
                                />
                              </td>
                              <td className="px-4 py-3 align-top font-medium">
                                {r.nom || "—"}
                              </td>
                              <td className="px-4 py-3 align-top">
                                {r.prenom || "—"}
                              </td>
                              <td className="px-4 py-3 align-top">
                                {r.email ? (
                                  <a
                                    className="text-neutral-900 hover:underline"
                                    href={`mailto:${r.email}`}
                                  >
                                    {r.email}
                                  </a>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="px-4 py-3 align-top">
                                {r.team_name || "—"}
                              </td>
                              <td className="px-4 py-3 align-top">
                                {group ? (
                                  <GroupBadge status={group.statut} />
                                ) : (
                                  <span className="text-neutral-500">—</span>
                                )}
                              </td>

                              <td className="px-4 py-3 align-top">
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={r.statut} />
                                  <select
                                    value={
                                      (r.statut || "").toLowerCase() ===
                                      "en attente"
                                        ? "en_attente"
                                        : r.statut || ""
                                    }
                                    onChange={(e) =>
                                      handleUpdateStatut(r.id, e.target.value)
                                    }
                                    className="rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                                  >
                                    <option value="en_attente">
                                      En attente
                                    </option>
                                    <option value="paye">Payé</option>
                                    <option value="annule">Annulé</option>
                                  </select>
                                </div>
                              </td>

                              <td className="px-4 py-3 align-top">
                                <input
                                  className="w-24 rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                                  value={r.dossard ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value.replace(/[^\d]/g, "");
                                    setInscriptions((rs) =>
                                      rs.map((x) =>
                                        x.id === r.id ? { ...x, dossard: v } : x
                                      )
                                    );
                                  }}
                                  onBlur={(e) =>
                                    handleUpdateDossard(r.id, e.target.value)
                                  }
                                  placeholder="—"
                                  inputMode="numeric"
                                />
                              </td>

                              <td className="px-4 py-3 align-top text-neutral-700">
                                {optBadges}
                              </td>
                              <td className="px-4 py-3 align-top text-neutral-600">
                                {formatDateTime(r.created_at)}
                              </td>

                              <td className="px-4 py-3 align-top">
                                <div className="flex flex-wrap gap-2">
                                  <Link
                                    to={detailUrl}
                                    onClick={(e) => {
                                      if (detailUrl === "#") e.preventDefault();
                                    }}
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

                {/* Footer section : pagination */}
                <div className="px-4 py-3 border-t border-neutral-200 flex items-center justify-between text-sm">
                  <div className="text-neutral-600">
                    {meta.totalRows} résultat{meta.totalRows > 1 ? "s" : ""} •{" "}
                    {PAGE_SIZE} par page
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPageOf(fid, meta.page - 1)}
                      disabled={meta.page <= 1}
                      className={cls(
                        "rounded-lg border px-3 py-1.5",
                        meta.page <= 1
                          ? "text-neutral-400 border-neutral-200 cursor-not-allowed"
                          : "hover:bg-neutral-50"
                      )}
                    >
                      Précédent
                    </button>
                    <span className="text-neutral-600">
                      Page {meta.page} / {meta.pageCount}
                    </span>
                    <button
                      onClick={() => setPageOf(fid, meta.page + 1)}
                      disabled={meta.page >= meta.pageCount}
                      className={cls(
                        "rounded-lg border px-3 py-1.5",
                        meta.page >= meta.pageCount
                          ? "text-neutral-400 border-neutral-200 cursor-not-allowed"
                          : "hover:bg-neutral-50"
                      )}
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              </div>

              {/* Modales sectionnelles */}
              <EmailModal
                open={showEmail.value}
                onClose={() => showEmail.set(false)}
                recipients={recipients}
                onSend={(payload) => {
                  handleSendEmails(recipients, payload);
                  showEmail.set(false);
                }}
              />

              <AddInscriptionModal
                open={showAdd.value}
                onClose={() => showAdd.set(false)}
                onCreated={() => load()}
                formats={formatId ? formats.filter((x) => x.id === fid) : formats}
                courseId={courseId}
              />

              <ExportCsvModal
                open={showExport.value}
                onClose={() => showExport.set(false)}
                rows={selectedRows.length > 0 ? selectedRows : rows}
                groupsById={groupMap}
                optionsById={optionsMap}
                optionLabelById={optionLabelMap}
                filenameBase={filenameBase}
              />
            </SectionStateBridge>
          );
        })}
    </div>
  );
}

/* ------------- Petites aides pour avoir un état modal par section ------------- */
/** Bridge de contexte local pour stocker 3 modales par section (email/add/export) */
function SectionStateBridge({ children }) {
  const [showEmail, setShowEmail] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showExport, setShowExport] = useState(false);

  return (
    <SectionStateCtx.Provider
      value={{
        showEmail: { value: showEmail, set: setShowEmail },
        showAdd: { value: showAdd, set: setShowAdd },
        showExport: { value: showExport, set: setShowExport },
      }}
    >
      {children}
    </SectionStateCtx.Provider>
  );
}

const SectionStateCtx = React.createContext(null);
function useSectionState() {
  const ctx = React.useContext(SectionStateCtx);
  if (!ctx) {
    throw new Error("useSectionState must be used within SectionStateBridge");
  }
  return ctx;
}
function sectionShowEmailState() {
  return useSectionState().showEmail;
}
function sectionSetShowEmailState() {
  return useSectionState().showEmail;
}
function sectionShowAddState() {
  return useSectionState().showAdd;
}
function sectionSetShowAddState() {
  return useSectionState().showAdd;
}
function sectionShowExportState() {
  return useSectionState().showExport;
}
function sectionSetShowExportState() {
  return useSectionState().showExport;
}

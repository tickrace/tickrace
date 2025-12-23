// src/pages/ChecklistAssistant.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabase";
import {
  CheckCircle2,
  ClipboardList,
  Save,
  Loader2,
  AlertTriangle,
  NotebookPen,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
  ArrowLeft,
} from "lucide-react";

/* =========================
   Checklist V1 (modifiable)
   ========================= */
const DEFAULT_CHECKLIST = [
  {
    section: "Administratif",
    items: [
      { key: "admin.declaration", label: "Déclarations / autorisations (mairie, préf., propriétaires, ONF…)" },
      { key: "admin.assurance", label: "Assurance RC organisateur vérifiée" },
      { key: "admin.conventions", label: "Conventions / arrêtés / occupation domaine public (si nécessaire)" },
      { key: "admin.partenaires", label: "Partenaires / prestataires confirmés (chrono, secours, ravitos…)" },
    ],
  },
  {
    section: "Sécurité",
    items: [
      { key: "safety.plan", label: "Plan sécurité / procédure secours / numéros utiles" },
      { key: "safety.signaleurs", label: "Signaleurs positionnés + consignes transmises" },
      { key: "safety.zones_blanches", label: "Zones blanches identifiées + plan B (radio / relais / points fixes)" },
      { key: "safety.medical", label: "Dispositif médical validé (secours / médecin / ambulance si besoin)" },
      { key: "safety.traversees", label: "Traversées / voies publiques sécurisées (arrêté, signalisation, signaleurs)" },
    ],
  },
  {
    section: "Parcours / Logistique",
    items: [
      { key: "logistics.balisage", label: "Balisage prêt + équipe débalisage + sacs déchets" },
      { key: "logistics.ravitos", label: "Ravitaillements (matériel, eau, nourriture, bénévoles) OK" },
      { key: "logistics.dossards", label: "Retrait dossards organisé (lieu/horaires/équipe)" },
      { key: "logistics.sas_depart", label: "Zone départ/arrivée (sono, arches, barrières, flux) OK" },
      { key: "logistics.wc", label: "WC / propreté / gestion déchets OK" },
      { key: "logistics.benevoles", label: "Briefing bénévoles + planning / contacts" },
    ],
  },
  {
    section: "Communication",
    items: [
      { key: "comms.infos_participants", label: "Infos participants envoyées (horaires, accès, matériel…)" },
      { key: "comms.reseaux", label: "Communication (réseaux, visuels, post J-7 / J-1 / jour J)" },
      { key: "comms.acces", label: "Accès / parkings / navettes communiqués (si applicable)" },
    ],
  },
  {
    section: "Après-course",
    items: [
      { key: "post.results", label: "Publication résultats / classement (si applicable)" },
      { key: "post.cleanup", label: "Nettoyage / débalisage terminé" },
      { key: "post.feedback", label: "Debrief orga + points d’amélioration notés" },
      { key: "post.merci", label: "Merci bénévoles / partenaires (message + photos)" },
    ],
  },
];

/* =========================
   Utils
   ========================= */
function fmtTimeFR(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
function fmtDateFR(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}
function safeLower(s) {
  return (s ?? "").toString().toLowerCase();
}

/* =========================
   UI Helpers
   ========================= */
function Pill({ children, tone = "neutral" }) {
  const cls =
    tone === "green"
      ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
      : tone === "orange"
      ? "bg-orange-50 text-orange-800 ring-1 ring-orange-200"
      : "bg-neutral-100 text-neutral-800 ring-1 ring-neutral-200";
  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{children}</span>;
}

function ProgressBar({ pct }) {
  const w = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden ring-1 ring-neutral-200">
      <div className="h-full rounded-full bg-neutral-900" style={{ width: `${w}%` }} />
    </div>
  );
}

function IconBtn({ onClick, title, children, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        "inline-flex items-center justify-center rounded-xl border px-2.5 py-2 text-sm font-semibold",
        disabled
          ? "border-neutral-200 bg-neutral-100 text-neutral-400 cursor-not-allowed"
          : "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* =========================
   Page
   ========================= */
export default function ChecklistAssistant() {
  const { courseId } = useParams();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);

  const [items, setItems] = useState({});
  const [notesByFormat, setNotesByFormat] = useState({});
  const [globalNote, setGlobalNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(() => {
    const m = {};
    DEFAULT_CHECKLIST.forEach((s) => (m[s.section] = false));
    return m;
  });

  const [activePane, setActivePane] = useState("checklist"); // "checklist" | "notes"
  const [activeFormatId, setActiveFormatId] = useState(null);

  const [toast, setToast] = useState("");

  const saveTimer = useRef(null);
  const toastTimer = useRef(null);

  const allKeys = useMemo(() => {
    const keys = [];
    DEFAULT_CHECKLIST.forEach((sec) => sec.items.forEach((it) => keys.push(it.key)));
    return keys;
  }, []);

  const progress = useMemo(() => {
    const total = allKeys.length || 1;
    const done = allKeys.reduce((acc, k) => acc + (items?.[k] ? 1 : 0), 0);
    const pct = Math.round((done / total) * 100);
    return { done, total, pct };
  }, [items, allKeys]);

  const filteredChecklist = useMemo(() => {
    const q = safeLower(query).trim();
    if (!q) return DEFAULT_CHECKLIST;

    return DEFAULT_CHECKLIST.map((sec) => {
      const keep = sec.items.filter((it) => {
        const hay = `${it.label} ${it.key} ${sec.section}`.toLowerCase();
        return hay.includes(q);
      });
      return { ...sec, items: keep };
    }).filter((sec) => sec.items.length > 0);
  }, [query]);

  const sectionStats = useMemo(() => {
    const map = {};
    DEFAULT_CHECKLIST.forEach((sec) => {
      const total = sec.items.length || 1;
      const done = sec.items.reduce((a, it) => a + (items?.[it.key] ? 1 : 0), 0);
      map[sec.section] = { done, total, pct: Math.round((done / total) * 100) };
    });
    return map;
  }, [items]);

  // Load
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setLoadError("");

        const { data: c, error: cErr } = await supabase
          .from("courses")
          .select("id, nom, lieu, departement, organisateur_id")
          .eq("id", courseId)
          .single();
        if (cErr) throw new Error(cErr.message);

        const { data: f, error: fErr } = await supabase
          .from("formats")
          .select("id, nom, date, heure_depart")
          .eq("course_id", courseId)
          .order("date", { ascending: true });
        if (fErr) throw new Error(fErr.message);

        const { data: chk, error: chkErr } = await supabase
          .from("course_checklists")
          .select("course_id, items, notes_by_format, global_note, updated_at")
          .eq("course_id", courseId)
          .maybeSingle();
        if (chkErr) throw new Error(chkErr.message);

        setCourse(c || null);
        setFormats(f || []);
        setActiveFormatId((prev) => prev || (f?.[0]?.id ?? null));

        setItems(chk?.items && typeof chk.items === "object" ? chk.items : {});
        setNotesByFormat(chk?.notes_by_format && typeof chk.notes_by_format === "object" ? chk.notes_by_format : {});
        setGlobalNote(typeof chk?.global_note === "string" ? chk.global_note : "");
        setLastSavedAt(chk?.updated_at ? new Date(chk.updated_at) : null);

        setLoading(false);
      } catch (e) {
        setLoadError(String(e?.message || e));
        setLoading(false);
      }
    };

    if (courseId) run();
  }, [courseId]);

  // Autosave (debounce)
  useEffect(() => {
    if (!courseId) return;
    if (loading) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);

        const formatIds = new Set((formats || []).map((f) => f.id));
        const cleanedNotes = Object.fromEntries(
          Object.entries(notesByFormat || {}).filter(([fid]) => formatIds.has(fid))
        );

        const payload = {
          course_id: courseId,
          items: items || {},
          notes_by_format: cleanedNotes || {},
          global_note: globalNote || "",
        };

        const { data, error } = await supabase
          .from("course_checklists")
          .upsert(payload, { onConflict: "course_id" })
          .select("updated_at")
          .single();

        if (error) throw new Error(error.message);

        setLastSavedAt(data?.updated_at ? new Date(data.updated_at) : new Date());
        showToast("Sauvegardé ✅");
      } catch {
        showToast("Sauvegarde impossible");
      } finally {
        setSaving(false);
      }
    }, 700);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, notesByFormat, globalNote, courseId, loading, formats]);

  function showToast(msg) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1400);
  }

  function toggleKey(k) {
    setItems((prev) => ({ ...(prev || {}), [k]: !prev?.[k] }));
  }

  function setNoteForFormat(formatId, text) {
    setNotesByFormat((prev) => ({ ...(prev || {}), [formatId]: text }));
  }

  function toggleSection(sectionName) {
    setCollapsed((prev) => ({ ...(prev || {}), [sectionName]: !prev?.[sectionName] }));
  }

  function markAllVisible(nextValue) {
    const q = safeLower(query).trim();
    const visibleKeys = (q ? filteredChecklist : DEFAULT_CHECKLIST)
      .flatMap((sec) => sec.items.map((it) => it.key));

    setItems((prev) => {
      const out = { ...(prev || {}) };
      visibleKeys.forEach((k) => (out[k] = !!nextValue));
      return out;
    });

    showToast(nextValue ? "Tout coché" : "Tout décoché");
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-neutral-600 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="h-4 w-4" />
            Erreur
          </div>
          <div className="mt-2 whitespace-pre-wrap">{loadError}</div>
          <Link
            to="/organisateur/mon-espace"
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-900 hover:bg-red-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
        </div>
      </div>
    );
  }

  const activeFormat = formats.find((f) => f.id === activeFormatId) || formats[0] || null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Toast */}
      {toast ? (
        <div className="fixed bottom-4 right-4 z-[80] rounded-full bg-black text-white text-sm px-3 py-2 shadow">
          {toast}
        </div>
      ) : null}

      {/* Header */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xl font-black text-neutral-900">
              <ClipboardList className="h-5 w-5" />
              Checklist organisateur
            </div>
            <p className="mt-1 text-sm text-neutral-600">
              Checklist (course) + bloc-notes <b>par format</b>. Sauvegarde auto.
            </p>

            <div className="mt-4">
              <div className="text-sm font-semibold text-neutral-900 truncate">{course?.nom || "Course"}</div>
              <div className="text-xs text-neutral-500">
                {course?.lieu ? `${course.lieu}${course.departement ? ` (${course.departement})` : ""}` : ""}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Link
              to={`/organisateur/reglement/${courseId}`}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour règlement
            </Link>

            <div className="flex items-center gap-2">
              <Pill tone={progress.pct === 100 ? "green" : "neutral"}>
                <CheckCircle2 className="h-4 w-4" />
                {progress.done}/{progress.total} • {progress.pct}%
              </Pill>

              <Pill tone={saving ? "orange" : "neutral"}>
                <Save className="h-4 w-4" />
                {saving ? "Sauvegarde…" : lastSavedAt ? `Sauvé à ${fmtTimeFR(lastSavedAt)}` : "—"}
              </Pill>
            </div>

            <div className="w-[260px] max-w-full">
              <ProgressBar pct={progress.pct} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => setActivePane("checklist")}
            className={[
              "rounded-xl px-3 py-2 text-sm font-semibold border",
              activePane === "checklist"
                ? "border-orange-300 bg-orange-50 text-neutral-900"
                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
            ].join(" ")}
          >
            Checklist
          </button>
          <button
            onClick={() => setActivePane("notes")}
            className={[
              "rounded-xl px-3 py-2 text-sm font-semibold border",
              activePane === "notes"
                ? "border-orange-300 bg-orange-50 text-neutral-900"
                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
            ].join(" ")}
          >
            Notes par format
          </button>
        </div>
      </div>

      {/* ===== Checklist Pane ===== */}
      {activePane === "checklist" && (
        <>
          {/* Controls */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8">
              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Rechercher dans la checklist…"
                      className="w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                    />
                    {query ? (
                      <button
                        onClick={() => setQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-neutral-100"
                        title="Effacer"
                      >
                        <X className="h-4 w-4 text-neutral-500" />
                      </button>
                    ) : null}
                  </div>

                  <IconBtn onClick={() => markAllVisible(true)} title="Tout cocher (visible)">
                    <CheckSquare className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn onClick={() => markAllVisible(false)} title="Tout décocher (visible)">
                    <Square className="h-4 w-4" />
                  </IconBtn>
                </div>

                <div className="mt-3 text-xs text-neutral-500">
                  Astuce : tape “sécurité”, “ravitos”, “balisage”… pour filtrer rapidement.
                </div>
              </div>
            </div>

            <div className="lg:col-span-4">
              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="flex items-center gap-2 font-bold text-neutral-900">
                  <NotebookPen className="h-4 w-4" />
                  Note globale (course)
                </div>
                <textarea
                  className="mt-3 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                  rows={5}
                  placeholder="Ex: contact mairie, numéros radio, TODO…"
                  value={globalNote}
                  onChange={(e) => setGlobalNote(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="mt-6 space-y-4">
            {(filteredChecklist || []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-600">
                Aucun résultat pour “{query}”.
              </div>
            ) : (
              filteredChecklist.map((sec) => {
                const stats = sectionStats?.[sec.section] || { done: 0, total: sec.items.length || 1, pct: 0 };
                const isCollapsed = !!collapsed?.[sec.section];

                return (
                  <div key={sec.section} className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
                    <button
                      onClick={() => toggleSection(sec.section)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-white hover:bg-neutral-50 border-b border-neutral-100"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-neutral-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-neutral-500" />
                        )}
                        <div className="text-left min-w-0">
                          <div className="text-base font-black text-neutral-900 truncate">{sec.section}</div>
                          <div className="text-xs text-neutral-500">
                            {stats.done}/{stats.total} • {stats.pct}%
                          </div>
                        </div>
                      </div>

                      <div className="w-40 hidden sm:block">
                        <ProgressBar pct={stats.pct} />
                      </div>
                    </button>

                    {!isCollapsed && (
                      <div className="p-4 sm:p-5">
                        <div className="grid gap-2">
                          {sec.items.map((it) => {
                            const checked = !!items?.[it.key];
                            return (
                              <button
                                key={it.key}
                                onClick={() => toggleKey(it.key)}
                                className={[
                                  "flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition",
                                  checked
                                    ? "border-emerald-200 bg-emerald-50"
                                    : "border-neutral-200 bg-white hover:bg-neutral-50",
                                ].join(" ")}
                              >
                                <span
                                  className={[
                                    "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md border",
                                    checked
                                      ? "border-emerald-300 bg-emerald-600 text-white"
                                      : "border-neutral-300 bg-white",
                                  ].join(" ")}
                                  aria-hidden
                                >
                                  {checked ? "✓" : ""}
                                </span>

                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-neutral-900">{it.label}</div>
                                  <div className="text-xs text-neutral-500 break-all">{it.key}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ===== Notes Pane ===== */}
      {activePane === "notes" && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: formats list */}
          <div className="lg:col-span-4">
            <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
              <div className="p-4 border-b border-neutral-100">
                <div className="font-black text-neutral-900">Formats</div>
                <div className="text-xs text-neutral-500 mt-1">Choisis un format → note dédiée.</div>
              </div>

              {formats.length === 0 ? (
                <div className="p-6 text-sm text-neutral-600">Aucun format trouvé.</div>
              ) : (
                <div className="divide-y">
                  {formats.map((f) => {
                    const active = f.id === activeFormatId;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setActiveFormatId(f.id)}
                        className={[
                          "w-full text-left px-4 py-3 hover:bg-neutral-50",
                          active ? "bg-orange-50" : "bg-white",
                        ].join(" ")}
                      >
                        <div className="font-semibold text-neutral-900">{f.nom || "Format"}</div>
                        <div className="text-xs text-neutral-500">
                          {f.date ? fmtDateFR(f.date) : "Date à venir"}
                          {f.heure_depart ? ` • ${f.heure_depart}` : ""}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: editor */}
          <div className="lg:col-span-8">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-lg font-black text-neutral-900">Bloc-notes</div>
                  <div className="text-sm text-neutral-600 mt-1">
                    {activeFormat ? (
                      <>
                        Pour <b>{activeFormat.nom || "Format"}</b>
                        {activeFormat.date ? ` — ${fmtDateFR(activeFormat.date)}` : ""}
                        {activeFormat.heure_depart ? ` • ${activeFormat.heure_depart}` : ""}
                      </>
                    ) : (
                      "Choisis un format à gauche."
                    )}
                  </div>
                </div>

                <Pill tone="neutral">
                  <Save className="h-4 w-4" />
                  {saving ? "Sauvegarde…" : lastSavedAt ? `Sauvé à ${fmtTimeFR(lastSavedAt)}` : "—"}
                </Pill>
              </div>

              <textarea
                className="mt-4 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                rows={16}
                placeholder="Notes spécifiques : briefing, matériel, BH, ravitos, bénévoles, consignes…"
                value={activeFormatId ? notesByFormat?.[activeFormatId] || "" : ""}
                onChange={(e) => activeFormatId && setNoteForFormat(activeFormatId, e.target.value)}
                disabled={!activeFormatId}
              />

              <div className="mt-3 text-xs text-neutral-500">
                Ces notes ne sont liées à aucun règlement : c’est une aide interne côté orga.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 text-xs text-neutral-500">
        Données stockées dans <code>public.course_checklists</code>.
      </div>
    </div>
  );
}

// src/pages/ReglementAssistant.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";
import {
  Save,
  Wand2,
  Download,
  ClipboardCopy,
  Printer,
  CheckCircle2,
  AlertTriangle,
  FileText,
  RefreshCcw,
  Globe,
} from "lucide-react";

/* --------------------------------- Helpers -------------------------------- */

function formatDateFR(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR");
}

function safeText(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function downloadFile(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  return safeText(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------- depends_on utils ----------
function getAnswerValue(answers, key, formatId = null) {
  if (!answers) return undefined;
  if (formatId && answers.formats && answers.formats[formatId]) {
    const v = answers.formats[formatId][key];
    if (v !== undefined) return v;
  }
  return answers.global ? answers.global[key] : undefined;
}

function shouldShowQuestion(question, answers, formatId = null) {
  const dep = question?.depends_on;
  if (!dep || Object.keys(dep).length === 0) return true;

  const actual = getAnswerValue(answers, dep.key, formatId);

  switch (dep.op) {
    case "equals":
      return actual === dep.value;
    case "not_equals":
      return actual !== dep.value;
    case "exists":
      return actual !== undefined && actual !== null && actual !== "";
    case "truthy":
      return !!actual;
    case "in":
      return Array.isArray(dep.value) ? dep.value.includes(actual) : false;
    default:
      // fail-open
      return true;
  }
}

function normalizeOptions(opts) {
  if (!Array.isArray(opts)) return [];
  return opts
    .filter((o) => o && typeof o === "object")
    .map((o) => ({
      value: String(o.value ?? ""),
      label: String(o.label ?? o.value ?? ""),
    }))
    .filter((o) => o.value.length > 0);
}

/* ------------------------------ UI Components ------------------------------ */

function QuestionField({ q, value, onChange }) {
  const help = q.help ? <p className="mt-1 text-xs text-neutral-500">{q.help}</p> : null;

  if (q.type === "bool") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-orange-500"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-neutral-900">
            {q.label}
            {q.required ? " *" : ""}
          </div>
          {help}
        </div>
      </div>
    );
  }

  if (q.type === "text") {
    return (
      <label className="block">
        <div className="text-sm font-semibold text-neutral-900">
          {q.label}
          {q.required ? " *" : ""}
        </div>
        <textarea
          className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
          rows={4}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
        {help}
      </label>
    );
  }

  if (q.type === "number") {
    return (
      <label className="block">
        <div className="text-sm font-semibold text-neutral-900">
          {q.label}
          {q.required ? " *" : ""}
        </div>
        <input
          type="number"
          className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
        {help}
      </label>
    );
  }

  if (q.type === "select") {
    const opts = normalizeOptions(q.options);
    return (
      <label className="block">
        <div className="text-sm font-semibold text-neutral-900">
          {q.label}
          {q.required ? " *" : ""}
        </div>
        <select
          className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">—</option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {help}
      </label>
    );
  }

  if (q.type === "multi") {
    const opts = normalizeOptions(q.options);
    const arr = Array.isArray(value) ? value : [];
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-3">
        <div className="text-sm font-semibold text-neutral-900">
          {q.label}
          {q.required ? " *" : ""}
        </div>
        {help}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {opts.map((o) => {
            const checked = arr.includes(o.value);
            return (
              <label key={o.value} className="flex items-start gap-3 rounded-lg border border-neutral-200 px-3 py-2">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-orange-500"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value);
                    onChange(next);
                  }}
                />
                <span className="text-sm text-neutral-800">{o.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

/* ---------------------------------- Page ---------------------------------- */

export default function ReglementAssistant() {
  const { courseId } = useParams();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({ global: {}, formats: {}, meta: { version: 1 } });

  const [activeTab, setActiveTab] = useState("global"); // global | formats

  const [reglementId, setReglementId] = useState(null);
  const [generatedMd, setGeneratedMd] = useState("");

  const [savingDraft, setSavingDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const [generating, setGenerating] = useState(false);
  const [savingText, setSavingText] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [status, setStatus] = useState("draft"); // draft | published | archived

  const autosaveTimer = useRef(null);

  /* ------------------------------ Load initial ------------------------------ */

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setLoadError("");

        // course + formats
        const { data: c, error: cErr } = await supabase.from("courses").select("*").eq("id", courseId).single();
        if (cErr) throw new Error(cErr.message);

        const { data: f, error: fErr } = await supabase.from("formats").select("*").eq("course_id", courseId);
        if (fErr) throw new Error(fErr.message);

        // questions
        const { data: q, error: qErr } = await supabase
          .from("reglement_questions")
          .select("*")
          .order("section", { ascending: true })
          .order("order_index", { ascending: true });

        if (qErr) throw new Error(qErr.message);

        // existing reglement (draft/published)
        const { data: reg, error: rErr } = await supabase
          .from("reglements")
          .select("*")
          .eq("course_id", courseId)
          .maybeSingle();

        if (rErr) throw new Error(rErr.message);

        setCourse(c || null);
        setFormats(f || []);
        setQuestions(q || []);

        if (reg) {
          setReglementId(reg.id);
          setStatus(reg.status || "draft");
          if (reg.answers) setAnswers(reg.answers);
          setGeneratedMd(reg.edited_md || reg.generated_md || "");
        } else {
          setReglementId(null);
          setStatus("draft");
          setAnswers({ global: {}, formats: {}, meta: { version: 1 } });
          setGeneratedMd("");
        }

        setLoading(false);
      } catch (e) {
        setLoadError(String(e?.message || e));
        setLoading(false);
      }
    };

    if (courseId) run();
  }, [courseId]);

  /* --------------------------- Group questions UI --------------------------- */

  const questionsBySection = useMemo(() => {
    const map = new Map();
    (questions || []).forEach((q) => {
      if (!map.has(q.section)) map.set(q.section, []);
      map.get(q.section).push(q);
    });
    return Array.from(map.entries());
  }, [questions]);

  const perFormatQuestions = useMemo(() => {
    return (questions || []).filter((q) => typeof q.key === "string" && q.key.startsWith("format."));
  }, [questions]);

  /* ------------------------------- Set answers ------------------------------ */

  const setGlobalAnswer = (key, value) => {
    setAnswers((prev) => ({
      ...(prev || {}),
      global: { ...(prev?.global || {}), [key]: value },
      meta: { ...(prev?.meta || {}), updated_at: new Date().toISOString() },
    }));
  };

  const setFormatAnswer = (formatId, key, value) => {
    setAnswers((prev) => ({
      ...(prev || {}),
      formats: {
        ...(prev?.formats || {}),
        [formatId]: { ...(prev?.formats?.[formatId] || {}), [key]: value },
      },
      meta: { ...(prev?.meta || {}), updated_at: new Date().toISOString() },
    }));
  };

  /* ------------------------------ Autosave draft ---------------------------- */

  useEffect(() => {
    if (!courseId) return;
    if (loading) return;

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);

    autosaveTimer.current = setTimeout(async () => {
      try {
        setSavingDraft(true);

        const payload = {
          course_id: courseId,
          status: status || "draft",
          answers,
        };

        const { data, error } = await supabase
          .from("reglements")
          .upsert(payload, { onConflict: "course_id" })
          .select("*")
          .single();

        if (error) throw new Error(error.message);
        if (data?.id) setReglementId(data.id);
        if (data?.status) setStatus(data.status);
        setLastSavedAt(new Date());
      } catch (e) {
        // on ne bloque pas l’UI, mais on peut afficher une alerte si tu veux
        // console.error(e);
      } finally {
        setSavingDraft(false);
      }
    }, 800);

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, courseId]);

  /* ---------------------------- Edge: generate MD --------------------------- */

  async function onGenerate() {
    try {
      setGenerating(true);

      const { data, error } = await supabase.functions.invoke("generate-reglement", {
        body: { course_id: courseId, answers },
      });

      if (error) throw new Error(error.message);
      if (data?.markdown) setGeneratedMd(data.markdown);

      // si l’edge renvoie le reglement
      if (data?.reglement?.id) setReglementId(data.reglement.id);
      if (data?.reglement?.status) setStatus(data.reglement.status);
    } catch (e) {
      alert(`Impossible de générer le règlement : ${String(e?.message || e)}`);
    } finally {
      setGenerating(false);
    }
  }

  /* ------------------------- Save edited text to DB ------------------------- */

  async function onSaveText() {
    try {
      setSavingText(true);

      const payload = {
        course_id: courseId,
        status: status || "draft",
        answers,
        edited_md: generatedMd,
      };

      const { data, error } = await supabase
        .from("reglements")
        .upsert(payload, { onConflict: "course_id" })
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      if (data?.id) setReglementId(data.id);
      if (data?.status) setStatus(data.status);

      setLastSavedAt(new Date());
    } catch (e) {
      alert(`Enregistrement impossible : ${String(e?.message || e)}`);
    } finally {
      setSavingText(false);
    }
  }

  /* -------------------------------- Publish -------------------------------- */

  async function onPublish() {
    try {
      setPublishing(true);

      const payload = {
        course_id: courseId,
        status: "published",
        answers,
        edited_md: generatedMd,
      };

      const { data, error } = await supabase
        .from("reglements")
        .upsert(payload, { onConflict: "course_id" })
        .select("*")
        .single();

      if (error) throw new Error(error.message);

      setStatus("published");
      if (data?.id) setReglementId(data.id);
      setLastSavedAt(new Date());
    } catch (e) {
      alert(`Publication impossible : ${String(e?.message || e)}`);
    } finally {
      setPublishing(false);
    }
  }

  /* --------------------------------- Export -------------------------------- */

  function exportMarkdown() {
    const title = safeText(course?.nom || "reglement").trim() || "reglement";
    const file = `${title.replaceAll(" ", "_")}.md`;
    downloadFile(file, generatedMd || "", "text/markdown;charset=utf-8");
  }

  function exportAnswersJSON() {
    const title = safeText(course?.nom || "reglement_answers").trim() || "reglement_answers";
    const file = `${title.replaceAll(" ", "_")}_answers.json`;
    downloadFile(file, JSON.stringify(answers, null, 2), "application/json;charset=utf-8");
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(generatedMd || "");
    } catch {
      alert("Copie impossible (permissions navigateur).");
    }
  }

  function printText() {
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;
    w.document.open();
    w.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Règlement</title>
          <style>
            body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 24px; }
            pre { white-space: pre-wrap; word-wrap: break-word; font-size: 12px; line-height: 1.45; }
          </style>
        </head>
        <body>
          <pre>${escapeHtml(generatedMd || "")}</pre>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  }

  function resetText() {
    if (!confirm("Remplacer le texte actuel par la dernière version générée (si disponible) ?")) return;
    // Si tu veux une vraie “dernière version générée” distincte, stocke generated_md séparément dans l’état.
    // Ici on garde simple : on ne peut que vider ou conserver.
    setGeneratedMd((prev) => prev); // no-op, placeholder si tu veux brancher plus tard.
  }

  /* ---------------------------------- Render -------------------------------- */

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-neutral-600">Chargement…</div>;
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="h-4 w-4" />
            Erreur de chargement
          </div>
          <div className="mt-2 whitespace-pre-wrap">{loadError}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Header */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xl font-black text-neutral-900">Assistant règlement</div>
            <p className="mt-1 text-sm text-neutral-600">
              Réponds aux questions → génère un règlement → édite → publie → exporte.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={[
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold",
                  status === "published" ? "bg-green-50 text-green-800" : "bg-neutral-100 text-neutral-700",
                ].join(" ")}
              >
                {status === "published" ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                {status === "published" ? "Publié" : "Brouillon"}
              </span>

              <span className="text-neutral-500">
                {savingDraft ? "Enregistrement auto…" : lastSavedAt ? `Dernière sauvegarde : ${lastSavedAt.toLocaleTimeString("fr-FR")}` : ""}
              </span>

              {reglementId ? <span className="text-neutral-400">• id: {reglementId}</span> : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={onGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
            >
              <Wand2 className="h-4 w-4" />
              {generating ? "Génération…" : "Générer"}
            </button>

            <button
              onClick={onSaveText}
              disabled={savingText}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {savingText ? "Enregistrement…" : "Enregistrer texte"}
            </button>

            <button
              onClick={onPublish}
              disabled={publishing}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              <Globe className="h-4 w-4" />
              {publishing ? "Publication…" : "Publier"}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-neutral-50 p-3 text-sm">
          <div className="font-semibold text-neutral-900">{course?.nom || "Course"}</div>
          <div className="text-neutral-700">
            {course?.lieu ? `${course.lieu} • ` : ""}
            {formatDateFR(course?.date)}
          </div>
          <div className="mt-2 text-xs text-neutral-500">
            Onglet “Par format” : uniquement les questions dont la clé commence par <code>format.</code>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab("global")}
            className={[
              "rounded-xl px-3 py-2 text-sm font-semibold border",
              activeTab === "global"
                ? "border-orange-300 bg-orange-50 text-neutral-900"
                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
            ].join(" ")}
          >
            Paramètres généraux
          </button>
          <button
            onClick={() => setActiveTab("formats")}
            className={[
              "rounded-xl px-3 py-2 text-sm font-semibold border",
              activeTab === "formats"
                ? "border-orange-300 bg-orange-50 text-neutral-900"
                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
            ].join(" ")}
          >
            Par format (optionnel)
          </button>
        </div>
      </div>

      {/* Global questions */}
      {activeTab === "global" && (
        <div className="mt-6 space-y-6">
          {questionsBySection.map(([section, qs]) => {
            // On exclut les "format.*" de l’onglet global
            const visible = qs
              .filter((q) => !(typeof q.key === "string" && q.key.startsWith("format.")))
              .filter((q) => shouldShowQuestion(q, answers));

            if (visible.length === 0) return null;

            return (
              <div key={section} className="rounded-2xl border border-neutral-200 bg-white p-5">
                <div className="text-lg font-black text-neutral-900">{section}</div>
                <div className="mt-4 grid gap-4">
                  {visible.map((q) => (
                    <QuestionField
                      key={q.key}
                      q={q}
                      value={answers?.global?.[q.key]}
                      onChange={(val) => setGlobalAnswer(q.key, val)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Per-format */}
      {activeTab === "formats" && (
        <div className="mt-6 space-y-6">
          {(formats || []).map((fmt) => {
            const formatId = fmt.id;

            const visible = perFormatQuestions.filter((q) => shouldShowQuestion(q, answers, formatId));

            return (
              <div key={formatId} className="rounded-2xl border border-neutral-200 bg-white p-5">
                <div className="text-lg font-black text-neutral-900">{fmt.nom || "Format"}</div>
                <p className="mt-1 text-sm text-neutral-600">
                  Paramètres spécifiques à ce format (nocturne, % goudron, matériel, etc.).
                </p>

                {visible.length === 0 ? (
                  <div className="mt-4 text-sm text-neutral-600">
                    Aucune question “par format” pour l’instant. Ajoute des entrées dans <code>reglement_questions</code>{" "}
                    avec une clé qui commence par <code>format.</code>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4">
                    {visible.map((q) => (
                      <QuestionField
                        key={q.key}
                        q={q}
                        value={answers?.formats?.[formatId]?.[q.key]}
                        onChange={(val) => setFormatAnswer(formatId, q.key, val)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Editor + Export */}
      <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-black text-neutral-900">Texte du règlement</div>
            <div className="mt-1 text-sm text-neutral-600">
              Génère puis ajuste. Le texte ci-dessous sera enregistré dans <code>reglements.edited_md</code>.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={copyToClipboard}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              title="Copier le texte"
            >
              <ClipboardCopy className="h-4 w-4" />
              Copier
            </button>

            <button
              onClick={exportMarkdown}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              title="Télécharger en .md"
            >
              <Download className="h-4 w-4" />
              Export .md
            </button>

            <button
              onClick={exportAnswersJSON}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              title="Télécharger les réponses en JSON"
            >
              <Download className="h-4 w-4" />
              Export réponses
            </button>

            <button
              onClick={printText}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              title="Imprimer"
            >
              <Printer className="h-4 w-4" />
              Imprimer
            </button>

            <button
              onClick={resetText}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              title="Reset (placeholder)"
            >
              <RefreshCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>

        <textarea
          className="mt-4 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
          rows={20}
          value={generatedMd}
          onChange={(e) => setGeneratedMd(e.target.value)}
          placeholder="Clique sur “Générer”, puis ajuste ici."
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500">
          <div>
            {savingDraft ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-orange-500" />
                Autosave en cours…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-neutral-300" />
                Autosave actif (réponses).
              </span>
            )}
          </div>
          <div>
            {status === "published" ? (
              <span className="inline-flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Publié (pense à rendre la page publique côté front)
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Brouillon
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Debug */}
      <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="text-sm font-bold text-neutral-900">Debug</div>
        <pre className="mt-2 overflow-auto rounded-xl bg-neutral-50 p-3 text-xs text-neutral-800">
{JSON.stringify({ status, answers }, null, 2)}
        </pre>
      </div>
    </div>
  );
}

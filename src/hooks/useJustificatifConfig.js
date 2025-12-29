// src/hooks/useJustificatifConfig.js
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../supabase";

/* ----------------------------- Helpers ----------------------------- */

function normalizeCode(v) {
  return String(v || "").trim().toLowerCase();
}

function toArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean).map(normalizeCode);
  if (typeof v === "string") {
    // accepte: "a,b,c" ou "a; b; c" ou JSON '["a","b"]'
    const s = v.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(normalizeCode);
    } catch (_) {}
    return s
      .split(/[;,]/g)
      .map((x) => normalizeCode(x))
      .filter(Boolean);
  }
  return [];
}

function pick(obj, keys) {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

function extractPolicyFromEntity(entity) {
  // Supporte plusieurs conventions de champs
  const jp =
    pick(entity, ["justificatif_policy", "justificatifs_policy", "policy_justificatif"]) || null;

  const allowedFromJson = jp?.allowed_types ?? jp?.allowedTypes ?? jp?.types ?? null;
  const requiredFromJson = jp?.required ?? jp?.is_required ?? jp?.obligatoire ?? null;
  const notesFromJson = jp?.notes ?? jp?.help ?? jp?.hint ?? null;
  const allowUploadFromJson =
    jp?.allow_medical_upload ?? jp?.allowUpload ?? jp?.allow_upload ?? null;

  const allowedRaw = pick(entity, [
    "justificatif_allowed_types",
    "justificatif_types_allowed",
    "allowed_justificatif_types",
    "allowed_types",
    "justificatifs_allowed_types",
  ]);

  const requiredRaw = pick(entity, [
    "justificatif_required",
    "justificatifs_required",
    "is_justificatif_required",
    "required_justificatif",
  ]);

  const notesRaw = pick(entity, ["justificatif_notes", "justificatifs_notes", "notes_justificatif"]);

  const allowUploadRaw = pick(entity, [
    "allow_medical_upload",
    "justificatif_allow_upload",
    "justificatif_upload_allowed",
    "allow_upload",
  ]);

  const allowedTypes = toArray(allowedFromJson ?? allowedRaw);
  const required =
    typeof (requiredFromJson ?? requiredRaw) === "boolean"
      ? requiredFromJson ?? requiredRaw
      : requiredFromJson ?? requiredRaw ?? undefined;

  const notes = notesFromJson ?? notesRaw ?? undefined;

  const allowMedicalUpload =
    typeof (allowUploadFromJson ?? allowUploadRaw) === "boolean"
      ? allowUploadFromJson ?? allowUploadRaw
      : allowUploadFromJson ?? allowUploadRaw ?? undefined;

  return {
    allowedTypes,
    required,
    notes,
    allowMedicalUpload,
  };
}

function mergePolicies(base, next) {
  // next écrase base si défini
  const out = { ...(base || {}) };
  if (next?.allowedTypes && next.allowedTypes.length) out.allowedTypes = next.allowedTypes;
  if (typeof next?.required === "boolean") out.required = next.required;
  if (typeof next?.allowMedicalUpload === "boolean") out.allowMedicalUpload = next.allowMedicalUpload;
  if (next?.notes) out.notes = next.notes;
  return out;
}

async function tryLoadCatalogue() {
  // On teste plusieurs noms de tables possibles (au mieux)
  const candidates = [
    // recommandé
    "justificatif_types",
    // variantes probables
    "justificatifs_types",
    "justificatif_catalogue",
    "justificatifs_catalogue",
    "justificatif_type_catalogue",
  ];

  for (const table of candidates) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (!error && data) {
      // normalisation minimaliste: code/label/is_active
      const rows = (data || [])
        .map((r) => {
          const code = normalizeCode(r.code ?? r.type_code ?? r.slug ?? r.id);
          const label = r.label ?? r.name ?? r.titre ?? code;
          const is_active = r.is_active ?? r.active ?? true;
          const description = r.description ?? r.help ?? r.hint ?? "";
          return { ...r, code, label, is_active, description };
        })
        .filter((r) => r.code);

      return { table, rows };
    }

    // table inexistante => on tente la suivante
    // (on évite de spammer la console)
  }

  return { table: null, rows: [] };
}

async function tryLoadDbPolicy({ courseId, formatId }) {
  // table(s) candidates pour policy
  const candidates = ["justificatif_policies", "justificatifs_policies", "justificatif_policy"];

  for (const table of candidates) {
    let q = supabase.from(table).select("*").limit(1);

    if (formatId) q = q.eq("format_id", formatId);
    else if (courseId) q = q.eq("course_id", courseId);
    else continue;

    const { data, error } = await q.maybeSingle();

    if (!error && data) return { table, row: data };
    // table inexistante ou pas de row => continue
  }

  return { table: null, row: null };
}

/* ------------------------------ Hook ------------------------------ */

export function useJustificatifConfig({
  course = null,
  format = null,
  courseId = null,
  formatId = null,
  enabled = true,
  defaults = null,
} = {}) {
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  const [catalogue, setCatalogue] = useState([]);
  const [catalogueTable, setCatalogueTable] = useState(null);

  const [dbPolicyRow, setDbPolicyRow] = useState(null);
  const [dbPolicyTable, setDbPolicyTable] = useState(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      // 1) Catalogue
      const cat = await tryLoadCatalogue();
      setCatalogueTable(cat.table);
      setCatalogue(cat.rows || []);

      // 2) Policy en base (optionnelle)
      const pol = await tryLoadDbPolicy({
        courseId: courseId || course?.id || null,
        formatId: formatId || format?.id || null,
      });

      setDbPolicyTable(pol.table);
      setDbPolicyRow(pol.row || null);
    } catch (e) {
      console.error("useJustificatifConfig error:", e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [enabled, courseId, formatId, course?.id, format?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const resolved = useMemo(() => {
    // Defaults (si tu ne passes rien)
    const baseDefaults = {
      allowedTypes: [], // vide = "tous les types actifs"
      required: true,
      notes: "",
      allowMedicalUpload: false,
      ...(defaults || {}),
    };

    const coursePol = extractPolicyFromEntity(course);
    const formatPol = extractPolicyFromEntity(format);

    // DB policy (si existante)
    const dbPol = dbPolicyRow ? extractPolicyFromEntity(dbPolicyRow) : null;

    // Priorité: defaults < course < format < db
    let policy = mergePolicies(baseDefaults, coursePol);
    policy = mergePolicies(policy, formatPol);
    policy = mergePolicies(policy, dbPol);

    // allowedTypes effectifs:
    const activeCodes = (catalogue || [])
      .filter((t) => t.is_active !== false)
      .map((t) => normalizeCode(t.code))
      .filter(Boolean);

    const allowedTypes =
      policy.allowedTypes && policy.allowedTypes.length ? policy.allowedTypes : activeCodes;

    return {
      policy,
      allowedTypes,
      isRequired: Boolean(policy.required),
      notes: policy.notes || "",
      allowMedicalUpload: Boolean(policy.allowMedicalUpload),
      debug: {
        catalogueTable,
        dbPolicyTable,
      },
    };
  }, [catalogue, course, format, dbPolicyRow, defaults, catalogueTable, dbPolicyTable]);

  return {
    loading,
    error,
    catalogue,
    ...resolved,
    refresh,
  };
}

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
  if (!entity) return { allowedTypes: [], required: undefined, notes: undefined, allowMedicalUpload: undefined };

  // Supporte plusieurs conventions de champs
  const jp =
    pick(entity, ["justificatif_policy", "justificatifs_policy", "policy_justificatif"]) || null;

  const allowedFromJson = jp?.allowed_types ?? jp?.allowedTypes ?? jp?.types ?? null;
  const requiredFromJson = jp?.required ?? jp?.is_required ?? jp?.obligatoire ?? null;
  const notesFromJson = jp?.notes ?? jp?.help ?? jp?.hint ?? null;
  const allowUploadFromJson =
    jp?.allow_medical_upload ?? jp?.allowUpload ?? jp?.allow_upload ?? null;

  const allowedRaw = pick(entity, [
    // course_justificatif_policies
    "allowed_types",
    // variantes
    "justificatif_allowed_types",
    "justificatif_types_allowed",
    "allowed_justificatif_types",
    "justificatifs_allowed_types",
  ]);

  const requiredRaw = pick(entity, [
    // course_justificatif_policies
    "is_required",
    // variantes
    "justificatif_required",
    "justificatifs_required",
    "is_justificatif_required",
    "required_justificatif",
  ]);

  const notesRaw = pick(entity, ["notes", "justificatif_notes", "justificatifs_notes", "notes_justificatif"]);

  const allowUploadRaw = pick(entity, [
    // course_justificatif_policies
    "allow_medical_upload",
    // variantes
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

  return { allowedTypes, required, notes, allowMedicalUpload };
}

function mergePolicies(base, next) {
  const out = { ...(base || {}) };
  if (next?.allowedTypes && next.allowedTypes.length) out.allowedTypes = next.allowedTypes;
  if (typeof next?.required === "boolean") out.required = next.required;
  if (typeof next?.allowMedicalUpload === "boolean") out.allowMedicalUpload = next.allowMedicalUpload;
  if (typeof next?.notes === "string") out.notes = next.notes;
  return out;
}

async function tryLoadCatalogue() {
  const candidates = [
    "justificatif_types",
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
  }

  return { table: null, rows: [] };
}

async function tryLoadDbPolicy({ courseId, formatId }) {
  // ✅ TA TABLE RÉELLE EN PREMIER
  const candidates = [
    "course_justificatif_policies",
    // fallback legacy
    "justificatif_policies",
    "justificatifs_policies",
    "justificatif_policy",
  ];

  for (const table of candidates) {
    if (!courseId) continue;

    // 1) Policy format (si formatId)
    if (formatId) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("course_id", courseId)
        .eq("format_id", formatId)
        .maybeSingle();

      if (!error && data) return { table, row: data };
    }

    // 2) Policy globale course (format_id IS NULL)
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("course_id", courseId)
      .is("format_id", null)
      .maybeSingle();

    if (!error && data) return { table, row: data };
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

      // 2) Policy DB (optionnelle)
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
    const baseDefaults = {
      allowedTypes: [], // vide = "tous les types actifs"
      required: true,
      notes: "",
      allowMedicalUpload: false,
      ...(defaults || {}),
    };

    const coursePol = extractPolicyFromEntity(course);
    const formatPol = extractPolicyFromEntity(format);
    const dbPol = dbPolicyRow ? extractPolicyFromEntity(dbPolicyRow) : null;

    // Priorité : defaults < course < format < db
    let policy = mergePolicies(baseDefaults, coursePol);
    policy = mergePolicies(policy, formatPol);
    policy = mergePolicies(policy, dbPol);

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

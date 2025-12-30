// src/pages/OrganisateurTest.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

const Container = ({ children }) => (
  <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-8">{children}</div>
);

const Card = ({ children }) => (
  <div className="rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200">{children}</div>
);

const Label = ({ children }) => (
  <div className="text-xs font-semibold text-neutral-600">{children}</div>
);

const Input = (props) => (
  <input
    {...props}
    className={[
      "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none",
      "focus:ring-2 focus:ring-orange-300",
      props.className || "",
    ].join(" ")}
  />
);

const Textarea = (props) => (
  <textarea
    {...props}
    className={[
      "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none",
      "focus:ring-2 focus:ring-orange-300 min-h-[110px]",
      props.className || "",
    ].join(" ")}
  />
);

const Button = ({ children, className = "", ...props }) => (
  <button
    {...props}
    className={[
      "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition",
      "bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed",
      className,
    ].join(" ")}
  >
    {children}
  </button>
);

const Pill = ({ children }) => (
  <span className="inline-flex items-center rounded-full bg-orange-50 text-orange-800 ring-1 ring-orange-200 px-2.5 py-1 text-xs font-semibold">
    {children}
  </span>
);

function normalizeCode(v) {
  return String(v || "").trim().toLowerCase();
}

function csvToArray(s) {
  if (!s) return [];
  return String(s)
    .split(/[;,]/g)
    .map((x) => normalizeCode(x))
    .filter(Boolean);
}

export default function OrganisateurTest() {
  const [courseId, setCourseId] = useState("");
  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);

  // scope de policy: "course" (format_id null) ou "format"
  const [scope, setScope] = useState("course");
  const [formatId, setFormatId] = useState("");

  const [catalogue, setCatalogue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState(null);

  const [policyRow, setPolicyRow] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    is_required: true,
    allow_medical_upload: false,
    allowed_types_csv: "",
    notes: "",
  });

  const effectiveFormatId = scope === "format" ? (formatId || null) : null;

  async function loadAll() {
    setLoadErr(null);
    setLoading(true);
    try {
      if (!courseId) throw new Error("Renseigne un courseId");

      const { data: c, error: cErr } = await supabase.from("courses").select("*").eq("id", courseId).single();
      if (cErr) throw cErr;
      setCourse(c);

      const { data: fs, error: fErr } = await supabase
        .from("formats")
        .select("*")
        .eq("course_id", courseId)
        .order("created_at", { ascending: true });
      if (fErr) throw fErr;
      setFormats(fs || []);
      if (!formatId && (fs || []).length) setFormatId(fs[0].id);

      const { data: cat, error: catErr } = await supabase
        .from("justificatif_types")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (catErr) throw catErr;

      const rows = (cat || [])
        .map((r) => ({
          ...r,
          code: normalizeCode(r.code),
          label: r.label || r.code,
          is_active: r.is_active !== false,
        }))
        .filter((r) => r.code);
      setCatalogue(rows);
    } catch (e) {
      setLoadErr(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadPolicy() {
    setLoadErr(null);
    setLoading(true);
    try {
      if (!courseId) return;

      let q = supabase
        .from("course_justificatif_policies")
        .select("*")
        .eq("course_id", courseId)
        .limit(1);

      if (effectiveFormatId) q = q.eq("format_id", effectiveFormatId);
      else q = q.is("format_id", null);

      const { data, error } = await q.maybeSingle();
      if (error) throw error;

      setPolicyRow(data || null);

      // hydrate form
      if (data) {
        setForm({
          is_required: Boolean(data.is_required),
          allow_medical_upload: Boolean(data.allow_medical_upload),
          allowed_types_csv: Array.isArray(data.allowed_types) ? data.allowed_types.join(",") : "",
          notes: data.notes || "",
        });
      } else {
        // default “vide”
        setForm({
          is_required: true,
          allow_medical_upload: false,
          allowed_types_csv: "",
          notes: "",
        });
      }
    } catch (e) {
      setLoadErr(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (courseId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (courseId) loadPolicy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, scope, formatId]);

  const activeCatalogue = useMemo(() => catalogue.filter((t) => t.is_active), [catalogue]);
  const selectedSet = useMemo(() => new Set(csvToArray(form.allowed_types_csv)), [form.allowed_types_csv]);

  function toggleType(code) {
    const c = normalizeCode(code);
    const next = new Set(selectedSet);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    setForm((p) => ({ ...p, allowed_types_csv: Array.from(next).join(",") }));
  }

  async function savePolicy() {
    setSaving(true);
    setLoadErr(null);
    try {
      if (!courseId) throw new Error("courseId manquant");

      const payload = {
        course_id: courseId,
        format_id: effectiveFormatId, // null => global course
        is_required: Boolean(form.is_required),
        allow_medical_upload: Boolean(form.allow_medical_upload),
        allowed_types: csvToArray(form.allowed_types_csv),
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      };

      // upsert sur (course_id, format_id) => pas de contrainte unique dans ton schéma dump,
      // donc on fait: delete+insert “safe” pour les tests, ou update/insert selon présence.
      if (policyRow?.id) {
        const { error } = await supabase
          .from("course_justificatif_policies")
          .update(payload)
          .eq("id", policyRow.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("course_justificatif_policies")
          .insert(payload)
          .select("*")
          .single();
        if (error) throw error;
        setPolicyRow(data);
      }

      await loadPolicy();
    } catch (e) {
      setLoadErr(e);
    } finally {
      setSaving(false);
    }
  }

  const preview = useMemo(
    () => ({
      scope,
      course_id: courseId || null,
      format_id: effectiveFormatId,
      is_required: form.is_required,
      allow_medical_upload: form.allow_medical_upload,
      allowed_types: csvToArray(form.allowed_types_csv),
      notes: form.notes,
    }),
    [scope, courseId, effectiveFormatId, form]
  );

  return (
    <Container>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-orange-600">TEST</div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">
            OrganisateurTest — Policy justificatifs
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Simule la config “organisateur” de <span className="font-semibold">UpsertCourse</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {loading && <Pill>load…</Pill>}
          <Button
            onClick={savePolicy}
            disabled={!courseId || saving}
            className={saving ? "bg-neutral-700" : ""}
          >
            {saving ? "Enregistrement…" : "Enregistrer policy"}
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="p-5">
            <div className="font-bold text-neutral-900">Contexte</div>

            <div className="mt-4 grid gap-4">
              <div>
                <Label>Course ID</Label>
                <div className="mt-1 flex gap-2">
                  <Input value={courseId} onChange={(e) => setCourseId(e.target.value)} placeholder="uuid course_id" />
                  <Button onClick={loadAll} disabled={!courseId}>
                    Charger
                  </Button>
                </div>
              </div>

              <div className="rounded-xl bg-neutral-50 ring-1 ring-neutral-200 p-3 text-xs text-neutral-700">
                <div className="font-semibold">Course</div>
                <div className="mt-1">
                  {course ? (
                    <>
                      <div className="font-semibold text-neutral-900">{course.nom}</div>
                      <div className="text-neutral-600">{course.lieu}</div>
                      <div className="text-neutral-500">sport_code: {course.sport_code}</div>
                    </>
                  ) : (
                    <div className="text-neutral-500">Aucune course chargée.</div>
                  )}
                </div>
              </div>

              <div>
                <Label>Scope policy</Label>
                <div className="mt-1 flex gap-2">
                  <button
                    className={[
                      "rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition",
                      scope === "course"
                        ? "bg-neutral-900 text-white ring-neutral-900"
                        : "bg-white text-neutral-900 ring-neutral-200 hover:bg-neutral-50",
                    ].join(" ")}
                    onClick={() => setScope("course")}
                  >
                    Global course
                  </button>
                  <button
                    className={[
                      "rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition",
                      scope === "format"
                        ? "bg-neutral-900 text-white ring-neutral-900"
                        : "bg-white text-neutral-900 ring-neutral-200 hover:bg-neutral-50",
                    ].join(" ")}
                    onClick={() => setScope("format")}
                  >
                    Par format
                  </button>
                </div>
              </div>

              {scope === "format" && (
                <div>
                  <Label>Format</Label>
                  <div className="mt-1">
                    <select
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                      value={formatId}
                      onChange={(e) => setFormatId(e.target.value)}
                      disabled={!formats.length}
                    >
                      {formats.length === 0 && <option value="">(aucun format chargé)</option>}
                      {formats.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nom} — {f.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {(loadErr) && (
                <div className="rounded-xl bg-red-50 ring-1 ring-red-200 p-3 text-sm text-red-800">
                  {String(loadErr?.message || loadErr)}
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div className="font-bold text-neutral-900">Édition policy</div>
              {policyRow ? <Pill>DB: trouvé</Pill> : <Pill>DB: absent</Pill>}
            </div>

            <div className="mt-4 grid gap-4">
              <div className="flex items-center justify-between rounded-xl bg-neutral-50 ring-1 ring-neutral-200 p-3">
                <div>
                  <div className="text-sm font-semibold text-neutral-900">Justificatif requis</div>
                  <div className="text-xs text-neutral-500">is_required</div>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-orange-600"
                  checked={Boolean(form.is_required)}
                  onChange={(e) => setForm((p) => ({ ...p, is_required: e.target.checked }))}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl bg-neutral-50 ring-1 ring-neutral-200 p-3">
                <div>
                  <div className="text-sm font-semibold text-neutral-900">Autoriser upload médical</div>
                  <div className="text-xs text-neutral-500">allow_medical_upload</div>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-orange-600"
                  checked={Boolean(form.allow_medical_upload)}
                  onChange={(e) => setForm((p) => ({ ...p, allow_medical_upload: e.target.checked }))}
                />
              </div>

              <div>
                <Label>Types autorisés (allowed_types)</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {activeCatalogue.map((t) => {
                    const checked = selectedSet.has(normalizeCode(t.code));
                    return (
                      <button
                        key={t.code}
                        type="button"
                        onClick={() => toggleType(t.code)}
                        className={[
                          "rounded-xl px-3 py-2 text-left text-sm ring-1 transition",
                          checked
                            ? "bg-neutral-900 text-white ring-neutral-900"
                            : "bg-white text-neutral-900 ring-neutral-200 hover:bg-neutral-50",
                        ].join(" ")}
                      >
                        <div className="font-semibold">{t.label}</div>
                        <div className="text-xs opacity-80">{t.code}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2">
                  <Label>Édition rapide CSV (optionnel)</Label>
                  <div className="mt-1">
                    <Input
                      value={form.allowed_types_csv}
                      onChange={(e) => setForm((p) => ({ ...p, allowed_types_csv: e.target.value }))}
                      placeholder="ex: pps, licence_ffa, certificat_medical"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <div className="mt-1">
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="message d’aide affichable côté inscription"
                  />
                </div>
              </div>

              <div>
                <Label>Preview payload</Label>
                <div className="mt-1">
                  <Textarea readOnly value={JSON.stringify(preview, null, 2)} />
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Container>
  );
}

// src/pages/ClientTest.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { useJustificatifConfig } from "../hooks/useJustificatifConfig";

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
      "focus:ring-2 focus:ring-orange-300 min-h-[96px]",
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

async function uploadToBucket({ file, bucket = "ppsjustificatifs" }) {
  if (!file) throw new Error("Aucun fichier");

  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id || "public";

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `justificatifs/${userId}/${Date.now()}_${safeName}`;

  const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
  });
  if (upErr) throw upErr;

  // Si bucket privé, on tente un signed URL ; sinon publicUrl peut suffire
  const { data: signed, error: sErr } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
  if (!sErr && signed?.signedUrl) {
    return { path, url: signed.signedUrl, bucket };
  }

  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
  return { path, url: pub?.publicUrl || null, bucket };
}

export default function ClientTest() {
  const [courseId, setCourseId] = useState("");
  const [formatId, setFormatId] = useState("");

  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [format, setFormat] = useState(null);

  const [loadErr, setLoadErr] = useState(null);
  const [loadingEntity, setLoadingEntity] = useState(false);

  // état “inscription justificatif”
  const [j, setJ] = useState({
    justificatif_type: "",
    pps_identifier: "",
    pps_expiry_date: "",
    numero_licence: "",
    federation_code: "",
    justificatif_url: "",
    justificatif_bucket: "ppsjustificatifs",
    justificatif_path: "",
  });

  const { loading, error, catalogue, allowedTypes, isRequired, notes, allowMedicalUpload, debug, refresh } =
    useJustificatifConfig({
      course,
      format,
      courseId: course?.id || courseId || null,
      formatId: format?.id || formatId || null,
      enabled: Boolean(course?.id || courseId),
      defaults: { required: false, allowMedicalUpload: false, allowedTypes: [] },
    });

  const catalogueActive = useMemo(
    () => (catalogue || []).filter((t) => t.is_active !== false),
    [catalogue]
  );

  const allowedSet = useMemo(() => new Set((allowedTypes || []).map(normalizeCode)), [allowedTypes]);

  const filteredCatalogue = useMemo(() => {
    // Si allowedTypes vide → on laisse tout (mais ton hook remplace normalement par activeCodes)
    if (!allowedTypes || !allowedTypes.length) return catalogueActive;
    return catalogueActive.filter((t) => allowedSet.has(normalizeCode(t.code)));
  }, [catalogueActive, allowedTypes, allowedSet]);

  // type sélectionné : défaut = 1er type autorisé
  useEffect(() => {
    if (!j.justificatif_type) {
      const first = (allowedTypes && allowedTypes[0]) || (filteredCatalogue[0]?.code || "");
      if (first) setJ((p) => ({ ...p, justificatif_type: first }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedTypes, filteredCatalogue]);

  async function loadCourseAndFormats() {
    setLoadErr(null);
    setLoadingEntity(true);
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

      // auto-select 1er format si aucun
      if (!formatId && (fs || []).length) {
        setFormatId(fs[0].id);
      }
    } catch (e) {
      setLoadErr(e);
    } finally {
      setLoadingEntity(false);
    }
  }

  async function loadFormat() {
    setLoadErr(null);
    setLoadingEntity(true);
    try {
      if (!formatId) {
        setFormat(null);
        return;
      }
      const { data: f, error: fErr } = await supabase.from("formats").select("*").eq("id", formatId).single();
      if (fErr) throw fErr;
      setFormat(f);
    } catch (e) {
      setLoadErr(e);
    } finally {
      setLoadingEntity(false);
    }
  }

  useEffect(() => {
    if (courseId) loadCourseAndFormats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (formatId) loadFormat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatId]);

  const selectedType = normalizeCode(j.justificatif_type);

  const typeRow = useMemo(() => {
    const code = normalizeCode(j.justificatif_type);
    return (filteredCatalogue || []).find((t) => normalizeCode(t.code) === code) || null;
  }, [filteredCatalogue, j.justificatif_type]);

  const inputMode = typeRow?.input_mode || "text"; // "upload" vs "text" (selon ta table justificatif_types)
  const isUpload = inputMode === "upload";

  const missingReason = useMemo(() => {
    if (!isRequired) return null;

    if (!selectedType) return "Type requis.";
    if (isUpload) return j.justificatif_url ? null : "Document requis.";
    // mode text : PPS ou licence etc.
    if (selectedType.includes("pps")) return j.pps_identifier?.trim() ? null : "Code PPS requis.";
    if (selectedType.includes("licence")) return j.numero_licence?.trim() ? null : "Numéro de licence requis.";
    return null;
  }, [isRequired, selectedType, isUpload, j]);

  async function onUploadFile(file) {
    try {
      const out = await uploadToBucket({ file, bucket: "ppsjustificatifs" });
      setJ((p) => ({
        ...p,
        justificatif_bucket: out.bucket,
        justificatif_path: out.path,
        justificatif_url: out.url || "",
      }));
    } catch (e) {
      alert(e?.message || String(e));
    }
  }

  const payloadPreview = useMemo(() => {
    return {
      course_id: course?.id || courseId || null,
      format_id: format?.id || formatId || null,
      // ce que tu copieras dans inscriptions :
      justificatif_type: j.justificatif_type,
      pps_identifier: j.pps_identifier || null,
      pps_expiry_date: j.pps_expiry_date || null,
      numero_licence: j.numero_licence || null,
      federation_code: j.federation_code || null,
      justificatif_url: j.justificatif_url || null,
      // debug upload
      _bucket: j.justificatif_bucket,
      _path: j.justificatif_path,
      // contexte policy
      policy: { isRequired, allowedTypes, allowMedicalUpload, notes },
      debug,
    };
  }, [course, format, courseId, formatId, j, isRequired, allowedTypes, allowMedicalUpload, notes, debug]);

  return (
    <Container>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-orange-600">TEST</div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">ClientTest — Justificatifs</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Simule la partie justificatif de <span className="font-semibold">InscriptionCourse</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={refresh} className="bg-white text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50">
            Recharger config
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Left: load course/format */}
        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div className="font-bold text-neutral-900">Contexte</div>
              <div className="flex gap-2">
                {loading && <Pill>config…</Pill>}
                {loadingEntity && <Pill>load…</Pill>}
              </div>
            </div>

            <div className="mt-4 grid gap-4">
              <div>
                <Label>Course ID</Label>
                <div className="mt-1 flex gap-2">
                  <Input value={courseId} onChange={(e) => setCourseId(e.target.value)} placeholder="uuid course_id" />
                  <Button onClick={loadCourseAndFormats} disabled={!courseId}>
                    Charger
                  </Button>
                </div>
              </div>

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

              {(loadErr || error) && (
                <div className="rounded-xl bg-red-50 ring-1 ring-red-200 p-3 text-sm text-red-800">
                  {String(loadErr?.message || error?.message || loadErr || error)}
                </div>
              )}

              <div className="rounded-xl bg-neutral-50 ring-1 ring-neutral-200 p-3 text-xs text-neutral-700">
                <div className="font-semibold">Policy résolue</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Pill>required: {String(isRequired)}</Pill>
                  <Pill>allowUpload: {String(allowMedicalUpload)}</Pill>
                  <Pill>allowed: {(allowedTypes || []).length}</Pill>
                </div>
                {notes ? <div className="mt-2 text-neutral-600">{notes}</div> : null}
              </div>
            </div>
          </div>
        </Card>

        {/* Right: justificatif form */}
        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div className="font-bold text-neutral-900">Justificatif</div>
              {missingReason ? <Pill>⚠ {missingReason}</Pill> : <Pill>OK</Pill>}
            </div>

            <div className="mt-4 grid gap-4">
              <div>
                <Label>Type</Label>
                <div className="mt-1">
                  <select
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                    value={j.justificatif_type}
                    onChange={(e) =>
                      setJ((p) => ({
                        ...p,
                        justificatif_type: e.target.value,
                        // mini “sanitize”
                        pps_identifier: "",
                        pps_expiry_date: "",
                        numero_licence: "",
                        federation_code: "",
                        justificatif_url: "",
                        justificatif_path: "",
                      }))
                    }
                  >
                    {filteredCatalogue.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.label} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>
                {typeRow?.description ? (
                  <div className="mt-1 text-xs text-neutral-500">{typeRow.description}</div>
                ) : null}
              </div>

              {/* Mode text : PPS / licence */}
              {!isUpload && (
                <>
                  {selectedType.includes("pps") && (
                    <>
                      <div>
                        <Label>Code PPS</Label>
                        <div className="mt-1">
                          <Input
                            value={j.pps_identifier}
                            onChange={(e) => setJ((p) => ({ ...p, pps_identifier: e.target.value }))}
                            placeholder="ex: PPS-XXXX-XXXX"
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Date d’expiration (optionnel)</Label>
                        <div className="mt-1">
                          <Input
                            type="date"
                            value={j.pps_expiry_date}
                            onChange={(e) => setJ((p) => ({ ...p, pps_expiry_date: e.target.value }))}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {selectedType.includes("licence") && (
                    <>
                      <div>
                        <Label>Numéro de licence</Label>
                        <div className="mt-1">
                          <Input
                            value={j.numero_licence}
                            onChange={(e) => setJ((p) => ({ ...p, numero_licence: e.target.value }))}
                            placeholder="ex: 1234567"
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Fédération (optionnel selon type)</Label>
                        <div className="mt-1">
                          <Input
                            value={j.federation_code}
                            onChange={(e) => setJ((p) => ({ ...p, federation_code: e.target.value }))}
                            placeholder="ex: FFA / FFC / FFTRI"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Mode upload */}
              {isUpload && (
                <>
                  <div className="rounded-xl bg-neutral-50 ring-1 ring-neutral-200 p-3 text-sm text-neutral-700">
                    Upload dans <span className="font-semibold">ppsjustificatifs</span>
                    {!allowMedicalUpload && (
                      <div className="mt-1 text-xs text-neutral-500">
                        (allowMedicalUpload=false : tu peux quand même tester ici, mais tu le bloqueras côté UI finale)
                      </div>
                    )}
                  </div>

                  <div>
                    <Label>Fichier</Label>
                    <div className="mt-1 flex items-center gap-3">
                      <Input
                        type="file"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onUploadFile(f);
                        }}
                      />
                    </div>

                    {j.justificatif_url ? (
                      <div className="mt-2 text-xs text-neutral-600 break-all">
                        <div className="font-semibold">URL</div>
                        <a className="text-orange-700 underline" href={j.justificatif_url} target="_blank" rel="noreferrer">
                          {j.justificatif_url}
                        </a>
                      </div>
                    ) : null}
                  </div>
                </>
              )}

              <div>
                <Label>Debug payload (ce que tu copieras dans inscriptions)</Label>
                <div className="mt-1">
                  <Textarea readOnly value={JSON.stringify(payloadPreview, null, 2)} />
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Container>
  );
}

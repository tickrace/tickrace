// src/pages/ClientTest.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";
import JustificatifFfaPps from "../components/JustificatifFfaPps";

export default function ClientTest() {
  const [courseId, setCourseId] = useState("");
  const [loading, setLoading] = useState(false);

  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [formatId, setFormatId] = useState("");

  const [justifPolicy, setJustifPolicy] = useState({
    is_required: false,
    allow_medical_upload: true,
    allowed_types: [],
    notes: "",
  });
  const [justifTypes, setJustifTypes] = useState([]);

  const [state, setState] = useState({
    justificatif_type: "",
    numero_licence: "",
    pps_identifier: "",
    justificatif_url: "",
  });

  const [justifUploading, setJustifUploading] = useState(false);
  const [error, setError] = useState("");

  const selectedFormat = useMemo(
    () => formats.find((f) => f.id === formatId) || null,
    [formats, formatId]
  );

  async function load() {
    if (!courseId) return;
    setLoading(true);
    setError("");
    setCourse(null);
    setFormats([]);
    setFormatId("");
    try {
      const { data, error: e1 } = await supabase
        .from("courses")
        .select(
          `
          id, nom,
          formats ( id, nom, type_format, prix, nb_max_coureurs, waitlist_enabled, age_minimum )
        `
        )
        .eq("id", courseId)
        .single();
      if (e1) throw e1;

      setCourse(data);
      setFormats(data.formats || []);

      // policy course (format_id null)
      const { data: pol, error: polErr } = await supabase
        .from("course_justificatif_policies")
        .select("*")
        .eq("course_id", courseId)
        .is("format_id", null)
        .maybeSingle();

      if (!polErr && pol) {
        setJustifPolicy({
          is_required: pol.is_required !== false,
          allow_medical_upload: !!pol.allow_medical_upload,
          allowed_types: Array.isArray(pol.allowed_types) ? pol.allowed_types.filter(Boolean) : [],
          notes: pol.notes || "",
        });
      }

      const { data: jt, error: jtErr } = await supabase
        .from("justificatif_types")
        .select("code,label,input_mode,is_medical,sort_order,is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!jtErr) setJustifTypes(jt || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  const allowedTypeLabels = useMemo(() => {
    const map = new Map((justifTypes || []).map((t) => [t.code, t.label]));
    const codes = Array.isArray(justifPolicy.allowed_types) ? justifPolicy.allowed_types : [];
    return codes.map((c) => ({ code: c, label: map.get(c) || c }));
  }, [justifTypes, justifPolicy.allowed_types]);

  const showFfaPps = useMemo(() => {
    const codes = Array.isArray(justifPolicy.allowed_types) ? justifPolicy.allowed_types : [];
    if (codes.length === 0) return true;
    return codes.some((c) => /pps|ffa/i.test(String(c)));
  }, [justifPolicy.allowed_types]);

  async function handleUploadJustificatif(file) {
    if (!file) return;
    setJustifUploading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const user = sess?.session?.user;
      if (!user) {
        alert("Connecte-toi pour importer un justificatif.");
        return;
      }

      const bucket = "ppsjustificatifs";
      const safeName = String(file.name || "justificatif")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(0, 80);
      const path = `test/justif/${courseId}/${user.id}/${Date.now()}-${safeName}`;

      const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (error) throw error;

      const publicUrl = supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
      setState((p) => ({ ...p, justificatif_url: publicUrl }));
    } catch (e) {
      console.error("❌ upload justificatif:", e);
      alert("Erreur lors de l’upload.");
    } finally {
      setJustifUploading(false);
    }
  }

  function quickValidate() {
    const hasLicence = !!String(state.numero_licence || "").trim();
    const hasPps = !!String(state.pps_identifier || "").trim();
    const hasUpload = !!String(state.justificatif_url || "").trim();
    if (!justifPolicy.is_required) return { ok: true, msg: "Non requis." };
    if (hasLicence || hasPps || (justifPolicy.allow_medical_upload && hasUpload)) return { ok: true, msg: "OK." };
    return { ok: false, msg: "Justificatif requis manquant." };
  }

  const v = quickValidate();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6">
        <Link to="/test" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Index tests
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold mt-1">ClientTest</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Charge une course, sélectionne un format, teste le bloc justificatifs (sans payer).
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="p-5 border-b border-neutral-100 flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-xl">
            <div className="text-sm font-semibold text-neutral-700 mb-1">courseId</div>
            <input
              className="w-full rounded-xl border border-neutral-300 px-3 py-2"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              placeholder="uuid course"
            />
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading || !courseId}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
              loading || !courseId ? "bg-neutral-400 cursor-not-allowed" : "bg-neutral-900 hover:bg-black"
            }`}
          >
            {loading ? "Chargement..." : "Charger"}
          </button>
        </div>

        <div className="p-5">
          {error ? <div className="text-sm text-red-700">{error}</div> : null}

          {!course ? (
            <div className="text-sm text-neutral-600">Renseigne un courseId puis clique “Charger”.</div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="font-semibold">{course.nom}</div>
                <div className="mt-2">
                  <label className="text-sm font-semibold text-neutral-700">Format</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                    value={formatId}
                    onChange={(e) => setFormatId(e.target.value)}
                  >
                    <option value="">-- choisir --</option>
                    {formats.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nom} ({f.type_format || "individuel"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bloc justificatifs minimal */}
              <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <div className="p-5 border-b border-neutral-100">
                  <h2 className="text-lg font-semibold">Justificatifs (test)</h2>
                  <p className="text-sm text-neutral-500">
                    Policy course : {justifPolicy.is_required ? "obligatoire" : "optionnel"} ·{" "}
                    {justifPolicy.allow_medical_upload ? "upload autorisé" : "upload OFF"}
                  </p>
                </div>

                <div className="p-5 space-y-4">
                  {allowedTypeLabels.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {allowedTypeLabels.map((t) => (
                        <span key={t.code} className="text-xs px-2 py-0.5 rounded-full bg-neutral-50 border border-neutral-200">
                          {t.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {justifPolicy.notes ? (
                    <div className="text-xs text-neutral-700 whitespace-pre-wrap">{justifPolicy.notes}</div>
                  ) : null}

                  {showFfaPps && (
                    <JustificatifFfaPps
                      key={selectedFormat?.id || "no-format"}
                      licenceFfa={state.numero_licence || ""}
                      ppsCode={state.pps_identifier || ""}
                      onChange={({ licenceFfa, ppsCode }) => {
                        setState((p) => ({ ...p, numero_licence: licenceFfa, pps_identifier: ppsCode }));
                      }}
                    />
                  )}

                  {justifPolicy.allow_medical_upload && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-neutral-800">Upload (photo/PDF)</div>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => handleUploadJustificatif(e.target.files?.[0])}
                        className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-xl file:border file:border-neutral-200 file:bg-white file:px-3 file:py-2 hover:file:bg-neutral-50"
                        disabled={justifUploading}
                      />
                      {state.justificatif_url ? (
                        <div className="text-xs text-neutral-700 break-all">
                          URL :{" "}
                          <a className="underline" href={state.justificatif_url} target="_blank" rel="noreferrer">
                            {state.justificatif_url}
                          </a>
                        </div>
                      ) : (
                        <div className="text-xs text-neutral-500">Aucun fichier importé.</div>
                      )}
                    </div>
                  )}

                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                          v.ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {v.ok ? "OK" : "KO"}
                      </span>
                      <span className="text-sm text-neutral-700">{v.msg}</span>
                    </div>

                    <pre className="mt-3 text-xs bg-white border border-neutral-200 rounded-xl p-3 overflow-auto">
{JSON.stringify({ courseId, formatId, justificatif: state, policy: justifPolicy }, null, 2)}
                    </pre>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/inscription/${course.id}`}
                      className="rounded-xl bg-neutral-900 text-white px-4 py-2 text-sm font-semibold hover:bg-black transition"
                    >
                      Aller sur vraie page inscription →
                    </Link>
                    <Link
                      to={`/courses/${course.id}`}
                      className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50 transition"
                    >
                      Voir page course →
                    </Link>
                  </div>
                </div>
              </div>

              {!formatId && (
                <div className="text-sm text-amber-700">
                  Choisis un format pour stabiliser la clé du composant et tester comme un vrai flux.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

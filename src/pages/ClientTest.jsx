// src/pages/ClientTest.jsx
import React, { useMemo, useState } from "react";
import { useJustificatifConfig } from "../hooks/useJustificatifConfig";

// Si tu as bien ce composant : il servira d’orchestrateur.
// Sinon tu peux commenter l’import et la section correspondante.
import JustificatifManager from "../components/JustificatifManager";

export default function ClientTest() {
  const [courseId, setCourseId] = useState("");
  const [formatId, setFormatId] = useState("");

  // Contexte “client”
  const [sportCode, setSportCode] = useState("trail");
  const [federationCode, setFederationCode] = useState("FFA");
  const [age, setAge] = useState(30);

  // State “inscription” minimal
  const [value, setValue] = useState({
    justificatif_type: "",     // ex: "pps" / "licence_ffa" / etc (selon ton système)
    pps_identifier: "",
    pps_expiry_date: "",
    numero_licence: "",
    federation_code: "",
    justificatif_url: "",
  });

  const enabled = Boolean(courseId);

  const { loading, catalogue, allowedTypes, isRequired, allowMedicalUpload, notes, debug } =
    useJustificatifConfig({
      courseId: courseId || null,
      formatId: formatId || null,
      enabled,
      defaults: { required: true, allowMedicalUpload: false, allowedTypes: [] },
    });

  const activeCatalogue = useMemo(
    () => (catalogue || []).filter((t) => t.is_active !== false),
    [catalogue]
  );

  // Validation simple “présence”
  const validation = useMemo(() => {
    if (!isRequired) return { ok: true, errors: [] };

    const hasPps = !!String(value.pps_identifier || "").trim();
    const hasLicence = !!String(value.numero_licence || "").trim();
    const hasUpload = !!String(value.justificatif_url || "").trim();

    // règle de base: un des 3
    const ok = hasPps || hasLicence || (allowMedicalUpload && hasUpload);

    const errors = [];
    if (!ok) errors.push("Justificatif requis : PPS ou licence, ou upload si autorisé.");

    return { ok, errors };
  }, [isRequired, allowMedicalUpload, value]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold">ClientTest — Justificatifs (inscription)</h1>
      <p className="text-sm text-neutral-600 mt-1">
        Cette page simule la partie justificatifs de <b>InscriptionCourse</b>, avec lecture de la policy.
      </p>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="p-5 border-b border-neutral-100">
              <h2 className="text-lg font-semibold">Source policy</h2>
              <p className="text-sm text-neutral-500">Renseigne un courseId (et optionnellement formatId).</p>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-sm font-medium">courseId</label>
                <input
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                  placeholder="uuid course"
                />
              </div>

              <div>
                <label className="text-sm font-medium">formatId (optionnel)</label>
                <input
                  value={formatId}
                  onChange={(e) => setFormatId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                  placeholder="uuid format (ou vide = policy globale)"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="text-sm font-medium">sportCode</label>
                  <select
                    value={sportCode}
                    onChange={(e) => setSportCode(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                  >
                    <option value="trail">trail</option>
                    <option value="running">running</option>
                    <option value="route">route</option>
                    <option value="vtt">vtt</option>
                    <option value="triathlon">triathlon</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">federationCode</label>
                  <input
                    value={federationCode}
                    onChange={(e) => setFederationCode(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                    placeholder="FFA / FFC / FFTRI…"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Âge</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value || 0))}
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                    min={0}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="p-5 border-b border-neutral-100">
              <h2 className="text-lg font-semibold">Justificatif (UI)</h2>
              <p className="text-sm text-neutral-500">
                Ici on branche le système complet (Manager/Rules/Fields) si disponible.
              </p>
            </div>

            <div className="p-5 space-y-4">
              {loading && enabled ? (
                <div className="text-sm text-neutral-500">Chargement config…</div>
              ) : (
                <>
                  {notes ? (
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 whitespace-pre-wrap">
                      {notes}
                    </div>
                  ) : null}

                  {/* ✅ Orchestrateur si présent */}
                  {JustificatifManager ? (
                    <JustificatifManager
                      value={value}
                      onChange={(patch) => {
                        // patch ou valeur complète : on accepte les 2
                        if (patch && typeof patch === "object" && !Array.isArray(patch)) {
                          // si patch contient déjà tous les champs, ok aussi
                          setValue((prev) => ({ ...prev, ...patch }));
                        }
                      }}
                      // config
                      catalogue={activeCatalogue}
                      allowedTypes={allowedTypes}
                      required={isRequired}
                      allowMedicalUpload={allowMedicalUpload}
                      notes={notes}
                      // contexte
                      sportCode={sportCode}
                      federationCode={federationCode}
                      age={age}
                    />
                  ) : (
                    // Fallback ultra simple (au cas où)
                    <div className="space-y-3">
                      <div className="text-sm text-amber-700">
                        JustificatifManager non disponible → fallback minimal.
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          className="rounded-xl border border-neutral-300 px-3 py-2"
                          placeholder="Code PPS"
                          value={value.pps_identifier}
                          onChange={(e) => setValue((p) => ({ ...p, pps_identifier: e.target.value }))}
                        />
                        <input
                          className="rounded-xl border border-neutral-300 px-3 py-2"
                          placeholder="N° licence"
                          value={value.numero_licence}
                          onChange={(e) => setValue((p) => ({ ...p, numero_licence: e.target.value }))}
                        />
                      </div>
                      {allowMedicalUpload && (
                        <input
                          className="rounded-xl border border-neutral-300 px-3 py-2"
                          placeholder="URL upload (test)"
                          value={value.justificatif_url}
                          onChange={(e) => setValue((p) => ({ ...p, justificatif_url: e.target.value }))}
                        />
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Résultat validation */}
              <div className={`rounded-xl border p-3 text-sm ${validation.ok ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="font-semibold">
                  {validation.ok ? "✅ Validation OK" : "⚠️ Validation incomplète"}
                </div>
                {!validation.ok && (
                  <ul className="mt-1 list-disc pl-5">
                    {validation.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Debug value */}
              <details className="rounded-xl border border-neutral-200 p-3">
                <summary className="cursor-pointer text-sm font-semibold">Debug state</summary>
                <pre className="mt-2 text-xs overflow-auto bg-neutral-50 p-3 rounded-lg">
{JSON.stringify({ value, allowedTypes, isRequired, allowMedicalUpload, debug }, null, 2)}
                </pre>
              </details>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm sticky top-6">
            <div className="p-5 border-b border-neutral-100">
              <h3 className="text-lg font-semibold">Config effective</h3>
              <p className="text-sm text-neutral-500">Ce que le client “voit”.</p>
            </div>

            <div className="p-5 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-neutral-600">Requis</span>
                <b>{String(isRequired)}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Upload</span>
                <b>{String(allowMedicalUpload)}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Catalogue</span>
                <b>{debug?.catalogueTable || "—"}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Policy DB</span>
                <b>{debug?.dbPolicyTable || "—"}</b>
              </div>

              <div className="h-px bg-neutral-200 my-2" />

              <div className="text-xs text-neutral-600">allowedTypes</div>
              <div className="flex flex-wrap gap-1">
                {(allowedTypes || []).slice(0, 12).map((c) => (
                  <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 border">
                    {c}
                  </span>
                ))}
                {(allowedTypes || []).length > 12 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 border">
                    +{(allowedTypes || []).length - 12}
                  </span>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

import React, { useMemo, useState } from "react";
import { supabase } from "../supabase";
import {
  computeJustificatifRules,
  TYPE_PPS,
  TYPE_LICENCE_FFA,
  TYPE_LICENCE_AUTRE,
  TYPE_CERTIF_MEDICAL,
  TYPE_AUTRE_DOC,
} from "../components/JustificatifRulesEngine";

/* ------------------------------ UI helpers ------------------------------ */
const Card = ({ title, subtitle, children }) => (
  <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
    <div className="p-5 border-b border-neutral-100">
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle ? <p className="text-sm text-neutral-500 mt-1">{subtitle}</p> : null}
    </div>
    <div className="p-5">{children}</div>
  </section>
);

const Badge = ({ children }) => (
  <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-700">
    {children}
  </span>
);

const Field = ({ label, children, hint }) => (
  <label className="block">
    <div className="text-xs font-semibold text-neutral-600">{label}</div>
    <div className="mt-1">{children}</div>
    {hint ? <div className="mt-1 text-xs text-neutral-500">{hint}</div> : null}
  </label>
);

/* ------------------------------ Page ------------------------------ */
export default function ClientTest() {
  // Contexte (simule course/format)
  const [ctx, setCtx] = useState({
    country: "FR",
    sportCode: "trail",
    federationCode: "FFA",
    age: 30,
  });

  // Policy (simule course_justificatif_policies + overrides format)
  const [policy, setPolicy] = useState({
    require_justificatif: true,
    enable_upload: true,
    allow_certif_medical: false, // safe par défaut
    allow_other_doc: true,
    require_expiry_for_pps: false,
    minor_requires_parental_doc: false,
    accepted_types: null, // si tu mets un array => override dur
  });

  // Valeur “inscription” (simule table inscriptions)
  const [value, setValue] = useState({
    justificatif_type: "",
    pps_identifier: "",
    pps_expiry_date: "",
    numero_licence: "",
    federation_code: "",
    justificatif_url: "",
  });

  const rules = useMemo(() => computeJustificatifRules({ ...ctx, policy }), [ctx, policy]);
  const allowed = rules.allowedTypes || [];
  const primaryType = rules.recommendations?.primaryType || allowed[0] || "";

  const chosenType = value.justificatif_type || primaryType || "";

  const validation = useMemo(() => rules.validate(value), [rules, value]);

  function setField(name, v) {
    setValue((p) => ({ ...p, [name]: v }));
  }

  function setType(t) {
    // nettoyage léger quand on change de type (évite mélanges)
    setValue((prev) => {
      const next = { ...prev, justificatif_type: t };
      if (t === TYPE_PPS) {
        next.numero_licence = "";
        next.federation_code = "";
        next.justificatif_url = "";
      } else if (t === TYPE_LICENCE_FFA) {
        next.pps_identifier = "";
        next.pps_expiry_date = "";
        next.federation_code = "";
        next.justificatif_url = "";
      } else if (t === TYPE_LICENCE_AUTRE) {
        next.pps_identifier = "";
        next.pps_expiry_date = "";
        next.justificatif_url = "";
      } else if (t === TYPE_CERTIF_MEDICAL || t === TYPE_AUTRE_DOC) {
        next.pps_identifier = "";
        next.pps_expiry_date = "";
        next.numero_licence = "";
        next.federation_code = "";
        // justificatif_url conservé
      }
      return next;
    });
  }

  async function uploadFile(file) {
    if (!file) return;

    try {
      // bucket que tu as déjà : ppsjustificatifs
      const bucket = "ppsjustificatifs";
      const safeName = String(file.name || "justificatif").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
      const path = `test/justif/${Date.now()}-${safeName}`;

      const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });

      if (error) throw error;

      const publicUrl = supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
      setField("justificatif_url", publicUrl);
    } catch (e) {
      console.error("❌ uploadFile:", e);
      alert("Upload impossible (vérifie bucket/RLS). Tu peux aussi coller une URL manuellement.");
    }
  }

  const typeLabel = (t) => {
    switch (t) {
      case TYPE_PPS:
        return "PPS";
      case TYPE_LICENCE_FFA:
        return "Licence FFA";
      case TYPE_LICENCE_AUTRE:
        return "Licence autre fédé";
      case TYPE_CERTIF_MEDICAL:
        return "Certificat médical (upload)";
      case TYPE_AUTRE_DOC:
        return "Autre document (upload)";
      default:
        return t;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">ClientTest — Justificatifs</h1>
        <p className="text-neutral-600 mt-1">
          Sandbox pour tester les règles, les types autorisés, la validation et l’upload (sans la partie inscription/paiement).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Col gauche : contexte + policy */}
        <div className="lg:col-span-1 space-y-6">
          <Card title="Contexte" subtitle="Simule course/format (sport, pays, fédé, âge).">
            <div className="space-y-4">
              <Field label="Pays">
                <select
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                  value={ctx.country}
                  onChange={(e) => setCtx((p) => ({ ...p, country: e.target.value }))}
                >
                  <option value="FR">FR</option>
                  <option value="ES">ES</option>
                  <option value="IT">IT</option>
                  <option value="US">US</option>
                </select>
              </Field>

              <Field label="Sport (sportCode)">
                <select
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                  value={ctx.sportCode}
                  onChange={(e) => setCtx((p) => ({ ...p, sportCode: e.target.value }))}
                >
                  <option value="trail">trail</option>
                  <option value="running">running</option>
                  <option value="route">route</option>
                  <option value="vtt">vtt</option>
                  <option value="cycling">cycling</option>
                  <option value="triathlon">triathlon</option>
                </select>
              </Field>

              <Field label="Fédération (federationCode)">
                <input
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                  value={ctx.federationCode}
                  onChange={(e) => setCtx((p) => ({ ...p, federationCode: e.target.value }))}
                  placeholder="FFA / FFC / FFTRI / ..."
                />
              </Field>

              <Field label="Âge">
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                  value={ctx.age}
                  onChange={(e) => setCtx((p) => ({ ...p, age: Number(e.target.value || 0) }))}
                />
              </Field>
            </div>
          </Card>

          <Card title="Policy (override)" subtitle="Simule ce que l’orga configure côté course/format.">
            <div className="space-y-3 text-sm">
              {[
                ["require_justificatif", "Justificatif requis"],
                ["enable_upload", "Upload autorisé (global)"],
                ["allow_certif_medical", "Autoriser certificat médical (upload)"],
                ["allow_other_doc", "Autoriser autre document (upload)"],
                ["require_expiry_for_pps", "PPS doit avoir une date d’expiration"],
                ["minor_requires_parental_doc", "Mineur : doc parental recommandé"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!policy[key]}
                    onChange={(e) => setPolicy((p) => ({ ...p, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}

              <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-xs font-semibold text-neutral-700">Override dur des types (optionnel)</div>
                <div className="text-xs text-neutral-500 mb-2">
                  Si tu remplis ce champ (JSON array), ça remplace totalement le calcul automatique.
                </div>
                <textarea
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs font-mono"
                  rows={3}
                  value={policy.accepted_types ? JSON.stringify(policy.accepted_types) : ""}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    if (!raw) return setPolicy((p) => ({ ...p, accepted_types: null }));
                    try {
                      const arr = JSON.parse(raw);
                      if (Array.isArray(arr)) setPolicy((p) => ({ ...p, accepted_types: arr }));
                    } catch {
                      // ignore
                    }
                  }}
                  placeholder='Ex: ["PPS","LICENCE_FFA"]'
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Col milieu : formulaire justificatif */}
        <div className="lg:col-span-2 space-y-6">
          <Card
            title="Justificatif (simulation)"
            subtitle="Le type proposé + champs dépendent du contexte et des règles."
          >
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge>Allowed: {allowed.length ? allowed.map(typeLabel).join(", ") : "aucun"}</Badge>
              <Badge>Primary: {primaryType ? typeLabel(primaryType) : "—"}</Badge>
            </div>

            {allowed.length === 0 ? (
              <div className="text-sm text-neutral-600">Aucun justificatif requis / autorisé (selon policy).</div>
            ) : (
              <div className="space-y-4">
                <Field label="Type de justificatif">
                  <select
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                    value={chosenType}
                    onChange={(e) => setType(e.target.value)}
                  >
                    {allowed.map((t) => (
                      <option key={t} value={t}>
                        {typeLabel(t)}
                      </option>
                    ))}
                  </select>
                </Field>

                {(chosenType === TYPE_PPS) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Code PPS" hint="Ex: PPS-XXXX-XXXX (format libre ici)">
                      <input
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                        value={value.pps_identifier}
                        onChange={(e) => setField("pps_identifier", e.target.value)}
                      />
                    </Field>

                    <Field label="Date d’expiration PPS (si requis)">
                      <input
                        type="date"
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                        value={value.pps_expiry_date}
                        onChange={(e) => setField("pps_expiry_date", e.target.value)}
                      />
                    </Field>
                  </div>
                )}

                {(chosenType === TYPE_LICENCE_FFA) && (
                  <Field label="Numéro de licence FFA">
                    <input
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                      value={value.numero_licence}
                      onChange={(e) => setField("numero_licence", e.target.value)}
                      placeholder="N° licence"
                    />
                  </Field>
                )}

                {(chosenType === TYPE_LICENCE_AUTRE) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Numéro de licence">
                      <input
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                        value={value.numero_licence}
                        onChange={(e) => setField("numero_licence", e.target.value)}
                        placeholder="N° licence"
                      />
                    </Field>
                    <Field label="Code fédération (ex: FFC, FFTRI)">
                      <input
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                        value={value.federation_code}
                        onChange={(e) => setField("federation_code", e.target.value)}
                        placeholder="FFC / FFTRI / ..."
                      />
                    </Field>
                  </div>
                )}

                {(chosenType === TYPE_CERTIF_MEDICAL || chosenType === TYPE_AUTRE_DOC) && (
                  <div className="space-y-3">
                    <Field label="Uploader un fichier (bucket ppsjustificatifs)">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-xl file:border file:border-neutral-200 file:bg-white file:px-3 file:py-2 hover:file:bg-neutral-50"
                        onChange={(e) => uploadFile(e.target.files?.[0])}
                      />
                    </Field>

                    <Field label="…ou coller une URL (si upload bloqué)">
                      <input
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                        value={value.justificatif_url}
                        onChange={(e) => setField("justificatif_url", e.target.value)}
                        placeholder="https://..."
                      />
                    </Field>

                    {value.justificatif_url ? (
                      <div className="text-xs text-neutral-700 break-all">
                        URL :{" "}
                        <a className="underline" href={value.justificatif_url} target="_blank" rel="noreferrer">
                          {value.justificatif_url}
                        </a>
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="text-sm font-semibold">Validation</div>
                  {validation.ok ? (
                    <div className="mt-1 text-sm text-emerald-700">✅ OK</div>
                  ) : (
                    <div className="mt-1 text-sm text-red-700">
                      ❌ {validation.errors?.length ? validation.errors.join(" · ") : "Invalide"}
                    </div>
                  )}
                  {rules.recommendations?.notes?.length ? (
                    <div className="mt-2 text-xs text-neutral-600">
                      {rules.recommendations.notes.map((n, i) => (
                        <div key={i}>• {n}</div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <details className="rounded-xl border border-neutral-200 bg-white p-4">
                  <summary className="cursor-pointer text-sm font-semibold">Debug JSON</summary>
                  <pre className="mt-3 text-xs bg-neutral-50 border border-neutral-200 rounded-xl p-3 overflow-auto">
{JSON.stringify({ ctx, policy, rules: { allowedTypes: allowed, primaryType }, value }, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

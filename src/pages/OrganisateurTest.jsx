import React, { useMemo, useState } from "react";
import {
  TYPE_PPS,
  TYPE_LICENCE_FFA,
  TYPE_LICENCE_AUTRE,
  TYPE_CERTIF_MEDICAL,
  TYPE_AUTRE_DOC,
  computeJustificatifRules,
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

const ALL_TYPES = [TYPE_PPS, TYPE_LICENCE_FFA, TYPE_LICENCE_AUTRE, TYPE_CERTIF_MEDICAL, TYPE_AUTRE_DOC];

/* ------------------------------ Page ------------------------------ */
export default function OrganisateurTest() {
  // Simule “format” côté UpsertCourse
  const [format, setFormat] = useState({
    sportCode: "trail",
    federationCode: "FFA",
    country: "FR",
    ageExample: 30, // juste pour voir la règle mineur
  });

  // Config que l’orga choisit (ce que tu vas stocker en DB)
  // IMPORTANT: on stocke les types acceptés dans justificatif_rules.accepted_types
  // => évite l’erreur “accepted_justificatifs column missing”.
  const [cfg, setCfg] = useState({
    justificatif_required: true,
    enable_upload: true,
    allow_certif_medical: false,
    allow_other_doc: true,
    require_expiry_for_pps: false,
    minor_requires_parental_doc: false,
    accepted_types: null, // array ou null
  });

  // Règles calculées “par défaut” (si accepted_types null)
  const computed = useMemo(() => {
    const rules = computeJustificatifRules({
      country: format.country,
      sportCode: format.sportCode,
      federationCode: format.federationCode,
      age: format.ageExample,
      policy: {
        require_justificatif: cfg.justificatif_required,
        enable_upload: cfg.enable_upload,
        allow_certif_medical: cfg.allow_certif_medical,
        allow_other_doc: cfg.allow_other_doc,
        require_expiry_for_pps: cfg.require_expiry_for_pps,
        minor_requires_parental_doc: cfg.minor_requires_parental_doc,
        accepted_types: Array.isArray(cfg.accepted_types) ? cfg.accepted_types : null,
      },
    });
    return rules;
  }, [format, cfg]);

  const allowedTypes = computed.allowedTypes || [];
  const primaryType = computed.recommendations?.primaryType || allowedTypes[0] || "";

  // Pour “simuler UpsertCourse”: ce payload est ce qu’on sauvegarde dans formats
  const payloadToSave = useMemo(() => {
    return {
      justificatif_required: !!cfg.justificatif_required,
      // ✅ Pas de colonne accepted_justificatifs : on met ça dans justificatif_rules.accepted_types
      justificatif_rules: {
        accepted_types: Array.isArray(cfg.accepted_types) ? cfg.accepted_types : null,
        enable_upload: !!cfg.enable_upload,
        allow_certif_medical: !!cfg.allow_certif_medical,
        allow_other_doc: !!cfg.allow_other_doc,
        require_expiry_for_pps: !!cfg.require_expiry_for_pps,
        minor_requires_parental_doc: !!cfg.minor_requires_parental_doc,
      },
    };
  }, [cfg]);

  function toggleAccepted(t) {
    setCfg((p) => {
      const cur = Array.isArray(p.accepted_types) ? p.accepted_types : [];
      const next = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t];
      return { ...p, accepted_types: next.length ? next : [] };
    });
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">OrganisateurTest — Config justificatifs</h1>
        <p className="text-neutral-600 mt-1">
          Sandbox pour simuler la partie UpsertCourse : réglages + preview de ce qu’on stocke (sans colonne{" "}
          <code className="px-1 py-0.5 rounded bg-neutral-100">accepted_justificatifs</code>).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card title="Contexte format" subtitle="Simule les infos sport/pays/fédé du format.">
            <div className="space-y-4">
              <Field label="Pays">
                <select
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                  value={format.country}
                  onChange={(e) => setFormat((p) => ({ ...p, country: e.target.value }))}
                >
                  <option value="FR">FR</option>
                  <option value="ES">ES</option>
                  <option value="IT">IT</option>
                </select>
              </Field>

              <Field label="Sport du format (sportCode)">
                <select
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                  value={format.sportCode}
                  onChange={(e) => setFormat((p) => ({ ...p, sportCode: e.target.value }))}
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
                  value={format.federationCode}
                  onChange={(e) => setFormat((p) => ({ ...p, federationCode: e.target.value }))}
                  placeholder="FFA / FFC / FFTRI / ..."
                />
              </Field>

              <Field label="Âge exemple (pour règles mineur)">
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                  value={format.ageExample}
                  onChange={(e) => setFormat((p) => ({ ...p, ageExample: Number(e.target.value || 0) }))}
                />
              </Field>
            </div>
          </Card>

          <Card title="Réglages organisateur" subtitle="Ce que l’orga configure (stocké en DB).">
            <div className="space-y-3 text-sm">
              {[
                ["justificatif_required", "Justificatif requis"],
                ["enable_upload", "Upload autorisé (global)"],
                ["allow_certif_medical", "Autoriser certificat médical (upload)"],
                ["allow_other_doc", "Autoriser autre document (upload)"],
                ["require_expiry_for_pps", "PPS doit avoir date d’expiration"],
                ["minor_requires_parental_doc", "Mineur : doc parental recommandé"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!cfg[key]}
                    onChange={(e) => setCfg((p) => ({ ...p, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}

              <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-xs font-semibold text-neutral-700">
                  Types acceptés (override) — optionnel
                </div>
                <div className="text-xs text-neutral-500 mb-2">
                  Si tu coches ici, tu forces <code className="px-1 rounded bg-white border">justificatif_rules.accepted_types</code>.
                  Sinon, on laisse vide et on suit le calcul auto.
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {ALL_TYPES.map((t) => (
                    <label key={t} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Array.isArray(cfg.accepted_types) ? cfg.accepted_types.includes(t) : false}
                        onChange={() => toggleAccepted(t)}
                      />
                      {typeLabel(t)}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-3 text-xs underline text-neutral-700"
                  onClick={() => setCfg((p) => ({ ...p, accepted_types: null }))}
                >
                  Réinitialiser (revenir au calcul auto)
                </button>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card title="Résultat (règles calculées)" subtitle="C’est ce que verra ClientTest côté coureur si on n’override pas.">
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge>Allowed: {allowedTypes.length ? allowedTypes.map(typeLabel).join(", ") : "aucun"}</Badge>
              <Badge>Primary: {primaryType ? typeLabel(primaryType) : "—"}</Badge>
            </div>

            {computed.recommendations?.notes?.length ? (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                {computed.recommendations.notes.map((n, i) => (
                  <div key={i}>• {n}</div>
                ))}
              </div>
            ) : null}

            <details className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold">Debug rules JSON</summary>
              <pre className="mt-3 text-xs bg-neutral-50 border border-neutral-200 rounded-xl p-3 overflow-auto">
{JSON.stringify(
  {
    context: format,
    cfg,
    result: {
      allowedTypes,
      primaryType,
      requiredFieldsByType: computed.requiredFieldsByType,
    },
  },
  null,
  2
)}
              </pre>
            </details>
          </Card>

          <Card
            title="Payload à sauvegarder (formats)"
            subtitle="✅ Compatible sans colonne accepted_justificatifs : on stocke accepted_types dans justificatif_rules."
          >
            <pre className="text-xs bg-neutral-50 border border-neutral-200 rounded-xl p-3 overflow-auto">
{JSON.stringify(payloadToSave, null, 2)}
            </pre>

            <div className="mt-3 text-sm text-neutral-700">
              <div className="font-semibold">Conseil (pour corriger ton erreur actuelle)</div>
              <div className="mt-1 text-sm text-neutral-600">
                Tant que la colonne <code className="px-1 rounded bg-neutral-100">accepted_justificatifs</code> n’existe pas,
                ne la <b>select</b> jamais dans Supabase. Utilise{" "}
                <code className="px-1 rounded bg-neutral-100">formats.justificatif_rules.accepted_types</code> à la place.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

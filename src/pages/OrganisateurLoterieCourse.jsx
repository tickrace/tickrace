// src/pages/OrganisateurLoterieCourse.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Loader2,
  Lock,
  Save,
  Settings2,
  Timer,
  Info,
  Sparkles,
  Mail,
  Play,
  Send,
  Users,
  AlertTriangle,
  RefreshCcw,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../supabase";

/**
 * Page organisateur (par course) : liste des formats + activation/paramétrage loterie
 * Route : /organisateur/loterie/:courseId
 *
 * But :
 * - Activer la loterie par format
 * - Définir fenêtre de préinscription + TTL invitations
 * - Donner une compréhension claire du workflow
 * - Accès direct à /organisateur/tirage/:formatId
 *
 * Notes importantes (UX) :
 * - “Lancer tirage” et “Libérer des invitations” se font dans la page /organisateur/tirage/:formatId.
 * - Cette page sert à CONFIGURER et à vérifier que tout est cohérent.
 *
 * Table utilisée : format_lottery_settings (PK: format_id)
 * - enabled, pre_open_at, pre_close_at, pre_closed_at, draw_at, invite_ttl_hours
 */

const Container = ({ children }) => (
  <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">{children}</div>
);

const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 ${className}`}>{children}</div>
);

const SectionTitle = ({ icon: Icon, title, subtitle, right }) => (
  <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-100">
    <div className="flex items-start gap-3">
      {Icon ? (
        <div className="h-10 w-10 rounded-2xl bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-gray-800" />
        </div>
      ) : null}
      <div>
        <div className="text-lg font-semibold text-gray-900">{title}</div>
        {subtitle ? <div className="text-sm text-gray-600 mt-1">{subtitle}</div> : null}
      </div>
    </div>
    {right ? <div className="shrink-0">{right}</div> : null}
  </div>
);

const Pill = ({ children, tone = "orange" }) => {
  const tones = {
    orange: "bg-orange-50 ring-orange-200 text-orange-700",
    green: "bg-green-50 ring-green-200 text-green-700",
    blue: "bg-blue-50 ring-blue-200 text-blue-700",
    gray: "bg-gray-50 ring-gray-200 text-gray-700",
    violet: "bg-violet-50 ring-violet-200 text-violet-800",
    amber: "bg-amber-50 ring-amber-200 text-amber-800",
    rose: "bg-rose-50 ring-rose-200 text-rose-800",
  };
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ${
        tones[tone] || tones.orange
      }`}
    >
      {children}
    </span>
  );
};

const Button = ({ children, className = "", disabled, onClick, type = "button", title }) => (
  <button
    type={type}
    disabled={disabled}
    onClick={onClick}
    title={title}
    className={[
      "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
      "ring-1 ring-gray-200 bg-white text-gray-900 hover:bg-gray-50",
      "disabled:opacity-60 disabled:cursor-not-allowed",
      className,
    ].join(" ")}
  >
    {children}
  </button>
);

const PrimaryButton = ({ children, className = "", disabled, onClick, type = "button", title }) => (
  <button
    type={type}
    disabled={disabled}
    onClick={onClick}
    title={title}
    className={[
      "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
      "bg-orange-600 text-white hover:bg-orange-700",
      "disabled:opacity-60 disabled:cursor-not-allowed",
      className,
    ].join(" ")}
  >
    {children}
  </button>
);

const Input = (props) => (
  <input
    {...props}
    className={[
      "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm",
      "focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300",
      props.className || "",
    ].join(" ")}
  />
);

const fmtDT = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("fr-FR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(d);
  }
};

// Convertit un timestamptz ISO -> value compatible datetime-local (YYYY-MM-DDTHH:mm)
function toDatetimeLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

// Convertit datetime-local -> ISO (timestamptz)
function fromDatetimeLocalValue(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function defaultSettings(formatId) {
  return {
    format_id: formatId,
    enabled: false,
    pre_open_at: null,
    pre_close_at: null,
    pre_closed_at: null,
    draw_at: null,
    invite_ttl_hours: 72,
  };
}

function formatHealth(settings) {
  const enabled = Boolean(settings?.enabled);
  if (!enabled) return { ok: false, level: "off", text: "Désactivée" };

  const openOk = Boolean(settings?.pre_open_at);
  const closeOk = Boolean(settings?.pre_close_at);
  if (!openOk || !closeOk) return { ok: false, level: "warn", text: "Dates manquantes" };

  const o = new Date(settings.pre_open_at);
  const c = new Date(settings.pre_close_at);
  if (o > c) return { ok: false, level: "warn", text: "Ouverture > fermeture" };

  const ttl = Number(settings?.invite_ttl_hours ?? 0);
  if (!Number.isFinite(ttl) || ttl <= 0 || ttl > 720) return { ok: false, level: "warn", text: "TTL invalide" };

  return { ok: true, level: "ok", text: "Prêt" };
}

export default function OrganisateurLoterieCourse() {
  const { courseId } = useParams();

  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);

  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [settingsByFormat, setSettingsByFormat] = useState({});
  const [dirty, setDirty] = useState({});

  const hasDirty = useMemo(() => Object.values(dirty).some(Boolean), [dirty]);

  const load = async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const { data: c, error: ce } = await supabase
        .from("courses")
        .select("id, nom, lieu")
        .eq("id", courseId)
        .single();
      if (ce) throw ce;

      const { data: f, error: fe } = await supabase
        .from("formats")
        .select("id, course_id, nom, date, heure_depart, nb_max_coureurs, is_team_event, team_size")
        .eq("course_id", courseId)
        .order("date", { ascending: true });
      if (fe) throw fe;

      const earliestFormatDate =
        (f || [])
          .map((x) => x.date)
          .filter(Boolean)
          .sort()[0] || null;

      setCourse({ ...c, _earliestFormatDate: earliestFormatDate });
      setFormats(f || []);

      const ids = (f || []).map((x) => x.id);
      if (!ids.length) {
        setSettingsByFormat({});
        setDirty({});
        return;
      }

      const { data: s, error: se } = await supabase
        .from("format_lottery_settings")
        .select("*")
        .in("format_id", ids);
      if (se) throw se;

      const map = {};
      for (const id of ids) map[id] = defaultSettings(id);
      for (const row of s || []) map[row.format_id] = { ...defaultSettings(row.format_id), ...row };

      setSettingsByFormat(map);
      setDirty({});
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const patchSettings = (formatId, patch) => {
    setSettingsByFormat((prev) => ({
      ...prev,
      [formatId]: { ...(prev[formatId] || defaultSettings(formatId)), ...patch },
    }));
    setDirty((prev) => ({ ...prev, [formatId]: true }));
  };

  const validateRow = (row) => {
    const ttl = Number(row.invite_ttl_hours || 0);
    if (!Number.isFinite(ttl) || ttl <= 0 || ttl > 720) return "TTL invalide (1h à 720h).";

    if (row.enabled) {
      if (!row.pre_open_at || !row.pre_close_at) return "Renseigne au minimum les dates d’ouverture/fermeture.";
      if (new Date(row.pre_open_at) > new Date(row.pre_close_at)) return "La date d’ouverture doit être avant la fermeture.";
    }
    return null;
  };

  const saveOne = async (formatId) => {
    const row = settingsByFormat[formatId] || defaultSettings(formatId);
    try {
      const err = validateRow(row);
      if (err) {
        toast.error(err);
        return;
      }

      const payload = {
        format_id: formatId,
        enabled: Boolean(row.enabled),
        pre_open_at: row.pre_open_at,
        pre_close_at: row.pre_close_at,
        pre_closed_at: row.pre_closed_at,
        draw_at: row.draw_at,
        invite_ttl_hours: Number(row.invite_ttl_hours ?? 72),
      };

      const { error } = await supabase.from("format_lottery_settings").upsert(payload, { onConflict: "format_id" });
      if (error) throw error;

      setDirty((prev) => ({ ...prev, [formatId]: false }));
      toast.success("Paramètres enregistrés.");
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Impossible d’enregistrer.");
    }
  };

  const saveAll = async () => {
    const ids = formats.map((f) => f.id).filter((id) => dirty[id]);
    if (!ids.length) return;

    setSavingAll(true);
    try {
      const payloads = [];
      for (const id of ids) {
        const row = settingsByFormat[id] || defaultSettings(id);
        const err = validateRow(row);
        if (err) throw new Error(`Format ${id} : ${err}`);

        payloads.push({
          format_id: id,
          enabled: Boolean(row.enabled),
          pre_open_at: row.pre_open_at,
          pre_close_at: row.pre_close_at,
          pre_closed_at: row.pre_closed_at,
          draw_at: row.draw_at,
          invite_ttl_hours: Number(row.invite_ttl_hours ?? 72),
        });
      }

      const { error } = await supabase.from("format_lottery_settings").upsert(payloads, { onConflict: "format_id" });
      if (error) throw error;

      setDirty({});
      toast.success("Tous les paramètres ont été enregistrés.");
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Impossible d’enregistrer tous les formats.");
    } finally {
      setSavingAll(false);
    }
  };

  const quickApply = (mode) => {
    // “Assist” pour éviter de configurer format par format à la main
    // - mode: "openNow_7days" : ouvre maintenant et ferme +7j
    // - mode: "closeTonight" : ferme aujourd’hui à 23:59
    const now = new Date();
    const iso = (d) => d.toISOString();

    if (mode === "openNow_7days") {
      const close = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
      const patch = { enabled: true, pre_open_at: iso(now), pre_close_at: iso(close), invite_ttl_hours: 72 };
      for (const f of formats) patchSettings(f.id, patch);
      toast.success("Préremplissage appliqué : ouverture maintenant, fermeture +7j, TTL 72h.");
    }

    if (mode === "closeTonight") {
      const end = new Date(now);
      end.setHours(23, 59, 0, 0);
      const patch = { pre_close_at: iso(end) };
      for (const f of formats) patchSettings(f.id, patch);
      toast.success("Préremplissage appliqué : fermeture aujourd’hui 23:59.");
    }
  };

  if (loading) {
    return (
      <Container>
        <div className="flex items-center gap-3 text-gray-700">
          <Loader2 className="h-5 w-5 animate-spin" />
          <div>Chargement…</div>
        </div>
      </Container>
    );
  }

  if (!course) {
    return (
      <Container>
        <Card>
          <SectionTitle icon={AlertTriangle} title="Préinscription / Tirage au sort" subtitle="Course introuvable ou accès refusé." />
          <div className="p-5">
            <Link to="/organisateur" className="text-orange-700 underline">
              Retour
            </Link>
          </div>
        </Card>
      </Container>
    );
  }

  const readyCount = formats.filter((f) => formatHealth(settingsByFormat[f.id]).ok).length;
  const enabledCount = formats.filter((f) => Boolean(settingsByFormat[f.id]?.enabled)).length;

  return (
    <Container>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold text-gray-900">Préinscription / Tirage au sort</h1>
              <Pill>
                <Settings2 className="h-4 w-4" /> Paramétrage (par format)
              </Pill>
            </div>

            <div className="text-sm text-gray-600 mt-2">
              <div className="font-medium text-gray-900">{course.nom}</div>
              <div className="mt-1 inline-flex items-center gap-2 flex-wrap">
                <CalendarDays className="h-4 w-4" />
                <span>{fmtDT(course._earliestFormatDate)}</span>
                <span className="text-gray-300">•</span>
                <span>{course.lieu || "—"}</span>
                <span className="text-gray-300">•</span>
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {enabledCount}/{formats.length} format(s) activé(s)
                </span>
                <span className="text-gray-300">•</span>
                <span className="inline-flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4" />
                  {readyCount}/{formats.length} prêt(s)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={load} title="Recharge les formats + settings">
              <RefreshCcw className="h-4 w-4" />
              Recharger
            </Button>

            <PrimaryButton onClick={saveAll} disabled={!hasDirty || savingAll} title={!hasDirty ? "Aucune modification" : "Enregistre tous les formats modifiés"}>
              {savingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer tout
            </PrimaryButton>

            <Link
              to="/organisateur/mon-espace"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ring-1 ring-gray-200 bg-white hover:bg-gray-50"
            >
              Retour espace orga
              <ArrowUpRight className="h-4 w-4 opacity-70" />
            </Link>
          </div>
        </div>

        {/* Big explanation / workflow */}
        <Card>
          <SectionTitle
            icon={Info}
            title="Comment ça marche (en 4 étapes claires)"
            subtitle="Ici tu configures. Le tirage et les invitations se gèrent ensuite sur la page “Tirage” de chaque format."
          />
          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3 text-sm text-gray-700">
              <div className="rounded-2xl ring-1 ring-gray-200 p-4">
                <div className="font-semibold text-gray-900 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> 1) Activer la loterie par format
                </div>
                <div className="mt-1 text-gray-600">
                  Si la loterie est désactivée, le format fonctionne “normalement” (pas de préinscription).
                </div>
              </div>

              <div className="rounded-2xl ring-1 ring-gray-200 p-4">
                <div className="font-semibold text-gray-900 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" /> 2) Définir la fenêtre de préinscription
                </div>
                <div className="mt-1 text-gray-600">
                  Les coureurs peuvent candidater entre <span className="font-medium">ouverture</span> et{" "}
                  <span className="font-medium">fermeture</span>.
                </div>
              </div>

              <div className="rounded-2xl ring-1 ring-gray-200 p-4">
                <div className="font-semibold text-gray-900 flex items-center gap-2">
                  <Mail className="h-4 w-4" /> 3) Définir le TTL des invitations
                </div>
                <div className="mt-1 text-gray-600">
                  Quand tu libères un lot d’invitations, chaque invité a <span className="font-medium">X heures</span> pour s’inscrire.
                </div>
              </div>

              <div className="rounded-2xl bg-orange-50 ring-1 ring-orange-200 p-4">
                <div className="font-semibold text-orange-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> 4) Ensuite : Tirage + Libération
                </div>
                <div className="mt-1 text-orange-800">
                  Sur <span className="font-semibold">/organisateur/tirage/:formatId</span> :
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>
                      <span className="font-semibold">Lancer tirage</span> = classer tout le monde (ranked), <span className="font-semibold">aucun email</span>.
                    </li>
                    <li>
                      <span className="font-semibold">Libérer</span> = créer tokens + passer en invited + <span className="font-semibold">emails côté backend</span>.
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-gray-50 ring-1 ring-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-900">Assistants de configuration</div>
              <div className="text-xs text-gray-600 mt-1">Pour aller vite (applique aux formats listés ci-dessous).</div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button onClick={() => quickApply("openNow_7days")} title="Active + ouvre maintenant et ferme dans 7 jours">
                  <Play className="h-4 w-4" />
                  Ouvrir maintenant (+7j)
                </Button>
                <Button onClick={() => quickApply("closeTonight")} title="Met la fermeture à aujourd’hui 23:59">
                  <Timer className="h-4 w-4" />
                  Fermer ce soir (23:59)
                </Button>
              </div>

              <div className="mt-4 rounded-xl bg-white ring-1 ring-gray-200 p-3 text-xs text-gray-600">
                <div className="font-semibold text-gray-900">Checklist rapide</div>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Active la loterie</li>
                  <li>Ouverture + fermeture OK</li>
                  <li>TTL raisonnable (48–96h souvent)</li>
                  <li>Enregistre (bouton “Enregistrer”)</li>
                  <li>Ouvre la page Tirage pour lancer le tirage + libérer les lots</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>

        {/* Formats list */}
        <div className="grid grid-cols-1 gap-4">
          {!formats.length ? (
            <Card>
              <div className="p-5 text-sm text-gray-600">Aucun format trouvé sur cette course.</div>
            </Card>
          ) : null}

          {formats.map((f) => {
            const s = settingsByFormat[f.id] || defaultSettings(f.id);
            const isDirty = Boolean(dirty[f.id]);
            const enabled = Boolean(s.enabled);
            const health = formatHealth(s);

            return (
              <Card key={f.id}>
                <div className="p-5 flex flex-col gap-4">
                  {/* Top line */}
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-lg font-semibold text-gray-900">{f.nom || "Format"}</div>

                        {enabled ? (
                          <Pill tone="green">
                            <BadgeCheck className="h-4 w-4" /> Activée
                          </Pill>
                        ) : (
                          <Pill tone="gray">
                            <Lock className="h-4 w-4" /> Désactivée
                          </Pill>
                        )}

                        {f.is_team_event ? (
                          <Pill tone="blue">
                            <Users className="h-4 w-4" /> Équipe • taille {f.team_size}
                          </Pill>
                        ) : (
                          <Pill tone="gray">
                            <Users className="h-4 w-4" /> Solo
                          </Pill>
                        )}

                        {health.level === "ok" ? (
                          <Pill tone="green">✅ {health.text}</Pill>
                        ) : health.level === "warn" ? (
                          <Pill tone="amber">⚠️ {health.text}</Pill>
                        ) : (
                          <Pill tone="gray">{health.text}</Pill>
                        )}

                        {isDirty ? (
                          <Pill tone="amber">
                            <Timer className="h-4 w-4" /> Non enregistré
                          </Pill>
                        ) : null}
                      </div>

                      <div className="text-sm text-gray-600 mt-2 flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900">{fmtDT(f.date)}</span>
                        {f.nb_max_coureurs ? (
                          <>
                            <span className="text-gray-300">•</span>
                            <span>Quota {f.nb_max_coureurs}</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        onClick={() => patchSettings(f.id, { enabled: !enabled })}
                        className={enabled ? "ring-green-200 bg-green-50 text-green-800 hover:bg-green-100" : ""}
                        title="Active/désactive la loterie pour ce format"
                      >
                        {enabled ? "Désactiver" : "Activer"}
                      </Button>

                      <PrimaryButton onClick={() => saveOne(f.id)} title="Enregistre uniquement ce format">
                        <Save className="h-4 w-4" />
                        Enregistrer
                      </PrimaryButton>

                      <Link
                        to={`/organisateur/tirage/${f.id}`}
                        className={[
                          "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
                          enabled ? "bg-orange-600 text-white hover:bg-orange-700" : "bg-gray-200 text-gray-800 hover:bg-gray-300",
                        ].join(" ")}
                        title={enabled ? "Ouvrir l’interface tirage" : "Active la loterie puis enregistre pour accéder au tirage"}
                        aria-disabled={!enabled}
                        onClick={(e) => {
                          if (!enabled) {
                            e.preventDefault();
                            toast("Active la loterie puis enregistre pour accéder au tirage.");
                          }
                        }}
                      >
                        Ouvrir tirage
                        <ArrowUpRight className="h-4 w-4 opacity-90" />
                      </Link>
                    </div>
                  </div>

                  {/* Settings form */}
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1">Ouverture préinscription</div>
                      <Input
                        type="datetime-local"
                        value={toDatetimeLocalValue(s.pre_open_at)}
                        onChange={(e) => patchSettings(f.id, { pre_open_at: fromDatetimeLocalValue(e.target.value) })}
                        disabled={!enabled}
                      />
                      <div className="text-[11px] text-gray-500 mt-1">À partir de quand les coureurs peuvent candidater.</div>
                    </div>

                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1">Fermeture préinscription</div>
                      <Input
                        type="datetime-local"
                        value={toDatetimeLocalValue(s.pre_close_at)}
                        onChange={(e) => patchSettings(f.id, { pre_close_at: fromDatetimeLocalValue(e.target.value) })}
                        disabled={!enabled}
                      />
                      <div className="text-[11px] text-gray-500 mt-1">Après cette date : plus de candidatures.</div>
                    </div>

                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1">Date tirage (indicatif)</div>
                      <Input
                        type="datetime-local"
                        value={toDatetimeLocalValue(s.draw_at)}
                        onChange={(e) => patchSettings(f.id, { draw_at: fromDatetimeLocalValue(e.target.value) })}
                        disabled={!enabled}
                      />
                      <div className="text-[11px] text-gray-500 mt-1">Info organisateur (n’impacte pas la mécanique).</div>
                    </div>

                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1">TTL invitation (heures)</div>
                      <Input
                        type="number"
                        min="1"
                        max="720"
                        value={s.invite_ttl_hours ?? 72}
                        onChange={(e) => patchSettings(f.id, { invite_ttl_hours: Number(e.target.value || 72) })}
                        disabled={!enabled}
                      />
                      <div className="text-[11px] text-gray-500 mt-1">Délai pour s’inscrire après réception de l’invitation.</div>
                    </div>
                  </div>

                  {/* Small “what next” */}
                  {enabled ? (
                    <div className="rounded-2xl bg-gray-50 ring-1 ring-gray-200 p-4 text-sm text-gray-700">
                      <div className="font-semibold text-gray-900 mb-1">Prochaine étape</div>
                      <div className="text-sm text-gray-700">
                        Une fois la fenêtre terminée, va dans{" "}
                        <span className="font-semibold">“Ouvrir tirage”</span> →{" "}
                        <span className="font-semibold">Lancer tirage</span> →{" "}
                        <span className="font-semibold">Libérer</span> des lots (ex: 25).
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Rappel : les emails ne partent pas au tirage, ils partent quand tu libères un lot (backend).
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">
                      Active la loterie pour paramétrer la préinscription et accéder au tirage.
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Footer note */}
        <Card>
          <SectionTitle
            icon={Info}
            title="À retenir"
            subtitle="Cette page = configuration. La page “Tirage” = exécution (tirage + libération des lots)."
          />
          <div className="p-5 text-sm text-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-2xl ring-1 ring-gray-200 p-4">
                <div className="font-semibold text-gray-900 flex items-center gap-2">
                  <Play className="h-4 w-4" /> Tirage
                </div>
                <div className="mt-1 text-gray-600">Classe tout le monde (ranked). Aucun email.</div>
              </div>
              <div className="rounded-2xl ring-1 ring-gray-200 p-4">
                <div className="font-semibold text-gray-900 flex items-center gap-2">
                  <Send className="h-4 w-4" /> Libération
                </div>
                <div className="mt-1 text-gray-600">Crée tokens + invited + emails côté backend.</div>
              </div>
              <div className="rounded-2xl ring-1 ring-gray-200 p-4">
                <div className="font-semibold text-gray-900 flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4" /> Inscription
                </div>
                <div className="mt-1 text-gray-600">Passe en registered après paiement (webhook).</div>
              </div>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              Si les statuts changent mais aucun email ne part, c’est côté backend (RPC/Edge/trigger) qu’il faut brancher l’envoi.
            </div>
          </div>
        </Card>
      </div>
    </Container>
  );
}

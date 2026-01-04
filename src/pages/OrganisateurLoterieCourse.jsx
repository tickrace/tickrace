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
  CheckCircle2,
  AlertTriangle,
  Hash,
  Mail,
  Users,
  Layers,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../supabase";

/**
 * Page organisateur (par course) : activation/paramétrage loterie par format
 * Route : /organisateur/loterie/:courseId
 *
 * Objectif UX :
 * - Comprendre rapidement les étapes
 * - Paramétrer une fenêtre propre
 * - Accéder à la page de tirage par format
 */

const Container = ({ children }) => (
  <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">{children}</div>
);

const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 ${className}`}>{children}</div>
);

const Button = ({ children, className = "", disabled, onClick, type = "button" }) => (
  <button
    type={type}
    disabled={disabled}
    onClick={onClick}
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

const PrimaryButton = ({ children, className = "", disabled, onClick, type = "button" }) => (
  <button
    type={type}
    disabled={disabled}
    onClick={onClick}
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

// Convert ISO -> datetime-local value
function toDatetimeLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
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

export default function OrganisateurLoterieCourse() {
  const { courseId } = useParams();

  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);

  const [course, setCourse] = useState(null);
  const [formats, setFormats] = useState([]);
  const [settingsByFormat, setSettingsByFormat] = useState({});
  const [dirty, setDirty] = useState({});
  const [countsByFormat, setCountsByFormat] = useState({}); // {formatId: {pending, ranked, invited, registered, ...}}

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
      setCourse(c);

      const { data: f, error: fe } = await supabase
        .from("formats")
        .select("id, course_id, nom, date, heure_depart, nb_max_coureurs, is_team_event, team_size")
        .eq("course_id", courseId)
        .order("date", { ascending: true });
      if (fe) throw fe;

      setFormats(f || []);
      const earliestFormatDate = (f || []).map((x) => x.date).filter(Boolean).sort()[0] || null;
      setCourse((prev) => ({ ...prev, _earliestFormatDate: earliestFormatDate }));

      const ids = (f || []).map((x) => x.id);
      if (!ids.length) {
        setSettingsByFormat({});
        setDirty({});
        setCountsByFormat({});
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

      // counts
      const { data: pre, error: pe } = await supabase
        .from("format_preinscriptions")
        .select("format_id, status")
        .in("format_id", ids);
      if (pe) throw pe;

      const counts = {};
      for (const id of ids) {
        counts[id] = { total: 0, pending: 0, ranked: 0, invited: 0, expired: 0, registered: 0, withdrawn: 0, direct_invited: 0 };
      }
      for (const r of pre || []) {
        const fid = r.format_id;
        if (!counts[fid]) continue;
        counts[fid].total += 1;
        if (counts[fid][r.status] !== undefined) counts[fid][r.status] += 1;
      }
      setCountsByFormat(counts);
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

  const hasDirty = useMemo(() => Object.values(dirty).some(Boolean), [dirty]);

  const patchSettings = (formatId, patch) => {
    setSettingsByFormat((prev) => ({
      ...prev,
      [formatId]: { ...(prev[formatId] || defaultSettings(formatId)), ...patch },
    }));
    setDirty((prev) => ({ ...prev, [formatId]: true }));
  };

  const validateSettings = (row) => {
    const ttl = Number(row.invite_ttl_hours || 0);
    if (!Number.isFinite(ttl) || ttl <= 0 || ttl > 720) return "TTL invalide (1h à 720h).";

    if (row.enabled) {
      if (!row.pre_open_at || !row.pre_close_at) return "Renseigne au minimum l’ouverture et la fermeture de préinscription.";
      if (new Date(row.pre_open_at) > new Date(row.pre_close_at)) return "L’ouverture doit être avant la fermeture.";
    }
    return null;
  };

  const saveOne = async (formatId) => {
    const row = settingsByFormat[formatId] || defaultSettings(formatId);
    const err = validateSettings(row);
    if (err) return toast.error(err);

    try {
      const payload = {
        format_id: formatId,
        enabled: Boolean(row.enabled),
        pre_open_at: row.pre_open_at,
        pre_close_at: row.pre_close_at,
        pre_closed_at: row.pre_closed_at,
        draw_at: row.draw_at,
        invite_ttl_hours: Number(row.invite_ttl_hours || 72),
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
        const err = validateSettings(row);
        if (err) throw new Error(`Format ${id} : ${err}`);

        payloads.push({
          format_id: id,
          enabled: Boolean(row.enabled),
          pre_open_at: row.pre_open_at,
          pre_close_at: row.pre_close_at,
          pre_closed_at: row.pre_closed_at,
          draw_at: row.draw_at,
          invite_ttl_hours: Number(row.invite_ttl_hours || 72),
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
          <div className="p-5">
            <div className="text-lg font-semibold text-gray-900">Gestion loterie</div>
            <div className="text-sm text-gray-600 mt-1">Course introuvable ou accès refusé.</div>
            <div className="mt-4">
              <Link to="/organisateur" className="text-orange-700 underline">
                Retour
              </Link>
            </div>
          </div>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold text-gray-900">Préinscription / Tirage au sort</h1>
              <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 ring-1 ring-orange-200 px-3 py-1 text-xs text-orange-700">
                <Settings2 className="h-4 w-4" /> par format
              </span>
            </div>
            <div className="text-sm text-gray-600 mt-2">
              <div className="font-medium text-gray-900">{course.nom}</div>
              <div className="mt-1 inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                <span>{fmtDT(course._earliestFormatDate)}</span>
                <span className="text-gray-300">•</span>
                <span>{course.lieu || "—"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={load}>
              <Loader2 className="h-4 w-4" />
              Recharger
            </Button>

            <PrimaryButton onClick={saveAll} disabled={!hasDirty || savingAll}>
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

        {/* Big explainer */}
        <Card>
          <div className="p-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-2xl bg-orange-50 ring-1 ring-orange-200 flex items-center justify-center">
                <Info className="h-5 w-5 text-orange-700" />
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-900">Comment ça marche (côté organisateur)</div>
                <div className="text-sm text-gray-700 mt-2 space-y-1">
                  <div>1) Définis la fenêtre de préinscription (ouverture / fermeture).</div>
                  <div>2) Quand tu es prêt : <b>lance le tirage</b> dans la page “Tirage”.</div>
                  <div>3) Ensuite : <b>libère des lots</b> (ex: 50) → les emails partent à ce moment-là.</div>
                  <div className="text-xs text-gray-500 mt-2">
                    Important : “ranked” = rang attribué, <b>pas d’email envoyé</b>.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Formats */}
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
            const counts = countsByFormat[f.id] || null;

            const hasWindow = Boolean(s.pre_open_at && s.pre_close_at);
            const setupOk = enabled && hasWindow;

            return (
              <Card key={f.id}>
                <div className="p-5 flex flex-col gap-4">
                  {/* Top line */}
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-lg font-semibold text-gray-900">{f.nom || "Format"}</div>

                        {enabled ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-green-50 ring-1 ring-green-200 px-3 py-1 text-xs text-green-700">
                            <BadgeCheck className="h-4 w-4" /> Loterie activée
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-full bg-gray-50 ring-1 ring-gray-200 px-3 py-1 text-xs text-gray-700">
                            <Lock className="h-4 w-4" /> Désactivée
                          </span>
                        )}

                        {setupOk ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 ring-1 ring-blue-200 px-3 py-1 text-xs text-blue-700">
                            <CheckCircle2 className="h-4 w-4" /> Prêt
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 ring-1 ring-amber-200 px-3 py-1 text-xs text-amber-800">
                            <AlertTriangle className="h-4 w-4" /> À paramétrer
                          </span>
                        )}

                        {isDirty ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 ring-1 ring-amber-200 px-3 py-1 text-xs text-amber-800">
                            <Timer className="h-4 w-4" /> Non enregistré
                          </span>
                        ) : null}
                      </div>

                      <div className="text-sm text-gray-600 mt-2">
                        <span className="font-medium text-gray-900">{fmtDT(f.date)}</span>
                        {f.nb_max_coureurs ? (
                          <>
                            <span className="mx-2 text-gray-300">•</span>
                            <span>Quota {f.nb_max_coureurs}</span>
                          </>
                        ) : null}
                      </div>

                      {counts ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 ring-1 ring-gray-200 px-3 py-1 text-gray-700">
                            <Users className="h-3.5 w-3.5" /> Total {counts.total}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 ring-1 ring-gray-200 px-3 py-1 text-gray-700">
                            <Layers className="h-3.5 w-3.5" /> pending {counts.pending}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 ring-1 ring-violet-200 px-3 py-1 text-violet-800">
                            <Hash className="h-3.5 w-3.5" /> ranked {counts.ranked}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 ring-1 ring-blue-200 px-3 py-1 text-blue-700">
                            <Mail className="h-3.5 w-3.5" /> invited {counts.invited}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 ring-1 ring-green-200 px-3 py-1 text-green-700">
                            <BadgeCheck className="h-3.5 w-3.5" /> registered {counts.registered}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => patchSettings(f.id, { enabled: !enabled })}
                        className={enabled ? "ring-green-200 bg-green-50 text-green-800 hover:bg-green-100" : ""}
                      >
                        {enabled ? "Désactiver" : "Activer"} la loterie
                      </Button>

                      <PrimaryButton onClick={() => saveOne(f.id)}>
                        <Save className="h-4 w-4" />
                        Enregistrer
                      </PrimaryButton>

                      <Link
                        to={`/organisateur/tirage/${f.id}`}
                        className={[
                          "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
                          setupOk ? "bg-orange-600 text-white hover:bg-orange-700" : "bg-gray-200 text-gray-800 hover:bg-gray-300",
                        ].join(" ")}
                        title={setupOk ? "Ouvrir l’interface tirage" : "Active + définis la fenêtre puis enregistre"}
                        aria-disabled={!setupOk}
                        onClick={(e) => {
                          if (!setupOk) {
                            e.preventDefault();
                            toast("Active la loterie + définis ouverture/fermeture puis enregistre.");
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
                    </div>

                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1">Fermeture préinscription</div>
                      <Input
                        type="datetime-local"
                        value={toDatetimeLocalValue(s.pre_close_at)}
                        onChange={(e) => patchSettings(f.id, { pre_close_at: fromDatetimeLocalValue(e.target.value) })}
                        disabled={!enabled}
                      />
                    </div>

                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1">Date tirage (indicatif)</div>
                      <Input
                        type="datetime-local"
                        value={toDatetimeLocalValue(s.draw_at)}
                        onChange={(e) => patchSettings(f.id, { draw_at: fromDatetimeLocalValue(e.target.value) })}
                        disabled={!enabled}
                      />
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
                      <div className="text-[11px] text-gray-500 mt-1">
                        Le TTL démarre à l’envoi de chaque lot (ex : 72h).
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </Container>
  );
}

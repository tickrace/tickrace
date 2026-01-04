// src/pages/TirageAuSort.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  BadgeCheck,
  CalendarDays,
  Download,
  Hash,
  Layers,
  Loader2,
  Lock,
  Mail,
  Play,
  RefreshCcw,
  Send,
  Timer,
  Users,
  XCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../supabase";

/**
 * Page organisateur : Tirage au sort / Loterie (par format)
 * Route : /organisateur/tirage/:formatId
 *
 * Le modèle mental côté orga :
 * 1) Les coureurs se préinscrivent (status=pending)
 * 2) Tu lances le tirage -> tout devient ranked + rangs 1..N
 * 3) Tu libères des lots (ex: 50) -> status=invited + création tokens + emails envoyés
 * 4) Les invités finalisent l’inscription (webhook paiement) -> status=registered
 */

const EMAIL_FUNCTION = "send-lottery-email";

/* ----------------------------- UI helpers ----------------------------- */
const Container = ({ children }) => (
  <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">{children}</div>
);

const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 ${className}`}>{children}</div>
);

const CardHeader = ({ title, subtitle, right }) => (
  <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-100">
    <div>
      <div className="text-lg font-semibold text-gray-900">{title}</div>
      {subtitle ? <div className="text-sm text-gray-600 mt-1">{subtitle}</div> : null}
    </div>
    {right ? <div className="shrink-0">{right}</div> : null}
  </div>
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

const Stat = ({ icon: Icon, label, value, hint }) => (
  <div className="rounded-2xl ring-1 ring-gray-200 p-4 bg-white">
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-2xl bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center">
        <Icon className="h-5 w-5 text-gray-800" />
      </div>
      <div>
        <div className="text-xs text-gray-600">{label}</div>
        <div className="text-xl font-semibold text-gray-900 leading-tight">{value}</div>
      </div>
    </div>
    {hint ? <div className="text-xs text-gray-500 mt-2">{hint}</div> : null}
  </div>
);

const fmtDT = (d) => {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return dt.toLocaleString("fr-FR", {
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

function toCsv(rows, columns) {
  const escape = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.map((c) => escape(c.label)).join(";");
  const lines = rows.map((r) => columns.map((c) => escape(c.get(r))).join(";"));
  return [header, ...lines].join("\n");
}

function downloadText(filename, text, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ----------------------------- Main ----------------------------- */
export default function TirageAuSort() {
  const { formatId } = useParams();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [course, setCourse] = useState(null);
  const [format, setFormat] = useState(null);
  const [settings, setSettings] = useState(null);
  const [draw, setDraw] = useState(null);

  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    ranked: 0,
    invited: 0,
    expired: 0,
    registered: 0,
    withdrawn: 0,
    direct_invited: 0,
  });

  // Actions
  const [releaseN, setReleaseN] = useState(50);
  const [lastSendReport, setLastSendReport] = useState(null); // {sent, failed[]}
  const channelRef = useRef(null);

  const enabled = Boolean(settings?.enabled);

  const refreshAll = async ({ silent = false } = {}) => {
    if (!formatId) return;
    if (!silent) setLoading(true);

    try {
      // 1) format
      const { data: f, error: fe } = await supabase
        .from("formats")
        .select("id, course_id, nom, date, heure_depart, nb_max_coureurs, is_team_event, team_size")
        .eq("id", formatId)
        .single();
      if (fe) throw fe;
      setFormat(f);

      // 2) course
      const { data: c, error: ce } = await supabase
        .from("courses")
        .select("id, nom, organisateur_id, lieu")
        .eq("id", f.course_id)
        .single();
      if (ce) throw ce;
      setCourse(c);

      // 3) settings
      const { data: s, error: se } = await supabase
        .from("format_lottery_settings")
        .select("*")
        .eq("format_id", formatId)
        .maybeSingle();
      if (se) throw se;
      setSettings(s);

      // 4) draw
      const { data: d, error: de } = await supabase
        .from("lottery_draws")
        .select("*")
        .eq("format_id", formatId)
        .maybeSingle();
      if (de) throw de;
      setDraw(d);

      // 5) rows
      const { data: pre, error: pe } = await supabase
        .from("format_preinscriptions")
        .select(
          `
          id, course_id, format_id, user_id, email, team_id, status, created_at, withdrawn_at,
          teams:teams(id, name, team_size),
          lottery_ranks:lottery_ranks(rank, draw_id),
          lottery_invites:lottery_invites(invited_at, expires_at, used_at, batch_no)
        `
        )
        .eq("format_id", formatId)
        .order("created_at", { ascending: false });

      if (pe) throw pe;

      const normalized =
        (pre || []).map((r) => {
          const rank = Array.isArray(r.lottery_ranks) && r.lottery_ranks.length ? r.lottery_ranks[0].rank : null;
          const invite = Array.isArray(r.lottery_invites) && r.lottery_invites.length ? r.lottery_invites[0] : null;
          const team = r.teams || null;
          return { ...r, rank, invite, team };
        }) || [];

      setRows(normalized);

      const st = {
        total: normalized.length,
        pending: 0,
        ranked: 0,
        invited: 0,
        expired: 0,
        registered: 0,
        withdrawn: 0,
        direct_invited: 0,
      };
      for (const r of normalized) if (st[r.status] !== undefined) st[r.status] += 1;
      setStats(st);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Erreur de chargement tirage au sort.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Realtime
  useEffect(() => {
    refreshAll();

    if (!formatId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const ch = supabase
      .channel(`lottery:${formatId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "format_preinscriptions", filter: `format_id=eq.${formatId}` },
        () => refreshAll({ silent: true })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lottery_invites", filter: `format_id=eq.${formatId}` },
        () => refreshAll({ silent: true })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lottery_draws", filter: `format_id=eq.${formatId}` },
        () => refreshAll({ silent: true })
      )
      .subscribe();

    channelRef.current = ch;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatId]);

  /* ----------------------------- Actions ----------------------------- */
  const handleClosePre = async () => {
    if (!formatId) return;
    try {
      setBusy(true);
      const { error } = await supabase.rpc("close_preinscriptions", { p_format_id: formatId });
      if (error) throw error;
      toast.success("Préinscriptions clôturées.");
      await refreshAll({ silent: true });
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Impossible de clôturer la préinscription.");
    } finally {
      setBusy(false);
    }
  };

  const handleRunDraw = async () => {
    if (!formatId) return;
    try {
      setBusy(true);
      setLastSendReport(null);

      const { data, error } = await supabase.rpc("run_lottery_draw", { p_format_id: formatId });
      if (error) throw error;

      toast.success("Tirage créé : rangs attribués (pending → ranked).");
      await refreshAll({ silent: true });
      return data;
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Impossible de lancer le tirage.");
    } finally {
      setBusy(false);
    }
  };

  const sendInviteEmails = async (invitesPayload) => {
    if (!invitesPayload?.length) return { sent: 0, failed: [] };

    const { data, error } = await supabase.functions.invoke(EMAIL_FUNCTION, {
      body: {
        type: "invite",
        course_id: course?.id,
        format_id: format?.id,
        invites: invitesPayload,
      },
    });

    if (error) throw error;

    const sent = Number(data?.sent || 0);
    const failed = Array.isArray(data?.failed) ? data.failed : [];
    return { sent, failed };
  };

  const handleReleaseNext = async () => {
    if (!formatId) return;
    const n = Number(releaseN || 0);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Nombre invalide.");
      return;
    }

    try {
      setBusy(true);
      setLastSendReport(null);

      // 1) RPC : crée tokens + status=invited
      const { data, error } = await supabase.rpc("release_next_invites", { p_format_id: formatId, p_n: n });
      if (error) throw error;

      const invites = (data || []).map((x) => ({
        email: x.email,
        token: x.token,
        expires_at: x.expires_at,
        rank: x.rank,
      }));

      if (!invites.length) {
        toast("Aucun candidat à inviter (plus de ranked disponibles).");
        await refreshAll({ silent: true });
        return;
      }

      // 2) Envoi email (Edge Function)
      const report = await sendInviteEmails(invites);
      setLastSendReport(report);

      if (report.failed?.length) {
        console.error("send-lottery-email failed:", report.failed);
        toast.error(`Emails : ${report.sent} envoyés • ${report.failed.length} échecs (voir console)`);
      } else {
        toast.success(`Emails : ${report.sent} envoyé(s).`);
      }

      await refreshAll({ silent: true });
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Erreur lors de la libération / envoi emails.");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = (mode) => {
    const baseName = `tirage_${formatId}_${mode}_${new Date().toISOString().slice(0, 10)}.csv`;

    let subset = rows;
    if (mode === "candidats") subset = rows;
    if (mode === "rangs") subset = rows.filter((r) => r.rank !== null || r.status === "direct_invited");
    if (mode === "invites") subset = rows.filter((r) => ["invited", "expired", "direct_invited"].includes(r.status));
    if (mode === "inscrits") subset = rows.filter((r) => r.status === "registered");

    const cols = [
      { label: "Statut", get: (r) => r.status },
      { label: "Rang", get: (r) => (r.rank ?? "") },
      { label: "Email", get: (r) => r.email },
      { label: "Équipe", get: (r) => r.team?.name || "" },
      { label: "Créé le", get: (r) => fmtDT(r.created_at) },
      { label: "Invité le", get: (r) => fmtDT(r.invite?.invited_at) },
      { label: "Expire le", get: (r) => fmtDT(r.invite?.expires_at) },
      { label: "Lot", get: (r) => r.invite?.batch_no ?? "" },
      { label: "Token utilisé le", get: (r) => fmtDT(r.invite?.used_at) },
    ];

    downloadText(baseName, toCsv(subset, cols));
  };

  /* ----------------------------- Derived ----------------------------- */
  const stepStatus = useMemo(() => {
    const hasWindow = Boolean(settings?.pre_open_at && settings?.pre_close_at);
    const hasDraw = Boolean(draw?.id);
    const canRelease = enabled && hasDraw && stats.ranked > 0;
    return { hasWindow, hasDraw, canRelease };
  }, [settings, draw, enabled, stats.ranked]);

  /* ----------------------------- Render ----------------------------- */
  if (loading || !formatId) {
    return (
      <Container>
        <div className="flex items-center gap-3 text-gray-700">
          <Loader2 className="h-5 w-5 animate-spin" />
          <div>Chargement…</div>
        </div>
      </Container>
    );
  }

  if (!format || !course) {
    return (
      <Container>
        <Card>
          <CardHeader title="Tirage au sort" subtitle="Format introuvable ou accès refusé." />
          <div className="p-5">
            <Link to="/organisateur" className="text-orange-700 underline">
              Retour
            </Link>
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
              <h1 className="text-2xl font-semibold text-gray-900">Tirage au sort</h1>
              {enabled ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-green-50 ring-1 ring-green-200 px-3 py-1 text-xs text-green-700">
                  <BadgeCheck className="h-4 w-4" /> Loterie activée
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full bg-gray-50 ring-1 ring-gray-200 px-3 py-1 text-xs text-gray-700">
                  <Lock className="h-4 w-4" /> Désactivée
                </span>
              )}
              {format.is_team_event ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 ring-1 ring-blue-200 px-3 py-1 text-xs text-blue-700">
                  <Users className="h-4 w-4" /> Équipe (taille {format.team_size})
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full bg-gray-50 ring-1 ring-gray-200 px-3 py-1 text-xs text-gray-700">
                  <Users className="h-4 w-4" /> Solo
                </span>
              )}
            </div>

            <div className="text-sm text-gray-600 mt-2">
              <div className="font-medium text-gray-900">{course.nom}</div>
              <div className="mt-1">
                <span className="text-gray-700 font-medium">{format.nom || "Format"}</span>
                <span className="mx-2 text-gray-300">•</span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-4 w-4" />
                  {fmtDT(format.date)}
                </span>
                {format.nb_max_coureurs ? (
                  <>
                    <span className="mx-2 text-gray-300">•</span>
                    <span className="inline-flex items-center gap-1">
                      <Layers className="h-4 w-4" />
                      Quota {format.nb_max_coureurs}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => refreshAll()} disabled={busy}>
              <RefreshCcw className="h-4 w-4" />
              Actualiser
            </Button>

            <Link
              to={`/course/${course.id}`}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ring-1 ring-gray-200 bg-white hover:bg-gray-50"
            >
              Voir la page publique
            </Link>
          </div>
        </div>

        {/* Quick explainer */}
        <Card>
          <CardHeader
            title="Comprendre le processus"
            subtitle="Une loterie fonctionne en 4 étapes. Les emails ne partent PAS au tirage, mais à la libération des lots."
          />
          <div className="p-5 grid grid-cols-1 lg:grid-cols-4 gap-3 text-sm">
            <div className="rounded-2xl ring-1 ring-gray-200 p-4 bg-gray-50">
              <div className="font-semibold text-gray-900 flex items-center gap-2">
                <Info className="h-4 w-4" /> 1. Préinscriptions
              </div>
              <div className="text-gray-700 mt-2">
                Les coureurs s’inscrivent sur la liste (status <b>pending</b>) pendant la fenêtre définie.
              </div>
            </div>

            <div className="rounded-2xl ring-1 ring-gray-200 p-4 bg-gray-50">
              <div className="font-semibold text-gray-900 flex items-center gap-2">
                <Hash className="h-4 w-4" /> 2. Tirage
              </div>
              <div className="text-gray-700 mt-2">
                Le tirage attribue un rang 1..N (status <b>ranked</b>). <b>Aucun email</b> n’est envoyé ici.
              </div>
            </div>

            <div className="rounded-2xl ring-1 ring-gray-200 p-4 bg-gray-50">
              <div className="font-semibold text-gray-900 flex items-center gap-2">
                <Send className="h-4 w-4" /> 3. Libérer un lot
              </div>
              <div className="text-gray-700 mt-2">
                Tu libères ex: 50 rangs : tokens créés, status <b>invited</b> et emails envoyés.
              </div>
            </div>

            <div className="rounded-2xl ring-1 ring-gray-200 p-4 bg-gray-50">
              <div className="font-semibold text-gray-900 flex items-center gap-2">
                <BadgeCheck className="h-4 w-4" /> 4. Inscription
              </div>
              <div className="text-gray-700 mt-2">
                Les invités finalisent (paiement). Le webhook met status <b>registered</b>.
              </div>
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat icon={Users} label="Candidats" value={stats.total} hint="Total préinscriptions du format" />
          <Stat icon={Layers} label="Pending" value={stats.pending} hint="Avant tirage" />
          <Stat icon={Hash} label="Ranked" value={stats.ranked} hint="Rang attribué (tirage fait)" />
          <Stat icon={Mail} label="Invités" value={stats.invited + stats.direct_invited} hint="Invités (tokens créés)" />
          <Stat icon={Timer} label="Expirés" value={stats.expired} hint="Tokens expirés" />
          <Stat icon={BadgeCheck} label="Inscrits" value={stats.registered} hint="Paiement validé" />
          <Stat icon={XCircle} label="Withdrawn" value={stats.withdrawn} hint="Désistements" />
          <Stat icon={CheckCircle2} label="Tirage" value={draw ? "OK" : "—"} hint={draw ? "Ordre généré" : "À faire"} />
        </div>

        {/* Step actions */}
        <Card>
          <CardHeader
            title="Actions (à faire dans l’ordre)"
            subtitle="Tu peux exécuter chaque étape quand tu veux, mais c’est plus simple dans cet ordre."
            right={
              <div className="flex items-center gap-2">
                <Button onClick={handleClosePre} disabled={busy || !enabled}>
                  <XCircle className="h-4 w-4" />
                  Clôturer
                </Button>
                <PrimaryButton onClick={handleRunDraw} disabled={busy || !enabled || Boolean(draw)}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Lancer tirage
                </PrimaryButton>
              </div>
            }
          />

          <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Step 1: window info */}
            <div className="rounded-2xl ring-1 ring-gray-200 p-4">
              <div className="font-semibold text-gray-900 flex items-center gap-2">
                <CalendarDays className="h-4 w-4" /> Étape 1 — Fenêtre
              </div>
              <div className="text-sm text-gray-700 mt-2 space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-600">Ouverture</span>
                  <span className="font-medium">{fmtDT(settings?.pre_open_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-600">Fermeture</span>
                  <span className="font-medium">{fmtDT(settings?.pre_close_at)}</span>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  {stepStatus.hasWindow ? (
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-700" /> Fenêtre définie
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-700" /> Défini la fenêtre dans “Gestion loterie”
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Step 2: draw */}
            <div className="rounded-2xl ring-1 ring-gray-200 p-4">
              <div className="font-semibold text-gray-900 flex items-center gap-2">
                <Hash className="h-4 w-4" /> Étape 2 — Tirage
              </div>
              <div className="text-sm text-gray-700 mt-2">
                <div>Le tirage attribue un rang à tous les <b>pending</b> et les passe en <b>ranked</b>.</div>
                <div className="mt-2 text-xs text-gray-500">
                  {draw ? (
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-700" /> Tirage déjà créé (idempotent)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-700" /> À lancer
                    </span>
                  )}
                </div>

                {draw ? (
                  <div className="mt-3 text-xs text-gray-600 bg-gray-50 ring-1 ring-gray-200 rounded-xl p-3">
                    <div><b>Seed</b> : <span className="font-mono break-all">{draw.seed}</span></div>
                    <div className="mt-1"><b>Candidats</b> : {draw.candidate_count}</div>
                    <div className="mt-1"><b>Créé le</b> : {fmtDT(draw.created_at)}</div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Step 3: release batch */}
            <div className="rounded-2xl ring-1 ring-gray-200 p-4">
              <div className="font-semibold text-gray-900 flex items-center gap-2">
                <Send className="h-4 w-4" /> Étape 3 — Libérer des invitations
              </div>
              <div className="text-sm text-gray-700 mt-2">
                <div>
                  Ça crée les tokens + met en <b>invited</b> + envoie les emails via{" "}
                  <span className="font-mono">{EMAIL_FUNCTION}</span>.
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <Input
                    type="number"
                    min="1"
                    value={releaseN}
                    onChange={(e) => setReleaseN(e.target.value)}
                    className="max-w-[140px]"
                  />
                  <PrimaryButton onClick={handleReleaseNext} disabled={busy || !enabled || !draw}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Libérer
                  </PrimaryButton>
                </div>

                {!draw ? (
                  <div className="mt-3 text-xs text-orange-700 bg-orange-50 ring-1 ring-orange-200 rounded-xl p-3">
                    Lance d’abord le tirage, sinon aucun rang n’existe.
                  </div>
                ) : null}

                {lastSendReport ? (
                  <div className="mt-3 rounded-xl ring-1 ring-gray-200 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-gray-900">Rapport d’envoi</div>
                      <div className="text-gray-600">{fmtDT(new Date().toISOString())}</div>
                    </div>
                    <div className="mt-2 text-gray-800">
                      Envoyés : <b>{lastSendReport.sent}</b> • Échecs : <b>{lastSendReport.failed?.length || 0}</b>
                    </div>
                    {lastSendReport.failed?.length ? (
                      <pre className="mt-2 bg-gray-50 ring-1 ring-gray-200 rounded-xl p-2 overflow-x-auto">
                        {JSON.stringify(lastSendReport.failed, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {!enabled ? (
            <div className="px-5 pb-5">
              <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-4 text-sm text-amber-900 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 mt-0.5" />
                <div>
                  La loterie est <b>désactivée</b> pour ce format. Active-la et enregistre dans la page “Gestion loterie”.
                </div>
              </div>
            </div>
          ) : null}
        </Card>

        {/* Exports */}
        <Card>
          <CardHeader title="Exports CSV" subtitle="Télécharge des listes pour contrôle / communication." />
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Button onClick={() => exportCsv("candidats")}>
              <Download className="h-4 w-4" /> Candidats (tous)
            </Button>
            <Button onClick={() => exportCsv("rangs")}>
              <Download className="h-4 w-4" /> Rangs
            </Button>
            <Button onClick={() => exportCsv("invites")}>
              <Download className="h-4 w-4" /> Invités/Expirés
            </Button>
            <Button onClick={() => exportCsv("inscrits")}>
              <Download className="h-4 w-4" /> Inscrits
            </Button>
          </div>
        </Card>
      </div>
    </Container>
  );
}

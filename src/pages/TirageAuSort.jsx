// src/pages/TirageAuSort.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  BadgeCheck,
  CalendarDays,
  Download,
  Filter,
  Hash,
  Layers,
  Loader2,
  Lock,
  Mail,
  Play,
  RefreshCcw,
  Search,
  Send,
  Timer,
  Users,
  UserX,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../supabase";

/**
 * Page organisateur : Tirage au sort / Loterie (par format)
 * Route recommandée : /organisateur/tirage/:formatId
 *
 * Dépendances DB/RPC (SQL) :
 * - tables: formats, courses, format_lottery_settings, format_preinscriptions, lottery_draws, lottery_ranks, lottery_invites, lottery_events, teams
 * - RPC: run_lottery_draw(format_id), release_next_invites(format_id, n), create_direct_invites(format_id, emails[]), close_preinscriptions(format_id)
 *
 * Emails (Edge Function) :
 * - Fonction attendue: send-lottery-email
 *   Payload: { type: "invite", course_id, format_id, invites:[{email, token, expires_at, rank}] }
 *   (Tu peux adapter le nom/payload si besoin, mais l’UI est prête.)
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

const Pill = ({ children }) => (
  <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 ring-1 ring-orange-200 px-3 py-1 text-xs text-orange-700">
    ✨ {children}
  </span>
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

const Textarea = (props) => (
  <textarea
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

function parseEmails(text) {
  if (!text) return [];
  return text
    .split(/[\n,; ]+/g)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/* ----------------------------- Main component ----------------------------- */
export default function TirageAuSort() {
  const { formatId } = useParams();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [course, setCourse] = useState(null);
  const [format, setFormat] = useState(null);
  const [settings, setSettings] = useState(null);
  const [draw, setDraw] = useState(null);
  const [events, setEvents] = useState([]);

  const [rows, setRows] = useState([]); // preinscriptions enriched
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

  // Actions UI
  const [releaseN, setReleaseN] = useState(50);
  const [directEmails, setDirectEmails] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("rank"); // rank | created_at | status
  const [sortDir, setSortDir] = useState("asc"); // asc | desc

  const channelRef = useRef(null);

  const refreshAll = async ({ silent = false } = {}) => {
    if (!formatId) return;
    if (!silent) setLoading(true);

    try {
      // 1) Format + Course
      const { data: f, error: fe } = await supabase
        .from("formats")
        .select("id, course_id, nom, date, heure_depart, nb_max_coureurs, is_team_event, team_size")
        .eq("id", formatId)
        .single();
      if (fe) throw fe;

      setFormat(f);

      const { data: c, error: ce } = await supabase
        .from("courses")
        .select("id, nom, organisateur_id, lieu")
        .eq("id", f.course_id)
        .single();
      if (ce) throw ce;

      setCourse(c);

      // 2) Settings
      const { data: s, error: se } = await supabase
        .from("format_lottery_settings")
        .select("*")
        .eq("format_id", formatId)
        .maybeSingle();
      if (se) throw se;
      setSettings(s);

      // 3) Draw
      const { data: d, error: de } = await supabase
        .from("lottery_draws")
        .select("*")
        .eq("format_id", formatId)
        .maybeSingle();
      if (de) throw de;
      setDraw(d);

      // 4) Rows (preinscriptions + rank + invite + team)
      // Note: selon ton schéma, les relations peuvent nécessiter des noms exacts.
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
          const invite =
            Array.isArray(r.lottery_invites) && r.lottery_invites.length ? r.lottery_invites[0] : null;
          const team = r.teams || null;

          return {
            ...r,
            rank,
            invite,
            team,
          };
        }) || [];

      setRows(normalized);

      // 5) Stats
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
      for (const r of normalized) {
        if (st[r.status] !== undefined) st[r.status] += 1;
      }
      setStats(st);

      // 6) Events
      const { data: ev, error: ee } = await supabase
        .from("lottery_events")
        .select("id, type, payload, created_at, created_by, draw_id")
        .eq("format_id", formatId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (ee) throw ee;
      setEvents(ev || []);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Erreur de chargement tirage au sort.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Realtime subscription
  useEffect(() => {
    refreshAll();

    if (!formatId) return;

    // Cleanup old channel if any
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lottery_events", filter: `format_id=eq.${formatId}` },
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

  /* ----------------------------- Derived data ----------------------------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows;

    if (statusFilter !== "all") out = out.filter((r) => r.status === statusFilter);

    if (q) {
      out = out.filter((r) => {
        const e = (r.email || "").toLowerCase();
        const tn = (r.team?.name || "").toLowerCase();
        return e.includes(q) || tn.includes(q);
      });
    }

    const dir = sortDir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      const va =
        sortKey === "rank"
          ? a.rank ?? (a.status === "direct_invited" ? -1 : 9999999)
          : sortKey === "created_at"
          ? new Date(a.created_at).getTime()
          : sortKey === "status"
          ? (a.status || "")
          : 0;

      const vb =
        sortKey === "rank"
          ? b.rank ?? (b.status === "direct_invited" ? -1 : 9999999)
          : sortKey === "created_at"
          ? new Date(b.created_at).getTime()
          : sortKey === "status"
          ? (b.status || "")
          : 0;

      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });

    return out;
  }, [rows, search, statusFilter, sortKey, sortDir]);

  const enabled = Boolean(settings?.enabled);

  /* ----------------------------- Actions ----------------------------- */
  const callEmailsInvite = async (invitesPayload) => {
    // invitesPayload: [{email, token, expires_at, rank}]
    if (!invitesPayload?.length) return;

    // ⚠️ En V1 tu as G2=2 (pas de relance manuelle), mais l’envoi automatique à la libération est nécessaire.
    // On fait un seul invoke avec la liste.
    const { error } = await supabase.functions.invoke(EMAIL_FUNCTION, {
      body: {
        type: "invite",
        course_id: course?.id,
        format_id: format?.id,
        invites: invitesPayload,
      },
    });
    if (error) throw error;
  };

  const handleRunDraw = async () => {
    if (!formatId) return;
    try {
      setBusy(true);
      const { data, error } = await supabase.rpc("run_lottery_draw", { p_format_id: formatId });
      if (error) throw error;
      toast.success("Tirage créé (ordre complet généré).");
      await refreshAll({ silent: true });
      return data;
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Impossible de lancer le tirage.");
    } finally {
      setBusy(false);
    }
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

      const { data, error } = await supabase.rpc("release_next_invites", { p_format_id: formatId, p_n: n });
      if (error) throw error;

      const invites = (data || []).map((x) => ({
        email: x.email,
        token: x.token,
        expires_at: x.expires_at,
        rank: x.rank,
      }));

      // Envoi email
      await callEmailsInvite(invites);

      toast.success(`${invites.length} invitation(s) envoyée(s).`);
      await refreshAll({ silent: true });
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Erreur lors de la libération des invitations.");
    } finally {
      setBusy(false);
    }
  };

  const handleDirectInvites = async () => {
    if (!formatId) return;

    const emails = parseEmails(directEmails);
    if (!emails.length) {
      toast.error("Aucun email détecté.");
      return;
    }

    try {
      setBusy(true);

      const { data, error } = await supabase.rpc("create_direct_invites", { p_format_id: formatId, p_emails: emails });
      if (error) throw error;

      const invites = (data || []).map((x) => ({
        email: x.email,
        token: x.token,
        expires_at: x.expires_at,
        rank: null,
      }));

      await callEmailsInvite(invites);

      toast.success(`${invites.length} invitation(s) directe(s) envoyée(s).`);
      setDirectEmails("");
      await refreshAll({ silent: true });
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Erreur lors des invitations directes.");
    } finally {
      setBusy(false);
    }
  };

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

  const exportCsv = (mode) => {
    const baseName = `tirage_format_${formatId}_${mode}_${new Date().toISOString().slice(0, 10)}.csv`;

    let subset = rows;
    if (mode === "candidats") {
      subset = rows.filter((r) => ["pending", "ranked", "invited", "expired", "registered", "withdrawn", "direct_invited"].includes(r.status));
    } else if (mode === "rangs") {
      subset = rows.filter((r) => r.rank !== null || r.status === "direct_invited");
    } else if (mode === "invites_expired") {
      subset = rows.filter((r) => ["invited", "expired", "direct_invited"].includes(r.status));
    } else if (mode === "inscrits") {
      subset = rows.filter((r) => r.status === "registered");
    }

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

    const csv = toCsv(subset, cols);
    downloadText(baseName, csv);
  };

  /* ----------------------------- Initial load state ----------------------------- */
  useEffect(() => {
    setLoading(true);
    refreshAll().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatId]);

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
              <Pill>Format</Pill>
              {enabled ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-green-50 ring-1 ring-green-200 px-3 py-1 text-xs text-green-700">
                  <BadgeCheck className="h-4 w-4" /> Activé
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full bg-gray-50 ring-1 ring-gray-200 px-3 py-1 text-xs text-gray-700">
                  <Lock className="h-4 w-4" /> Désactivé
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
                  {fmtDT(format.date)}{" "}
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

        {/* Settings + audit */}
        <Card>
          <CardHeader
            title="Paramètres & audit"
            subtitle="Fenêtres, TTL et traçabilité du tirage (seed + hash + lots)."
            right={
              <div className="flex items-center gap-2">
                <Button onClick={handleClosePre} disabled={busy || !enabled}>
                  <XCircle className="h-4 w-4" />
                  Clôturer préinscription
                </Button>
                <PrimaryButton onClick={handleRunDraw} disabled={busy || !enabled || Boolean(draw)}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Lancer tirage
                </PrimaryButton>
              </div>
            }
          />
          <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl ring-1 ring-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-900 mb-2">Fenêtres</div>
              <div className="text-sm text-gray-700 space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-600">Préinscription</span>
                  <span className="font-medium">
                    {fmtDT(settings?.pre_open_at)} → {fmtDT(settings?.pre_close_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-600">Clôture anticipée</span>
                  <span className="font-medium">{fmtDT(settings?.pre_closed_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-600">Tirage (indicatif)</span>
                  <span className="font-medium">{fmtDT(settings?.draw_at)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl ring-1 ring-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-900 mb-2">Invitations</div>
              <div className="text-sm text-gray-700 space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-600 inline-flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    TTL
                  </span>
                  <span className="font-medium">{settings?.invite_ttl_hours ?? 72}h</span>
                </div>

                <div className="mt-3">
                  <div className="text-xs text-gray-500">
                    Le TTL s’applique <span className="font-medium">à partir de l’envoi de chaque lot</span>.
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl ring-1 ring-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-900 mb-2">Audit tirage</div>
              {draw ? (
                <div className="text-sm text-gray-700 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-600 inline-flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      Seed
                    </span>
                    <span className="font-mono text-xs">{draw.seed}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-600">Hash candidats</span>
                    <span className="font-mono text-xs">{draw.candidate_hash}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-600">Candidats</span>
                    <span className="font-medium">{draw.candidate_count}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-600">Créé le</span>
                    <span className="font-medium">{fmtDT(draw.created_at)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600">Aucun tirage créé pour ce format.</div>
              )}
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat icon={Users} label="Candidats" value={stats.total} hint="Total préinscriptions du format" />
          <Stat icon={Layers} label="Classés (ranked)" value={stats.ranked} hint="Rang attribué (tirage fait)" />
          <Stat icon={Mail} label="Invités" value={stats.invited + stats.direct_invited} hint="Invités + directs" />
          <Stat icon={BadgeCheck} label="Inscrits" value={stats.registered} hint="Paiement validé (webhook)" />
          <Stat icon={Timer} label="Expirés" value={stats.expired} hint="Tokens expirés" />
          <Stat icon={UserX} label="Désistés" value={stats.withdrawn} hint="Candidature retirée" />
          <Stat icon={Send} label="En attente tirage" value={stats.pending} hint="Avant tirage (pending)" />
          <Stat icon={Hash} label="Tirage" value={draw ? "OK" : "—"} hint={draw ? "Ordre complet généré" : "Non créé"} />
        </div>

        {/* Actions: release next + direct invites + exports */}
        <Card>
          <CardHeader
            title="Actions"
            subtitle="Libérer des lots d’invitations, créer des invités directs, exporter les listes."
          />
          <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Release batch */}
            <div className="rounded-2xl ring-1 ring-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-900">Libérer X rangs suivants</div>
              <div className="text-xs text-gray-600 mt-1">
                Nécessite un tirage. Envoie automatiquement les emails d’invitation.
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
                  Lance d’abord le tirage pour générer les rangs (ordre complet).
                </div>
              ) : null}
            </div>

            {/* Direct invites */}
            <div className="rounded-2xl ring-1 ring-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-900">Invités directs (hors tirage)</div>
              <div className="text-xs text-gray-600 mt-1">
                1 email par ligne (ou séparés par virgule). Envoie les invitations avec token.
              </div>

              <div className="mt-3">
                <Textarea
                  rows={5}
                  value={directEmails}
                  onChange={(e) => setDirectEmails(e.target.value)}
                  placeholder={"ex: elite1@mail.com\nelite2@mail.com\npartenaire@mail.com"}
                />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <PrimaryButton onClick={handleDirectInvites} disabled={busy || !enabled}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Envoyer
                </PrimaryButton>
                <div className="text-xs text-gray-500">
                  {parseEmails(directEmails).length} email(s) détecté(s)
                </div>
              </div>
            </div>

            {/* Exports */}
            <div className="rounded-2xl ring-1 ring-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-900">Exports CSV</div>
              <div className="text-xs text-gray-600 mt-1">Générés depuis les données visibles côté orga.</div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                <Button onClick={() => exportCsv("candidats")}>
                  <Download className="h-4 w-4" /> Candidats
                </Button>
                <Button onClick={() => exportCsv("rangs")}>
                  <Download className="h-4 w-4" /> Rangs
                </Button>
                <Button onClick={() => exportCsv("invites_expired")}>
                  <Download className="h-4 w-4" /> Invités/Expirés
                </Button>
                <Button onClick={() => exportCsv("inscrits")}>
                  <Download className="h-4 w-4" /> Inscrits
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Filters + table */}
        <Card>
          <CardHeader
            title="Liste"
            subtitle="Filtre par statut, recherche email/équipe, tri par rang."
            right={
              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-2">
                  <span className="text-xs text-gray-500">Tri</span>
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="rank">Rang</option>
                    <option value="created_at">Date</option>
                    <option value="status">Statut</option>
                  </select>
                  <select
                    value={sortDir}
                    onChange={(e) => setSortDir(e.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="asc">Asc</option>
                    <option value="desc">Desc</option>
                  </select>
                </div>
              </div>
            }
          />
          <div className="p-5">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex-1 relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher par email ou nom d'équipe…"
                  className="pl-9"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="all">Tous</option>
                  <option value="pending">pending</option>
                  <option value="ranked">ranked</option>
                  <option value="invited">invited</option>
                  <option value="expired">expired</option>
                  <option value="registered">registered</option>
                  <option value="withdrawn">withdrawn</option>
                  <option value="direct_invited">direct_invited</option>
                </select>
              </div>

              <div className="text-sm text-gray-600">
                {filtered.length} résultat(s) / {rows.length}
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b border-gray-100">
                    <th className="py-3 pr-4">Rang</th>
                    <th className="py-3 pr-4">Email</th>
                    <th className="py-3 pr-4">Équipe</th>
                    <th className="py-3 pr-4">Statut</th>
                    <th className="py-3 pr-4">Créé le</th>
                    <th className="py-3 pr-4">Invité le</th>
                    <th className="py-3 pr-4">Expire le</th>
                    <th className="py-3 pr-4">Lot</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const rank = r.rank ?? (r.status === "direct_invited" ? "Direct" : "—");
                    const invitedAt = r.invite?.invited_at || null;
                    const expiresAt = r.invite?.expires_at || null;

                    const statusBadge =
                      r.status === "registered" ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-green-50 ring-1 ring-green-200 px-3 py-1 text-xs text-green-700">
                          <BadgeCheck className="h-4 w-4" /> registered
                        </span>
                      ) : r.status === "invited" || r.status === "direct_invited" ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 ring-1 ring-blue-200 px-3 py-1 text-xs text-blue-700">
                          <Mail className="h-4 w-4" /> {r.status}
                        </span>
                      ) : r.status === "expired" ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 ring-1 ring-amber-200 px-3 py-1 text-xs text-amber-800">
                          <Timer className="h-4 w-4" /> expired
                        </span>
                      ) : r.status === "withdrawn" ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-gray-50 ring-1 ring-gray-200 px-3 py-1 text-xs text-gray-700">
                          <UserX className="h-4 w-4" /> withdrawn
                        </span>
                      ) : r.status === "ranked" ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 ring-1 ring-violet-200 px-3 py-1 text-xs text-violet-800">
                          <Hash className="h-4 w-4" /> ranked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 rounded-full bg-gray-50 ring-1 ring-gray-200 px-3 py-1 text-xs text-gray-700">
                          <Layers className="h-4 w-4" /> {r.status}
                        </span>
                      );

                    return (
                      <tr key={r.id} className="border-b border-gray-50">
                        <td className="py-3 pr-4 font-medium text-gray-900">{rank}</td>
                        <td className="py-3 pr-4 text-gray-900">{r.email}</td>
                        <td className="py-3 pr-4 text-gray-700">{r.team?.name || "—"}</td>
                        <td className="py-3 pr-4">{statusBadge}</td>
                        <td className="py-3 pr-4 text-gray-600">{fmtDT(r.created_at)}</td>
                        <td className="py-3 pr-4 text-gray-600">{fmtDT(invitedAt)}</td>
                        <td className="py-3 pr-4 text-gray-600">{fmtDT(expiresAt)}</td>
                        <td className="py-3 pr-4 text-gray-600">{r.invite?.batch_no ?? "—"}</td>
                      </tr>
                    );
                  })}

                  {!filtered.length ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-600">
                        Aucun résultat.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* Events */}
        <Card>
          <CardHeader
            title="Journal (audit)"
            subtitle="Historique des opérations : tirage, lots, préinscriptions, invités directs."
          />
          <div className="p-5">
            <div className="space-y-3">
              {(events || []).map((ev) => (
                <div key={ev.id} className="rounded-2xl ring-1 ring-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{ev.type}</div>
                      <div className="text-xs text-gray-600 mt-1">{fmtDT(ev.created_at)}</div>
                    </div>
                    {ev.draw_id ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-gray-50 ring-1 ring-gray-200 px-3 py-1 text-xs text-gray-700">
                        <Hash className="h-4 w-4" /> draw
                      </span>
                    ) : null}
                  </div>
                  {ev.payload ? (
                    <pre className="mt-3 text-xs bg-gray-50 rounded-xl p-3 overflow-x-auto ring-1 ring-gray-200">
                      {JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))}

              {!events?.length ? <div className="text-sm text-gray-600">Aucun évènement.</div> : null}
            </div>
          </div>
        </Card>

        {/* Note */}
        <div className="text-xs text-gray-500">
          Note : si l’invocation de la fonction email ne correspond pas à ton Edge Function actuelle, change{" "}
          <span className="font-mono">EMAIL_FUNCTION</span> et/ou le payload (en haut du fichier).
        </div>
      </div>
    </Container>
  );
}

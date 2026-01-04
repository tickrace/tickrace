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
  Play,
  RefreshCcw,
  Search,
  Send,
  Timer,
  Users,
  UserX,
  XCircle,
  Info,
  Sparkles,
  AlertTriangle,
  Mail,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../supabase";

/**
 * Page organisateur : Tirage au sort / Loterie (par format)
 * Route : /organisateur/tirage/:formatId
 *
 * Important (V1 Tickrace) :
 * - Le bouton "Libérer" appelle la RPC release_next_invites()
 * - L’envoi des emails est supposé être géré côté backend (RPC / trigger / Edge Function server-side).
 *   => Il n’y a PAS de bouton "send-lottery-email" ici.
 *
 * Tables attendues :
 * - formats, courses, format_lottery_settings
 * - format_preinscriptions (optionnel: nom, prenom)
 * - lottery_draws, lottery_ranks, lottery_invites, lottery_events, teams
 *
 * RPC attendues :
 * - run_lottery_draw(p_format_id uuid)
 * - release_next_invites(p_format_id uuid, p_n int)
 * - create_direct_invites(p_format_id uuid, p_emails text[])
 * - close_preinscriptions(p_format_id uuid)
 */

/* ----------------------------- UI helpers ----------------------------- */
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

const DangerButton = ({ children, className = "", disabled, onClick, type = "button", title }) => (
  <button
    type={type}
    disabled={disabled}
    onClick={onClick}
    title={title}
    className={[
      "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
      "bg-rose-600 text-white hover:bg-rose-700",
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

function parseEmails(text) {
  if (!text) return [];
  return text
    .split(/[\n,; ]+/g)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .filter((e) => e.includes("@"));
}

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

/* ----------------------------- Status badges ----------------------------- */
function StatusBadge({ status }) {
  if (status === "registered") return <Pill tone="green"><BadgeCheck className="h-4 w-4" /> registered</Pill>;
  if (status === "invited") return <Pill tone="blue"><Mail className="h-4 w-4" /> invited</Pill>;
  if (status === "direct_invited") return <Pill tone="blue"><Mail className="h-4 w-4" /> direct_invited</Pill>;
  if (status === "ranked") return <Pill tone="violet"><Hash className="h-4 w-4" /> ranked</Pill>;
  if (status === "expired") return <Pill tone="amber"><Timer className="h-4 w-4" /> expired</Pill>;
  if (status === "withdrawn") return <Pill tone="gray"><UserX className="h-4 w-4" /> withdrawn</Pill>;
  if (status === "pending") return <Pill tone="gray"><Layers className="h-4 w-4" /> pending</Pill>;
  return <Pill tone="gray">{status || "—"}</Pill>;
}

/* ----------------------------- Stepper ----------------------------- */
function StepRow({ done, title, desc, actionLabel, onAction, disabled, hint }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl ring-1 ring-gray-200 p-4">
      <div className="flex items-start gap-3">
        <div
          className={[
            "h-9 w-9 rounded-2xl ring-1 flex items-center justify-center shrink-0",
            done ? "bg-green-50 ring-green-200" : "bg-gray-50 ring-gray-200",
          ].join(" ")}
        >
          {done ? <BadgeCheck className="h-5 w-5 text-green-700" /> : <ChevronRight className="h-5 w-5 text-gray-700" />}
        </div>

        <div>
          <div className="text-sm font-semibold text-gray-900">{title}</div>
          <div className="text-sm text-gray-600 mt-1">{desc}</div>
          {hint ? (
            <div className="mt-2 text-xs text-gray-500">
              {hint}
            </div>
          ) : null}
        </div>
      </div>

      {actionLabel ? (
        <div className="shrink-0">
          <PrimaryButton disabled={disabled} onClick={onAction} title={disabled ? "Action indisponible" : ""}>
            {actionLabel}
          </PrimaryButton>
        </div>
      ) : null}
    </div>
  );
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

  // Actions UI
  const [releaseN, setReleaseN] = useState(25);
  const [directEmails, setDirectEmails] = useState("");

  // Filtering / sorting
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("rank"); // rank | created_at | status
  const [sortDir, setSortDir] = useState("asc"); // asc | desc

  const channelRef = useRef(null);

  const enabled = Boolean(settings?.enabled);

  const computeStats = (normalized) => {
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
    return st;
  };

  const fetchPreinscriptionsSafe = async () => {
    // On essaie d’inclure nom/prenom si les colonnes existent.
    // Si elles n’existent pas encore (migration pas faite), on retombe sur une sélection minimale.
    const withNames = `
      id, course_id, format_id, user_id, email, team_id, status, created_at, withdrawn_at, nom, prenom,
      teams:teams(id, name, team_size),
      lottery_ranks:lottery_ranks(rank, draw_id),
      lottery_invites:lottery_invites(invited_at, expires_at, used_at, batch_no)
    `.trim();

    const withoutNames = `
      id, course_id, format_id, user_id, email, team_id, status, created_at, withdrawn_at,
      teams:teams(id, name, team_size),
      lottery_ranks:lottery_ranks(rank, draw_id),
      lottery_invites:lottery_invites(invited_at, expires_at, used_at, batch_no)
    `.trim();

    // First try with names
    let res = await supabase
      .from("format_preinscriptions")
      .select(withNames)
      .eq("format_id", formatId)
      .order("created_at", { ascending: false });

    if (res?.error) {
      // Fallback if columns missing / schema mismatch
      res = await supabase
        .from("format_preinscriptions")
        .select(withoutNames)
        .eq("format_id", formatId)
        .order("created_at", { ascending: false });
    }

    return res;
  };

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
      setSettings(s || null);

      // 3) Draw
      const { data: d, error: de } = await supabase
        .from("lottery_draws")
        .select("*")
        .eq("format_id", formatId)
        .maybeSingle();
      if (de) throw de;
      setDraw(d || null);

      // 4) Rows (preinscriptions + rank + invite + team)
      const { data: pre, error: pe } = await fetchPreinscriptionsSafe();
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
      setStats(computeStats(normalized));

      // 5) Events
      const { data: ev, error: ee } = await supabase
        .from("lottery_events")
        .select("id, type, payload, created_at, created_by, draw_id")
        .eq("format_id", formatId)
        .order("created_at", { ascending: false })
        .limit(80);
      if (ee) throw ee;
      setEvents(ev || []);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Erreur de chargement tirage au sort.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // One initial load + realtime subscription
  useEffect(() => {
    refreshAll();

    if (!formatId) return;

    // Cleanup old channel
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
  const suggestedRelease = useMemo(() => {
    const quota = Number(format?.nb_max_coureurs || 0);
    if (!quota) return 25;

    const already = Number(stats.registered || 0);
    const remaining = Math.max(0, quota - already);

    // On propose de libérer un peu moins que le reste, pour garder la main.
    // Exemple: quota 200, déjà 160 inscrits => remaining 40 => propose 25.
    if (remaining <= 0) return 10;
    if (remaining <= 15) return remaining;
    if (remaining <= 40) return 20;
    return 25;
  }, [format?.nb_max_coureurs, stats.registered]);

  useEffect(() => {
    // Met un default "intelligent" la première fois / quand on change de format
    setReleaseN((prev) => (prev ? prev : suggestedRelease));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatId, suggestedRelease]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows;

    if (statusFilter !== "all") out = out.filter((r) => r.status === statusFilter);

    if (q) {
      out = out.filter((r) => {
        const e = (r.email || "").toLowerCase();
        const tn = (r.team?.name || "").toLowerCase();
        const n = (r.nom || "").toLowerCase();
        const p = (r.prenom || "").toLowerCase();
        const full = `${p} ${n}`.trim();
        return e.includes(q) || tn.includes(q) || n.includes(q) || p.includes(q) || full.includes(q);
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

  const canClosePre = enabled && !busy;
  const canRunDraw = enabled && !busy && !Boolean(draw);
  const canRelease = enabled && !busy && Boolean(draw);

  const preWindowText = useMemo(() => {
    if (!settings) return "—";
    return `${fmtDT(settings.pre_open_at)} → ${fmtDT(settings.pre_close_at)}`;
  }, [settings]);

  const stepDone = useMemo(() => {
    const hasCandidates = stats.total > 0;
    const isDrawn = Boolean(draw);
    const hasInvites = (stats.invited || 0) + (stats.direct_invited || 0) > 0;
    const hasRegistered = (stats.registered || 0) > 0;
    const preClosed = Boolean(settings?.pre_closed_at);
    return { hasCandidates, preClosed, isDrawn, hasInvites, hasRegistered };
  }, [stats, draw, settings?.pre_closed_at]);

  /* ----------------------------- Actions ----------------------------- */
  const handleClosePre = async () => {
    if (!formatId) return;
    try {
      setBusy(true);
      const { error } = await supabase.rpc("close_preinscriptions", { p_format_id: formatId });
      if (error) throw error;
      toast.success("Préinscriptions clôturées (plus de nouvelles candidatures).");
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
      const { error } = await supabase.rpc("run_lottery_draw", { p_format_id: formatId });
      if (error) throw error;
      toast.success("Tirage créé : tous les candidats ont un rang (ranked).");
      toast("Étape suivante : libère un lot d’invitations (bouton “Libérer”).");
      await refreshAll({ silent: true });
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Impossible de lancer le tirage.");
    } finally {
      setBusy(false);
    }
  };

  const handleReleaseNext = async () => {
    const n = Number(releaseN || 0);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Nombre invalide.");
      return;
    }

    try {
      setBusy(true);

      // La RPC est censée :
      // - prendre les X rangs suivants non invités
      // - créer des tokens d’invitation (lottery_invites)
      // - passer les statuts en invited
      // - ET (souvent) déclencher l’envoi email côté backend
      const { data, error } = await supabase.rpc("release_next_invites", { p_format_id: formatId, p_n: n });
      if (error) throw error;

      const count = Array.isArray(data) ? data.length : n;
      toast.success(`${count} invitation(s) libérée(s).`);

      // Message explicite côté orga (c’est ce qui manquait)
      toast(
        "Les emails sont envoyés automatiquement par le backend (si configuré). Sinon : vérifie ta fonction d’envoi côté Supabase.",
        { duration: 7000 }
      );

      await refreshAll({ silent: true });
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Erreur lors de la libération des invitations.");
    } finally {
      setBusy(false);
    }
  };

  const handleDirectInvites = async () => {
    const emails = parseEmails(directEmails);
    if (!emails.length) {
      toast.error("Aucun email détecté.");
      return;
    }

    try {
      setBusy(true);

      const { data, error } = await supabase.rpc("create_direct_invites", { p_format_id: formatId, p_emails: emails });
      if (error) throw error;

      const count = Array.isArray(data) ? data.length : emails.length;
      toast.success(`${count} invité(s) direct(s) créé(s).`);

      toast(
        "Comme pour les lots, l’envoi email est supposé se faire côté backend. Vérifie la configuration si aucun mail ne part.",
        { duration: 7000 }
      );

      setDirectEmails("");
      await refreshAll({ silent: true });
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Erreur lors des invitations directes.");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = (mode) => {
    const baseName = `tirage_${formatId}_${mode}_${new Date().toISOString().slice(0, 10)}.csv`;

    let subset = rows;
    if (mode === "candidats") subset = rows;
    if (mode === "rangs") subset = rows.filter((r) => r.rank !== null || r.status === "direct_invited");
    if (mode === "invites") subset = rows.filter((r) => ["invited", "direct_invited", "expired"].includes(r.status));
    if (mode === "inscrits") subset = rows.filter((r) => r.status === "registered");
    if (mode === "visible") subset = filtered;

    const cols = [
      { label: "Statut", get: (r) => r.status },
      { label: "Rang", get: (r) => (r.rank ?? "") },
      { label: "Prénom", get: (r) => r.prenom ?? "" },
      { label: "Nom", get: (r) => r.nom ?? "" },
      { label: "Email", get: (r) => r.email ?? "" },
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
          <SectionTitle icon={AlertTriangle} title="Tirage au sort" subtitle="Format introuvable ou accès refusé." />
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
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold text-gray-900">Tirage au sort</h1>
              <Pill>
                <Sparkles className="h-4 w-4" /> Interface organisateur
              </Pill>

              {enabled ? (
                <Pill tone="green">
                  <ShieldCheck className="h-4 w-4" /> Loterie activée
                </Pill>
              ) : (
                <Pill tone="gray">
                  <Lock className="h-4 w-4" /> Désactivée
                </Pill>
              )}

              {format.is_team_event ? (
                <Pill tone="blue">
                  <Users className="h-4 w-4" /> Équipe (taille {format.team_size})
                </Pill>
              ) : (
                <Pill tone="gray">
                  <Users className="h-4 w-4" /> Solo
                </Pill>
              )}
            </div>

            <div className="text-sm text-gray-600 mt-2">
              <div className="font-medium text-gray-900">{course.nom}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-gray-800 font-medium">{format.nom || "Format"}</span>
                <span className="text-gray-300">•</span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-4 w-4" />
                  {fmtDT(format.date)}
                </span>
                {format.nb_max_coureurs ? (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="inline-flex items-center gap-1">
                      <Layers className="h-4 w-4" />
                      Quota {format.nb_max_coureurs}
                    </span>
                  </>
                ) : null}
                {course.lieu ? (
                  <>
                    <span className="text-gray-300">•</span>
                    <span>{course.lieu}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => refreshAll()} disabled={busy} title="Recharge les données">
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

        {/* Big explanation / workflow */}
        <Card>
          <SectionTitle
            icon={Info}
            title="Comprendre le workflow (simple et maîtrisé)"
            subtitle="Le tirage ne doit PAS envoyer d’emails : il classe. Les emails partent uniquement quand tu “libères” des lots."
          />
          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <StepRow
                done={stepDone.hasCandidates}
                title="1) Collecter les candidatures (préinscriptions)"
                desc="Les coureurs s’ajoutent en pending pendant la fenêtre. Une fois la période terminée, tu peux clôturer."
                actionLabel="Clôturer"
                onAction={handleClosePre}
                disabled={!canClosePre}
                hint={`Fenêtre actuelle : ${preWindowText}`}
              />
              <StepRow
                done={stepDone.isDrawn}
                title="2) Lancer le tirage (création des rangs)"
                desc="Cette étape génère un ordre complet : tous les candidats passent en ranked + rang 1..N."
                actionLabel="Lancer le tirage"
                onAction={handleRunDraw}
                disabled={!canRunDraw}
                hint="Aucun email n’est envoyé à cette étape : on ne fait que classer."
              />
              <StepRow
                done={stepDone.hasInvites}
                title="3) Libérer un lot d’invitations (X rangs suivants)"
                desc="Tu décides combien d’invitations tu envoies. Les candidats concernés passent en invited + token/expiration."
                actionLabel="Libérer un lot"
                onAction={handleReleaseNext}
                disabled={!canRelease}
                hint="C’est ICI que l’envoi email doit se déclencher côté backend (RPC/Edge)."
              />
              <StepRow
                done={stepDone.hasRegistered}
                title="4) Suivre les inscrits (registered)"
                desc="Quand un invité s’inscrit (paiement validé / webhook), il passe en registered. Tu peux libérer de nouveaux lots si besoin."
                actionLabel={null}
                onAction={null}
                disabled
                hint="Astuce : libère par petites vagues (ex: 20-30) pour garder la main."
              />
            </div>

            <div className="rounded-2xl bg-gray-50 ring-1 ring-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-900">Signification des statuts</div>
              <div className="mt-3 space-y-2 text-sm text-gray-700">
                <div className="flex items-start gap-2"><StatusBadge status="pending" /><span>Le coureur s’est préinscrit, pas encore classé.</span></div>
                <div className="flex items-start gap-2"><StatusBadge status="ranked" /><span>Classé par le tirage (rang attribué), aucun email envoyé.</span></div>
                <div className="flex items-start gap-2"><StatusBadge status="invited" /><span>Invité avec token + expiration (un email doit partir côté backend).</span></div>
                <div className="flex items-start gap-2"><StatusBadge status="expired" /><span>Invitation expirée (token non utilisé à temps).</span></div>
                <div className="flex items-start gap-2"><StatusBadge status="registered" /><span>Inscription finalisée (paiement validé).</span></div>
                <div className="flex items-start gap-2"><StatusBadge status="withdrawn" /><span>Candidature retirée (ne participe plus).</span></div>
                <div className="flex items-start gap-2"><StatusBadge status="direct_invited" /><span>Invité direct (hors tirage), token envoyé/à envoyer.</span></div>

                <div className="mt-4 rounded-xl bg-white ring-1 ring-gray-200 p-3 text-xs text-gray-600">
                  <div className="font-semibold text-gray-900 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Point important
                  </div>
                  <div className="mt-1">
                    Si tu “lances le tirage” et que personne ne reçoit d’email, c’est NORMAL. Les emails partent quand tu
                    <span className="font-semibold"> libères un lot</span>.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center">
                <Users className="h-5 w-5 text-gray-800" />
              </div>
              <div>
                <div className="text-xs text-gray-600">Candidats</div>
                <div className="text-xl font-semibold text-gray-900 leading-tight">{stats.total}</div>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">Total préinscriptions (tous statuts)</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center">
                <Hash className="h-5 w-5 text-gray-800" />
              </div>
              <div>
                <div className="text-xs text-gray-600">Classés</div>
                <div className="text-xl font-semibold text-gray-900 leading-tight">{stats.ranked}</div>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">Rang attribué (tirage effectué)</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center">
                <Mail className="h-5 w-5 text-gray-800" />
              </div>
              <div>
                <div className="text-xs text-gray-600">Invités</div>
                <div className="text-xl font-semibold text-gray-900 leading-tight">
                  {(stats.invited || 0) + (stats.direct_invited || 0)}
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">Invited + direct_invited</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center">
                <BadgeCheck className="h-5 w-5 text-gray-800" />
              </div>
              <div>
                <div className="text-xs text-gray-600">Inscrits</div>
                <div className="text-xl font-semibold text-gray-900 leading-tight">{stats.registered}</div>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">Paiement validé (webhook)</div>
          </Card>
        </div>

        {/* Actions */}
        <Card>
          <SectionTitle
            icon={Send}
            title="Actions (pilotage)"
            subtitle="Ici tu contrôles la libération des invitations (le seul moment où des emails doivent partir)."
            right={
              <div className="flex items-center gap-2">
                <Button onClick={handleClosePre} disabled={!canClosePre} title="Stoppe les nouvelles préinscriptions">
                  <XCircle className="h-4 w-4" />
                  Clôturer
                </Button>
                <PrimaryButton
                  onClick={handleRunDraw}
                  disabled={!canRunDraw}
                  title={!enabled ? "Active la loterie sur la page précédente" : draw ? "Tirage déjà créé" : "Génère les rangs"}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Lancer tirage
                </PrimaryButton>
              </div>
            }
          />
          <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Release batch */}
            <div className="rounded-2xl ring-1 ring-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-900">Libérer un lot d’invitations</div>
              <div className="text-xs text-gray-600 mt-1">
                Choisis le nombre de rangs à inviter. C’est l’étape qui déclenche les tokens et l’envoi email (backend).
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  value={releaseN}
                  onChange={(e) => setReleaseN(e.target.value)}
                  className="max-w-[140px]"
                />
                <PrimaryButton onClick={handleReleaseNext} disabled={!canRelease} title={!draw ? "Lance d’abord le tirage" : ""}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Libérer
                </PrimaryButton>
              </div>

              <div className="mt-3 rounded-xl bg-gray-50 ring-1 ring-gray-200 p-3 text-xs text-gray-700">
                Suggestion pour ce format :{" "}
                <button
                  type="button"
                  className="font-semibold text-orange-700 underline"
                  onClick={() => setReleaseN(suggestedRelease)}
                  disabled={busy}
                >
                  {suggestedRelease}
                </button>{" "}
                (à ajuster selon ton quota et ton taux de désistement).
              </div>

              {!draw ? (
                <div className="mt-3 text-xs text-orange-800 bg-orange-50 ring-1 ring-orange-200 rounded-xl p-3">
                  <div className="font-semibold">Bloqué</div>
                  <div className="mt-1">Tu dois d’abord “Lancer tirage” pour créer l’ordre complet.</div>
                </div>
              ) : null}
            </div>

            {/* Direct invites */}
            <div className="rounded-2xl ring-1 ring-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-900">Invités directs (hors tirage)</div>
              <div className="text-xs text-gray-600 mt-1">
                Pour des élites / partenaires. 1 email par ligne (ou séparés par virgule).
              </div>

              <div className="mt-3">
                <Textarea
                  rows={6}
                  value={directEmails}
                  onChange={(e) => setDirectEmails(e.target.value)}
                  placeholder={"ex: elite1@mail.com\nelite2@mail.com\npartenaire@mail.com"}
                />
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <PrimaryButton onClick={handleDirectInvites} disabled={busy || !enabled} title={!enabled ? "Loterie désactivée" : ""}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Créer
                </PrimaryButton>

                <div className="text-xs text-gray-500">{parseEmails(directEmails).length} email(s)</div>
              </div>

              <div className="mt-3 text-xs text-gray-500">
                Les emails d’invitation doivent partir côté backend (comme les lots).
              </div>
            </div>

            {/* Exports */}
            <div className="rounded-2xl ring-1 ring-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-900">Exports CSV</div>
              <div className="text-xs text-gray-600 mt-1">Pour archiver ou envoyer à un chronométreur.</div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                <Button onClick={() => exportCsv("candidats")}>
                  <Download className="h-4 w-4" /> Candidats
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
                <Button onClick={() => exportCsv("visible")} className="sm:col-span-2">
                  <Download className="h-4 w-4" /> Export (liste filtrée)
                </Button>
              </div>

              <div className="mt-3 text-xs text-gray-500">
                Astuce : utilise la recherche + filtre, puis “Export (liste filtrée)”.
              </div>
            </div>
          </div>
        </Card>

        {/* List + filters */}
        <Card>
          <SectionTitle
            icon={Filter}
            title="Liste des candidats"
            subtitle="Recherche email / nom / équipe, filtre par statut, tri par rang."
            right={
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
            }
          />
          <div className="p-5">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex-1 relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher (email / nom / prénom / équipe)…"
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
                    <th className="py-3 pr-4">Prénom</th>
                    <th className="py-3 pr-4">Nom</th>
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

                    return (
                      <tr key={r.id} className="border-b border-gray-50">
                        <td className="py-3 pr-4 font-medium text-gray-900">{rank}</td>
                        <td className="py-3 pr-4 text-gray-900">{r.prenom ?? "—"}</td>
                        <td className="py-3 pr-4 text-gray-900">{r.nom ?? "—"}</td>
                        <td className="py-3 pr-4 text-gray-900">{r.email}</td>
                        <td className="py-3 pr-4 text-gray-700">{r.team?.name || "—"}</td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{fmtDT(r.created_at)}</td>
                        <td className="py-3 pr-4 text-gray-600">{fmtDT(invitedAt)}</td>
                        <td className="py-3 pr-4 text-gray-600">{fmtDT(expiresAt)}</td>
                        <td className="py-3 pr-4 text-gray-600">{r.invite?.batch_no ?? "—"}</td>
                      </tr>
                    );
                  })}

                  {!filtered.length ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-gray-600">
                        Aucun résultat.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* Audit / events */}
        <Card>
          <SectionTitle
            icon={Hash}
            title="Journal (audit)"
            subtitle="Historique des opérations (tirage, lots, clôture, invités directs)."
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
                      <Pill tone="gray">
                        <Hash className="h-4 w-4" /> draw
                      </Pill>
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

        {/* Footer note */}
        <div className="text-xs text-gray-500">
          Rappel : “Lancer tirage” = classer (ranked). “Libérer” = invitations (invited) + tokens + emails (si backend configuré).
        </div>
      </div>
    </Container>
  );
}

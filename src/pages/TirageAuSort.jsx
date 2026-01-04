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
  Info,
  Copy,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../supabase";

/**
 * Page organisateur : Tirage au sort (par format)
 * Route : /organisateur/tirage/:formatId
 *
 * Étapes (côté orga) :
 * 1) Activer la loterie + définir la fenêtre (sur /organisateur/loterie/:courseId)
 * 2) À la fin : lancer le tirage (génère un rang pour tous les candidats "pending")
 * 3) Libérer un lot d’invitations (X) -> crée des tokens + met à jour les statuts -> envoie les emails
 * 4) Suivre : invités / expirés / inscrits
 *
 * RPC attendues :
 * - run_lottery_draw(p_format_id uuid) -> uuid
 * - release_next_invites(p_format_id uuid, p_n int) -> rows {preinscription_id,email,rank,token,expires_at,batch_no}
 * - close_preinscriptions(p_format_id uuid) -> void
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

const Pill = ({ children, className = "" }) => (
  <span
    className={[
      "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1",
      "bg-orange-50 ring-orange-200 text-orange-700",
      className,
    ].join(" ")}
  >
    {children}
  </span>
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

function copyToClipboard(text) {
  if (!text) return;
  navigator.clipboard?.writeText(text).then(
    () => toast.success("Copié ✅"),
    () => toast.error("Impossible de copier")
  );
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

  // UI state
  const [releaseN, setReleaseN] = useState(50);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("rank"); // rank | created_at | status
  const [sortDir, setSortDir] = useState("asc"); // asc | desc

  // Debug / UX: dernier lot envoyé
  const [lastBatch, setLastBatch] = useState(null); // { batch_no, invites:[{email, token, expires_at, rank}] }

  const channelRef = useRef(null);

  const enabled = Boolean(settings?.enabled);

  const refreshAll = async ({ silent = false } = {}) => {
    if (!formatId) return;
    if (!silent) setLoading(true);

    try {
      // 1) Format
      const { data: f, error: fe } = await supabase
        .from("formats")
        .select("id, course_id, nom, date, heure_depart, nb_max_coureurs, is_team_event, team_size")
        .eq("id", formatId)
        .single();
      if (fe) throw fe;
      setFormat(f);

      // 2) Course
      const { data: c, error: ce } = await supabase
        .from("courses")
        .select("id, nom, lieu, organisateur_id")
        .eq("id", f.course_id)
        .single();
      if (ce) throw ce;
      setCourse(c);

      // 3) Settings
      const { data: s, error: se } = await supabase
        .from("format_lottery_settings")
        .select("*")
        .eq("format_id", formatId)
        .maybeSingle();
      if (se) throw se;
      setSettings(s);

      // 4) Draw
      const { data: d, error: de } = await supabase
        .from("lottery_draws")
        .select("*")
        .eq("format_id", formatId)
        .maybeSingle();
      if (de) throw de;
      setDraw(d);

      // 5) Rows (préinscriptions + rank + invite + team)
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

      // 6) Stats
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

      // 7) Events (audit)
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

  // realtime
  useEffect(() => {
    refreshAll();

    if (!formatId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const ch = supabase
      .channel(`lottery:${formatId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "format_preinscriptions", filter: `format_id=eq.${formatId}` }, () =>
        refreshAll({ silent: true })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "lottery_invites", filter: `format_id=eq.${formatId}` }, () =>
        refreshAll({ silent: true })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "lottery_draws", filter: `format_id=eq.${formatId}` }, () =>
        refreshAll({ silent: true })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "lottery_events", filter: `format_id=eq.${formatId}` }, () =>
        refreshAll({ silent: true })
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

  /* ----------------------------- Derived list ----------------------------- */
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
      const { data, error } = await supabase.rpc("run_lottery_draw", { p_format_id: formatId });
      if (error) throw error;
      toast.success("Tirage créé : rang attribué à tous les candidats.");
      await refreshAll({ silent: true });
      return data;
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Impossible de lancer le tirage.");
    } finally {
      setBusy(false);
    }
  };

  async function sendInviteEmails(invitesPayload) {
    if (!invitesPayload?.length) return;

    // ✅ ici on déclenche la function => tu verras des logs dans Supabase
    console.log("[lottery] invoking send-lottery-email", invitesPayload.length);

    const { data, error } = await supabase.functions.invoke(EMAIL_FUNCTION, {
      body: {
        type: "invite",
        course_id: course?.id,
        format_id: format?.id,
        invites: invitesPayload,
      },
    });

    if (error) throw error;
    return data;
  }

  const handleReleaseNext = async () => {
    if (!formatId) return;
    const n = Number(releaseN || 0);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Nombre invalide.");

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

      if (!invites.length) {
        toast("Aucune invitation créée (plus de rangs disponibles ?).");
        await refreshAll({ silent: true });
        return;
      }

      // Stock UI debug
      setLastBatch({ batch_no: data?.[0]?.batch_no ?? null, invites });

      // Envoi emails (automatique)
      await sendInviteEmails(invites);

      toast.success(`${invites.length} invitation(s) envoyée(s).`);
      await refreshAll({ silent: true });
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Erreur lors de la libération des invitations.");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = (mode) => {
    const baseName = `tirage_format_${formatId}_${mode}_${new Date().toISOString().slice(0, 10)}.csv`;

    let subset = rows;
    if (mode === "candidats") {
      subset = rows.filter((r) =>
        ["pending", "ranked", "invited", "expired", "registered", "withdrawn", "direct_invited"].includes(r.status)
      );
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

  const step1Ok = enabled && settings?.pre_open_at && settings?.pre_close_at;
  const step2Ok = Boolean(draw);
  const step3Ok = (stats.invited || 0) + (stats.direct_invited || 0) > 0;

  return (
    <Container>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold text-gray-900">Tirage au sort</h1>
              <Pill>
                <Hash className="h-3.5 w-3.5" /> Format
              </Pill>

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
              Page publique <ExternalLink className="h-4 w-4 opacity-70" />
            </Link>
          </div>
        </div>

        {/* Wizard */}
        <Card>
          <CardHeader
            title="Comment ça marche (côté organisateur)"
            subtitle="Suivez les étapes dans l’ordre. Cette page te sert à exécuter le tirage et gérer les invitations."
          />
          <div className="p-5 grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div className={`rounded-2xl ring-1 p-4 ${step1Ok ? "ring-green-200 bg-green-50" : "ring-gray-200 bg-white"}`}>
              <div className="text-sm font-semibold text-gray-900">1) Paramétrer</div>
              <div className="text-xs text-gray-600 mt-1">
                Activer la loterie + définir la fenêtre de préinscription (ouverture / fermeture).
              </div>
              <div className="mt-3 text-xs">
                {step1Ok ? (
                  <span className="inline-flex items-center gap-2 text-green-700">
                    <BadgeCheck className="h-4 w-4" /> OK
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-gray-700">
                    <Info className="h-4 w-4" /> À faire sur “Préinscription / Tirage au sort”
                  </span>
                )}
              </div>
            </div>

            <div className={`rounded-2xl ring-1 p-4 ${step2Ok ? "ring-green-200 bg-green-50" : "ring-gray-200 bg-white"}`}>
              <div className="text-sm font-semibold text-gray-900">2) Lancer le tirage</div>
              <div className="text-xs text-gray-600 mt-1">
                Génère un rang 1..N pour tous les candidats “pending” puis les passe en “ranked”.
              </div>
              <div className="mt-3">
                <PrimaryButton onClick={handleRunDraw} disabled={busy || !enabled || Boolean(draw)} className="w-full justify-center">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {draw ? "Tirage déjà créé" : "Lancer le tirage"}
                </PrimaryButton>
              </div>
            </div>

            <div className={`rounded-2xl ring-1 p-4 ${step3Ok ? "ring-green-200 bg-green-50" : "ring-gray-200 bg-white"}`}>
              <div className="text-sm font-semibold text-gray-900">3) Libérer des invitations</div>
              <div className="text-xs text-gray-600 mt-1">
                Choisis combien inviter (ex: 50). Tickrace crée des tokens, met le statut en “invited” et envoie les emails.
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  value={releaseN}
                  onChange={(e) => setReleaseN(e.target.value)}
                  className="max-w-[120px]"
                />
                <PrimaryButton onClick={handleReleaseNext} disabled={busy || !enabled || !draw} className="flex-1 justify-center">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Libérer
                </PrimaryButton>
              </div>

              {!draw ? (
                <div className="mt-3 text-xs text-orange-700 bg-orange-50 ring-1 ring-orange-200 rounded-xl p-3">
                  Lance d’abord le tirage (étape 2).
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl ring-1 ring-gray-200 p-4 bg-white">
              <div className="text-sm font-semibold text-gray-900">4) Suivre</div>
              <div className="text-xs text-gray-600 mt-1">
                Surveille les statuts : invited / expired / registered. Les inscrits sont validés par ton webhook paiement.
              </div>
              <div className="mt-3">
                <Button onClick={handleClosePre} disabled={busy || !enabled} className="w-full justify-center">
                  <XCircle className="h-4 w-4" />
                  Clôturer préinscription
                </Button>
              </div>
            </div>
          </div>

          {lastBatch?.invites?.length ? (
            <div className="px-5 pb-5">
              <div className="rounded-2xl bg-gray-50 ring-1 ring-gray-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Dernier lot envoyé</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Lot <b>#{lastBatch.batch_no ?? "?"}</b> • {lastBatch.invites.length} invitation(s)
                    </div>
                  </div>
                  <Button onClick={() => setLastBatch(null)}>
                    <XCircle className="h-4 w-4" /> Masquer
                  </Button>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-600 border-b border-gray-200">
                        <th className="py-2 pr-3">Rang</th>
                        <th className="py-2 pr-3">Email</th>
                        <th className="py-2 pr-3">Expire</th>
                        <th className="py-2 pr-3">Lien invitation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lastBatch.invites.map((inv) => {
                        const inviteUrl =
                          `${window.location.origin}/inscription/${course.id}` +
                          `?formatId=${encodeURIComponent(format.id)}` +
                          `&invite=${encodeURIComponent(inv.token)}`;
                        return (
                          <tr key={`${inv.email}-${inv.rank}`} className="border-b border-gray-200/60">
                            <td className="py-2 pr-3 font-medium text-gray-900">{inv.rank ?? "—"}</td>
                            <td className="py-2 pr-3 text-gray-900">{inv.email}</td>
                            <td className="py-2 pr-3 text-gray-700">{fmtDT(inv.expires_at)}</td>
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-2">
                                <code className="text-[11px] bg-white ring-1 ring-gray-200 rounded-lg px-2 py-1 break-all">
                                  {inviteUrl}
                                </code>
                                <Button onClick={() => copyToClipboard(inviteUrl)} className="px-2 py-1">
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="text-[11px] text-gray-600 mt-3">
                  Si les emails ne partent pas, tu peux copier un lien et tester manuellement.
                </div>
              </div>
            </div>
          ) : null}
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatBox icon={Users} label="Candidats" value={stats.total} hint="Total préinscriptions du format" />
          <StatBox icon={Hash} label="Classés (ranked)" value={stats.ranked} hint="Rang attribué (tirage fait)" />
          <StatBox icon={Mail} label="Invités" value={stats.invited + stats.direct_invited} hint="Invités + directs" />
          <StatBox icon={BadgeCheck} label="Inscrits" value={stats.registered} hint="Paiement validé (webhook)" />
        </div>

        {/* Export */}
        <Card>
          <CardHeader title="Exports CSV" subtitle="Télécharge les listes pour traitement interne / publication." />
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
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
        </Card>

        {/* Liste */}
        <Card>
          <CardHeader
            title="Liste des candidats"
            subtitle="Tu vois ici tout le monde (email / équipe), son rang et son statut."
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
                    <th className="py-3 pr-4">Préinscrit le</th>
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

        {/* Audit */}
        <Card>
          <CardHeader title="Journal (audit)" subtitle="Historique des opérations : tirage, lots, etc." />
          <div className="p-5 space-y-3">
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
        </Card>

        <div className="text-xs text-gray-500">
          Astuce : si “Libérer” plante, c’est un souci RPC/SQL. Si “Libérer” marche mais pas les emails, regarde les logs de{" "}
          <span className="font-mono">send-lottery-email</span> (il est invoqué automatiquement par cette page).
        </div>
      </div>
    </Container>
  );
}

/* ----------------------------- Small component ----------------------------- */
function StatBox({ icon: Icon, label, value, hint }) {
  return (
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
}

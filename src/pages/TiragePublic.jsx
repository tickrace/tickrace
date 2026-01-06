// src/pages/TiragePublic.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabase";
import {
  Loader2,
  Search,
  Trophy,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
  Shield,
} from "lucide-react";

/**
 * Public : affiche les résultats du tirage + statut des candidats
 * Route : /tirage/:formatId
 *
 * Tables attendues :
 * - formats (id, nom, date, heure_depart, course_id)
 * - courses (id, nom, lieu, image_url)
 * - lottery_draws (id, format_id, created_at?, seed?, candidate_count?, candidate_hash?)
 * - lottery_ranks (draw_id, preinscription_id, rank)
 * - format_preinscriptions (id, format_id, course_id, email, prenom, nom, status, created_at)
 * - lottery_invites (id, preinscription_id, expires_at, used_at, batch_no)  <-- PAS de created_at chez toi
 *
 * Sécurité / anonymisation :
 * - On n’affiche pas l’email complet.
 * - Par défaut, on affiche prénom + 1ère lettre du nom si dispo, sinon masqué.
 */

const Container = ({ children }) => (
  <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8">{children}</div>
);

const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200 ${className}`}>{children}</div>
);

const Pill = ({ children, className = "" }) => (
  <span
    className={[
      "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1",
      className,
    ].join(" ")}
  >
    {children}
  </span>
);

const Input = (props) => (
  <input
    {...props}
    className={[
      "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm",
      "focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300",
      props.className || "",
    ].join(" ")}
  />
);

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return String(d);
  }
}
function fmtDT(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(d);
  }
}
function nowIso() {
  return new Date().toISOString();
}
function maskEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e.includes("@")) return "—";
  const [u, d] = e.split("@");
  if (!u || !d) return "—";
  const uMasked = u.length <= 2 ? `${u[0] || "*"}*` : `${u.slice(0, 2)}***`;
  const dParts = d.split(".");
  const dom = dParts[0] ? `${dParts[0].slice(0, 2)}***` : "***";
  const tld = dParts.length > 1 ? `.${dParts[dParts.length - 1]}` : "";
  return `${uMasked}@${dom}${tld}`;
}
function displayName(pre) {
  const prenom = (pre?.prenom || "").trim();
  const nom = (pre?.nom || "").trim();
  if (prenom && nom) return `${prenom} ${nom[0].toUpperCase()}.`;
  if (prenom) return prenom;
  // fallback : email masqué
  return maskEmail(pre?.email);
}

function statusMeta(preStatus, invite) {
  const s = String(preStatus || "").toLowerCase();
  const hasInvite = Boolean(invite?.id);
  const used = Boolean(invite?.used_at);
  const exp = invite?.expires_at ? String(invite.expires_at) : null;

  // Statuts typiques:
  // pending -> avant tirage
  // ranked  -> tirage fait, pas encore invité
  // invited -> invité (token envoyé) mais pas payé
  // withdrawn -> retiré
  // (optionnel) accepted/paid/registered -> si tu ajoutes plus tard

  if (s === "withdrawn") {
    return { label: "Retiré", tone: "neutral", icon: <XCircle className="h-4 w-4" /> };
  }

  if (used) {
    return { label: "Invitation utilisée", tone: "green", icon: <CheckCircle2 className="h-4 w-4" /> };
  }

  if (hasInvite) {
    if (exp && exp <= nowIso()) {
      return { label: "Invitation expirée", tone: "amber", icon: <AlertTriangle className="h-4 w-4" /> };
    }
    return { label: "Invité", tone: "orange", icon: <Clock className="h-4 w-4" /> };
  }

  if (s === "ranked") {
    return { label: "En liste (pas encore invité)", tone: "neutral", icon: <Clock className="h-4 w-4" /> };
  }

  if (s === "pending") {
    return { label: "Préinscrit", tone: "neutral", icon: <Clock className="h-4 w-4" /> };
  }

  // fallback
  return { label: preStatus || "—", tone: "neutral", icon: <Clock className="h-4 w-4" /> };
}

function pillClass(tone) {
  switch (tone) {
    case "green":
      return "bg-green-50 text-green-800 ring-green-200";
    case "orange":
      return "bg-orange-50 text-orange-800 ring-orange-200";
    case "amber":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    default:
      return "bg-neutral-50 text-neutral-800 ring-neutral-200";
  }
}

export default function TiragePublic() {
  const { formatId } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [format, setFormat] = useState(null);
  const [course, setCourse] = useState(null);
  const [draw, setDraw] = useState(null);

  const [rows, setRows] = useState([]); // {pre, rank, invite}
  const [q, setQ] = useState("");
  const [onlyInvited, setOnlyInvited] = useState(false);
  const [onlyUsed, setOnlyUsed] = useState(false);

  async function load() {
    if (!formatId) return;
    setLoading(true);
    setErr("");

    try {
      // 1) Format + Course
      const { data: f, error: fe } = await supabase
        .from("formats")
        .select("id, nom, date, heure_depart, course_id")
        .eq("id", formatId)
        .single();
      if (fe) throw fe;
      setFormat(f);

      const { data: c, error: ce } = await supabase
        .from("courses")
        .select("id, nom, lieu, image_url")
        .eq("id", f.course_id)
        .single();
      if (ce) throw ce;
      setCourse(c);

      // 2) Draw (idempotent : on prend le dernier si plusieurs, sinon single)
      const { data: draws, error: de } = await supabase
        .from("lottery_draws")
        .select("id, format_id, seed, candidate_count, candidate_hash")
        .eq("format_id", formatId)
        .order("created_at", { ascending: false }) // si created_at n’existe pas, supabase ignore ? non -> erreur. Donc on évite.
        .limit(1);

      // ⚠️ Si ta table lottery_draws n'a pas created_at, la ligne ci-dessus peut planter.
      // Pour être robuste, on retente sans order si erreur "column ... does not exist".
      let drawRow = null;
      if (de) {
        // fallback safe
        const { data: d2, error: de2 } = await supabase
          .from("lottery_draws")
          .select("id, format_id, seed, candidate_count, candidate_hash")
          .eq("format_id", formatId)
          .limit(1);
        if (de2) throw de2;
        drawRow = (d2 && d2[0]) || null;
      } else {
        drawRow = (draws && draws[0]) || null;
      }
      setDraw(drawRow);

      if (!drawRow?.id) {
        // Pas de tirage encore
        setRows([]);
        setLoading(false);
        return;
      }

      // 3) Ranks (ordre complet)
      const { data: rks, error: re } = await supabase
        .from("lottery_ranks")
        .select("preinscription_id, rank")
        .eq("draw_id", drawRow.id)
        .order("rank", { ascending: true });
      if (re) throw re;

      const preIds = (rks || []).map((x) => x.preinscription_id).filter(Boolean);
      if (!preIds.length) {
        setRows([]);
        setLoading(false);
        return;
      }

      // 4) Préinscriptions
      const { data: pres, error: pe } = await supabase
        .from("format_preinscriptions")
        .select("id, email, prenom, nom, status, created_at")
        .in("id", preIds);
      if (pe) throw pe;

      const preMap = new Map((pres || []).map((p) => [p.id, p]));

      // 5) Invites (⚠️ pas de created_at chez toi -> on NE le select pas)
      const { data: invs, error: ie } = await supabase
        .from("lottery_invites")
        .select("id, preinscription_id, expires_at, used_at, batch_no")
        .in("preinscription_id", preIds);
      if (ie) throw ie;

      const invMap = new Map((invs || []).map((i) => [i.preinscription_id, i]));

      // 6) Assemble
      const assembled = (rks || [])
        .map((rk) => {
          const pre = preMap.get(rk.preinscription_id) || null;
          const invite = invMap.get(rk.preinscription_id) || null;
          return {
            pre,
            rank: rk.rank,
            invite,
          };
        })
        .filter((x) => x.pre);

      setRows(assembled);
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatId]);

  const stats = useMemo(() => {
    const total = rows.length;
    const invited = rows.filter((r) => r.invite?.id).length;
    const used = rows.filter((r) => r.invite?.used_at).length;
    const expired = rows.filter((r) => r.invite?.id && r.invite?.expires_at && String(r.invite.expires_at) <= nowIso())
      .length;
    return { total, invited, used, expired };
  }, [rows]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return rows.filter((r) => {
      if (!r.pre) return false;

      if (onlyInvited && !r.invite?.id) return false;
      if (onlyUsed && !r.invite?.used_at) return false;

      if (!qq) return true;

      const name = `${r.pre?.prenom || ""} ${r.pre?.nom || ""}`.trim().toLowerCase();
      const masked = maskEmail(r.pre?.email).toLowerCase();
      const rk = String(r.rank || "");
      return name.includes(qq) || masked.includes(qq) || rk === qq;
    });
  }, [rows, q, onlyInvited, onlyUsed]);

  if (loading) {
    return (
      <Container>
        <div className="flex items-center gap-3 text-neutral-700">
          <Loader2 className="h-5 w-5 animate-spin" />
          <div>Chargement du tirage…</div>
        </div>
      </Container>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-orange-50 ring-1 ring-orange-200 grid place-items-center">
                <Trophy className="h-6 w-6 text-orange-700" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                    Résultats du tirage
                  </h1>
                  <Pill className="bg-neutral-50 text-neutral-700 ring-neutral-200">
                    <Shield className="h-4 w-4" />
                    Public
                  </Pill>
                </div>

                <p className="mt-2 text-neutral-600">
                  {course?.nom ? <span className="font-semibold text-neutral-900">{course.nom}</span> : "—"}
                  {format?.nom ? <span> • <b>{format.nom}</b></span> : null}
                  {course?.lieu ? <span> • {course.lieu}</span> : null}
                  {format?.date ? <span> • {fmtDate(format.date)}</span> : null}
                </p>

                <p className="mt-1 text-sm text-neutral-500">
                  Les informations affichées sont anonymisées. Seul l’organisateur voit les emails complets.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={load}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-neutral-200 hover:bg-neutral-50"
              >
                <RefreshCw className="h-4 w-4" />
                Actualiser
              </button>

              {course?.id ? (
                <Link
                  to={`/courses/${course.id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
                >
                  Voir la page course
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <Container>
        {err ? (
          <Card>
            <div className="p-5">
              <div className="text-lg font-semibold text-neutral-900">Erreur</div>
              <div className="mt-1 text-sm text-neutral-600">{err}</div>
            </div>
          </Card>
        ) : null}

        {!draw?.id ? (
          <Card>
            <div className="p-6">
              <div className="text-lg font-semibold text-neutral-900">Tirage non publié</div>
              <p className="mt-2 text-sm text-neutral-600">
                Le tirage n’a pas encore été effectué pour ce format.
              </p>
              <p className="mt-2 text-sm text-neutral-600">
                Si tu es organisateur, lance le tirage depuis ton espace : <b>Organisateur → Tirage</b>.
              </p>
            </div>
          </Card>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <Card>
                <div className="p-4">
                  <div className="text-xs text-neutral-500">Candidats</div>
                  <div className="text-2xl font-black">{stats.total}</div>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <div className="text-xs text-neutral-500">Invitations envoyées</div>
                  <div className="text-2xl font-black">{stats.invited}</div>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <div className="text-xs text-neutral-500">Invitations utilisées</div>
                  <div className="text-2xl font-black">{stats.used}</div>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <div className="text-xs text-neutral-500">Expirées</div>
                  <div className="text-2xl font-black">{stats.expired}</div>
                </div>
              </Card>
            </div>

            {/* Filters */}
            <Card className="mb-5">
              <div className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 relative">
                  <Search className="h-4 w-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Recherche : rang, prénom, nom (anonymisé), email masqué…"
                    className="pl-9"
                  />
                </div>

                <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={onlyInvited}
                    onChange={(e) => setOnlyInvited(e.target.checked)}
                  />
                  Invitations envoyées
                </label>

                <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={onlyUsed}
                    onChange={(e) => setOnlyUsed(e.target.checked)}
                  />
                  Invitations utilisées
                </label>
              </div>
            </Card>

            {/* Table */}
            <Card>
              <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
                <div className="text-sm text-neutral-600">
                  Affichage : <b>{filtered.length}</b> / {rows.length}
                </div>
                <div className="text-xs text-neutral-500">
                  Mise à jour : {fmtDT(new Date().toISOString())}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-semibold text-neutral-700 w-20">Rang</th>
                      <th className="px-4 py-3 font-semibold text-neutral-700">Candidat</th>
                      <th className="px-4 py-3 font-semibold text-neutral-700">Statut</th>
                      <th className="px-4 py-3 font-semibold text-neutral-700">Expiration</th>
                      <th className="px-4 py-3 font-semibold text-neutral-700">Lot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                          Aucun résultat.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((r) => {
                        const meta = statusMeta(r.pre?.status, r.invite);
                        const exp = r.invite?.expires_at ? String(r.invite.expires_at) : null;
                        const expText = exp ? fmtDT(exp) : "—";
                        const batch = r.invite?.batch_no ?? null;

                        return (
                          <tr key={r.pre.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                            <td className="px-4 py-3 font-black text-neutral-900">#{r.rank}</td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-neutral-900">{displayName(r.pre)}</div>
                              <div className="text-xs text-neutral-500">{maskEmail(r.pre?.email)}</div>
                            </td>
                            <td className="px-4 py-3">
                              <Pill className={pillClass(meta.tone)}>
                                {meta.icon}
                                {meta.label}
                              </Pill>
                            </td>
                            <td className="px-4 py-3 text-neutral-700">
                              {r.invite?.id ? (
                                <div className="flex items-center gap-2">
                                  {r.invite?.used_at ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-700" />
                                  ) : exp && exp <= nowIso() ? (
                                    <AlertTriangle className="h-4 w-4 text-amber-800" />
                                  ) : (
                                    <Clock className="h-4 w-4 text-neutral-400" />
                                  )}
                                  <span>{expText}</span>
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3 text-neutral-700">
                              {batch ? (
                                <span className="inline-flex rounded-lg bg-neutral-100 px-2 py-1 text-xs font-semibold">
                                  Lot {batch}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-4 text-xs text-neutral-500">
                Légende : “Invité” = invitation envoyée (un lien perso a été généré). “Invitation utilisée” = inscription
                finalisée après paiement (l’invitation est consommée).
              </div>
            </Card>
          </>
        )}
      </Container>
    </div>
  );
}

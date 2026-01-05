// src/pages/MesInscriptions.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import { Link, useNavigate } from "react-router-dom";

/* Utils */
const formatDate = (d) =>
  d
    ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(
        typeof d === "string" ? new Date(d) : d
      )
    : "";

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

const safeLower = (s) => String(s || "").trim().toLowerCase();

const Container = ({ children }) => <div className="mx-auto w-full max-w-5xl px-4 py-8">{children}</div>;

const Card = ({ children, className = "" }) => (
  <div className={`overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white shadow-sm ${className}`}>{children}</div>
);

function StatusPill({ value }) {
  const s = safeLower(value);

  const cfg = (() => {
    if (["paye", "payé"].includes(s)) return { cls: "bg-green-50 ring-green-200 text-green-800", label: "Payé" };
    if (["valide", "validé", "confirme", "confirmé"].includes(s))
      return { cls: "bg-green-50 ring-green-200 text-green-800", label: "Validé" };
    if (["en attente", "en_attente", "pending"].includes(s))
      return { cls: "bg-amber-50 ring-amber-200 text-amber-900", label: "En attente" };
    if (["annule", "annulé", "cancelled"].includes(s))
      return { cls: "bg-gray-100 ring-gray-200 text-gray-700", label: "Annulé" };
    if (["invited"].includes(s)) return { cls: "bg-blue-50 ring-blue-200 text-blue-800", label: "Invité" };
    if (["ranked"].includes(s)) return { cls: "bg-purple-50 ring-purple-200 text-purple-900", label: "Classé" };
    if (["pending"].includes(s)) return { cls: "bg-amber-50 ring-amber-200 text-amber-900", label: "En attente" };
    if (["withdrawn"].includes(s)) return { cls: "bg-gray-100 ring-gray-200 text-gray-700", label: "Retiré" };
    return { cls: "bg-gray-100 ring-gray-200 text-gray-700", label: value || "—" };
  })();

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs ring-1 ${cfg.cls}`}>{cfg.label}</span>
  );
}

const TabButton = ({ active, onClick, children, count }) => (
  <button
    onClick={onClick}
    className={[
      "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition",
      active ? "bg-neutral-900 text-white ring-neutral-900" : "bg-white text-neutral-900 ring-neutral-200 hover:bg-neutral-50",
    ].join(" ")}
  >
    {children}
    <span className={["rounded-full px-2 py-0.5 text-xs", active ? "bg-white/15" : "bg-neutral-100"].join(" ")}>
      {count}
    </span>
  </button>
);

const Skeleton = () => (
  <div className="min-h-screen bg-neutral-50 text-neutral-900">
    <section className="bg-white border-b border-neutral-200">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="h-7 w-60 bg-neutral-100 rounded mb-2" />
        <div className="h-4 w-96 bg-neutral-100 rounded" />
      </div>
    </section>
    <Container>
      <div className="grid gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl ring-1 ring-neutral-200 bg-white p-5">
            <div className="h-5 w-1/3 bg-neutral-100 rounded mb-2" />
            <div className="h-4 w-2/3 bg-neutral-100 rounded mb-1" />
            <div className="h-4 w-1/2 bg-neutral-100 rounded" />
          </div>
        ))}
      </div>
    </Container>
  </div>
);

function EmptyState({ title, desc, ctaLabel, ctaTo }) {
  return (
    <div className="rounded-2xl ring-1 ring-neutral-200 bg-white p-10 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-neutral-600">{desc}</p>
      {ctaTo ? (
        <Link
          to={ctaTo}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
        >
          {ctaLabel || "Voir"}
        </Link>
      ) : null}
    </div>
  );
}

export default function MesInscriptions() {
  const { session } = useUser();
  const navigate = useNavigate();

  const [tab, setTab] = useState("inscriptions"); // inscriptions | preinscriptions | waitlist
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(true);

  const [inscriptions, setInscriptions] = useState([]);
  const [preinscriptions, setPreinscriptions] = useState([]);
  const [waitlistRows, setWaitlistRows] = useState([]);

  const queryNorm = useMemo(() => safeLower(q), [q]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const sess = session ?? (await supabase.auth.getSession()).data?.session;
        if (!sess?.user) {
          navigate(`/login?next=${encodeURIComponent("/mesinscriptions")}`);
          return;
        }

        const user = sess.user;

        const [ins, pre, wl] = await Promise.all([
          fetchInscriptions(user),
          fetchPreinscriptions(user),
          fetchWaitlist(user),
        ]);

        if (cancelled) return;
        setInscriptions(ins);
        setPreinscriptions(pre);
        setWaitlistRows(wl);
      } catch (e) {
        console.error("MesInscriptions load error:", e);
        if (!cancelled) {
          setInscriptions([]);
          setPreinscriptions([]);
          setWaitlistRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function fetchInscriptions(user) {
    const uid = user.id;
    const uemail = user.email || "";

    const { data: asRunner, error: e1 } = await supabase.from("inscriptions").select("id").eq("coureur_id", uid);
    if (e1) console.warn("asRunner error:", e1?.message);

    // paiements.user_id n’existe peut-être pas chez toi => best-effort
    let pays = [];
    try {
      const r = await supabase.from("paiements").select("inscription_id, inscription_ids").eq("user_id", uid);
      if (r.error) console.warn("pays error:", r.error?.message);
      pays = r.data || [];
    } catch (e) {
      // ignore
    }

    const paidIds = new Set();
    for (const p of pays || []) {
      if (p?.inscription_id) paidIds.add(p.inscription_id);
      if (Array.isArray(p?.inscription_ids)) for (const x of p.inscription_ids) if (x) paidIds.add(x);
    }

    const { data: groups, error: e3 } = await supabase
      .from("inscriptions_groupes")
      .select("id")
      .eq("capitaine_user_id", uid);
    if (e3) console.warn("groups error:", e3?.message);

    let groupInscr = [];
    if (groups?.length) {
      const gIds = groups.map((g) => g.id);

      const { data: d3a } = await supabase.from("inscriptions").select("id").in("groupe_id", gIds);
      const { data: d3b } = await supabase.from("inscriptions").select("id").in("member_of_group_id", gIds);

      groupInscr = [...(d3a || []), ...(d3b || [])];
    }

    let emailInscr = [];
    if (uemail) {
      const { data: d4 } = await supabase.from("inscriptions").select("id").eq("email", uemail);
      emailInscr = d4 || [];
    }

    const ids = new Set();
    for (const r of asRunner || []) if (r?.id) ids.add(r.id);
    for (const id of paidIds) if (id) ids.add(id);
    for (const r of groupInscr || []) if (r?.id) ids.add(r.id);
    for (const r of emailInscr || []) if (r?.id) ids.add(r.id);

    const finalIds = Array.from(ids);
    if (!finalIds.length) return [];

    const richSelect = `
      id, statut, created_at, email, course_id, format_id, team_name, groupe_id, member_of_group_id,
      format:format_id (
        id, nom, distance_km, denivele_dplus, date, type_format, course_id,
        course:course_id ( id, nom, lieu, image_url )
      )
    `;

    const { data: rich, error: eRich } = await supabase
      .from("inscriptions")
      .select(richSelect)
      .in("id", finalIds)
      .order("created_at", { ascending: false });

    if (!eRich) return rich || [];

    console.warn("Inscriptions rich query failed, fallback:", eRich?.message);

    const { data: basic, error: eBasic } = await supabase
      .from("inscriptions")
      .select("id, statut, created_at, email, course_id, format_id, team_name, groupe_id, member_of_group_id")
      .in("id", finalIds)
      .order("created_at", { ascending: false });
    if (eBasic) return [];

    // best-effort join
    const formatIds = [...new Set((basic || []).map((x) => x.format_id).filter(Boolean))];
    const courseIds = [...new Set((basic || []).map((x) => x.course_id).filter(Boolean))];

    const [formatsRes, coursesRes] = await Promise.all([
      formatIds.length
        ? supabase.from("formats").select("id, nom, distance_km, denivele_dplus, date, type_format, course_id").in("id", formatIds)
        : Promise.resolve({ data: [], error: null }),
      courseIds.length ? supabase.from("courses").select("id, nom, lieu, image_url").in("id", courseIds) : Promise.resolve({ data: [], error: null }),
    ]);

    const formatsMap = new Map((formatsRes.data || []).map((f) => [f.id, f]));
    const coursesMap = new Map((coursesRes.data || []).map((c) => [c.id, c]));

    return (basic || []).map((ins) => {
      const fmt = formatsMap.get(ins.format_id) || null;
      const c = coursesMap.get(ins.course_id || fmt?.course_id) || null;
      return { ...ins, format: fmt ? { ...fmt, course: c || null } : null };
    });
  }

  async function fetchPreinscriptions(user) {
    const uid = user.id;
    const uemail = user.email || "";

    // On prend par user_id OU email (car tu peux avoir user_id null)
    const baseSel = `
      id, course_id, format_id, user_id, email, prenom, nom, status, created_at, withdrawn_at, team_id, rank,
      format:format_id ( id, nom, date, distance_km, denivele_dplus, course_id, course:course_id ( id, nom, lieu, image_url ) )
    `;

    // Supabase ne supporte pas un OR propre sur deux champs sans .or()
    const orParts = [];
    if (uid) orParts.push(`user_id.eq.${uid}`);
    if (uemail) orParts.push(`email.eq.${uemail}`);
    if (!orParts.length) return [];

    const { data, error } = await supabase
      .from("format_preinscriptions")
      .select(baseSel)
      .or(orParts.join(","))
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("preinscriptions query failed:", error?.message);
      return [];
    }

    const rows = data || [];
    if (!rows.length) return [];

    // Optionnel: enrichir avec infos d’invitation (expires/used/batch)
    const preIds = rows.map((r) => r.id).filter(Boolean);
    try {
      const { data: inv, error: invErr } = await supabase
        .from("lottery_invites")
        .select("id, preinscription_id, expires_at, used_at, batch_no, created_at")
        .in("preinscription_id", preIds);
      if (!invErr && inv?.length) {
        const map = new Map();
        for (const x of inv) map.set(x.preinscription_id, x);
        return rows.map((r) => ({ ...r, _invite: map.get(r.id) || null }));
      }
    } catch {
      // ignore
    }

    return rows;
  }

  async function fetchWaitlist(user) {
    const uemail = user.email || "";
    if (!uemail) return [];

    // ilike => tolère la casse (sans casser)
    const sel = `
      id, course_id, format_id, email, prenom, nom, created_at, invited_at, invite_token, invite_expires_at, consumed_at, source,
      format:format_id ( id, nom, date, distance_km, denivele_dplus, course_id, course:course_id ( id, nom, lieu, image_url ) )
    `;

    const { data, error } = await supabase
      .from("waitlist")
      .select(sel)
      .ilike("email", uemail)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("waitlist query failed:", error?.message);
      return [];
    }
    return data || [];
  }

  const counts = useMemo(
    () => ({
      inscriptions: inscriptions?.length || 0,
      preinscriptions: preinscriptions?.length || 0,
      waitlist: waitlistRows?.length || 0,
    }),
    [inscriptions, preinscriptions, waitlistRows]
  );

  const filteredInscriptions = useMemo(() => {
    if (!queryNorm) return inscriptions;
    return (inscriptions || []).filter((ins) => {
      const f = ins?.format;
      const c = f?.course;
      const hay = safeLower(`${f?.nom || ""} ${c?.nom || ""} ${c?.lieu || ""}`);
      return hay.includes(queryNorm);
    });
  }, [inscriptions, queryNorm]);

  const filteredPre = useMemo(() => {
    if (!queryNorm) return preinscriptions;
    return (preinscriptions || []).filter((p) => {
      const f = p?.format;
      const c = f?.course;
      const hay = safeLower(`${f?.nom || ""} ${c?.nom || ""} ${c?.lieu || ""} ${p?.email || ""}`);
      return hay.includes(queryNorm);
    });
  }, [preinscriptions, queryNorm]);

  const filteredWaitlist = useMemo(() => {
    if (!queryNorm) return waitlistRows;
    return (waitlistRows || []).filter((w) => {
      const f = w?.format;
      const c = f?.course;
      const hay = safeLower(`${f?.nom || ""} ${c?.nom || ""} ${c?.lieu || ""} ${w?.email || ""}`);
      return hay.includes(queryNorm);
    });
  }, [waitlistRows, queryNorm]);

  if (loading) return <Skeleton />;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 py-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-neutral-900">
            Mes Inscriptions{" "}
            <span className="font-black">
              <span className="text-orange-600">Tick</span>Race
            </span>
          </h1>
          <p className="mt-2 text-neutral-600 text-base">
            Inscriptions • Préinscriptions (tirage) • Listes d’attente — au même endroit.
          </p>
        </div>
      </section>

      <Container>
        {/* Tabs + Search */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <TabButton active={tab === "inscriptions"} onClick={() => setTab("inscriptions")} count={counts.inscriptions}>
                Inscriptions
              </TabButton>
              <TabButton
                active={tab === "preinscriptions"}
                onClick={() => setTab("preinscriptions")}
                count={counts.preinscriptions}
              >
                Préinscriptions (tirage)
              </TabButton>
              <TabButton active={tab === "waitlist"} onClick={() => setTab("waitlist")} count={counts.waitlist}>
                Liste d’attente
              </TabButton>
            </div>

            <div className="w-full md:w-96">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher une course, un lieu, un format…"
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
              />
            </div>
          </div>

          {/* Explanation box */}
          {tab === "preinscriptions" ? (
            <Card className="p-4">
              <div className="text-sm text-neutral-700">
                <div className="font-semibold text-neutral-900 mb-1">Comment ça marche (tirage au sort) ?</div>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Tu fais une <b>préinscription</b> pendant la période d’ouverture.</li>
                  <li>Après le tirage, tu passes en <b>Classé</b> (rang attribué), puis en <b>Invité</b> quand tu es appelé.</li>
                  <li>Quand tu es <b>Invité</b>, tu reçois un <b>email</b> avec un lien d’inscription (valable un temps limité).</li>
                </ul>
              </div>
            </Card>
          ) : null}

          {tab === "waitlist" ? (
            <Card className="p-4">
              <div className="text-sm text-neutral-700">
                <div className="font-semibold text-neutral-900 mb-1">Liste d’attente</div>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Tu rejoins la liste d’attente quand un format est complet.</li>
                  <li>Si une place se libère, tu passes en <b>Invité</b> (email + token) pendant une durée limitée.</li>
                  <li>Le bouton “Utiliser mon invitation” te renvoie vers la page d’inscription (si le token est géré côté inscription).</li>
                </ul>
              </div>
            </Card>
          ) : null}

          {/* Content */}
          {tab === "inscriptions" ? (
            filteredInscriptions.length === 0 ? (
              <EmptyState
                title="Aucune inscription"
                desc="Tu n’as pas encore d’inscription enregistrée."
                ctaLabel="Explorer les courses"
                ctaTo="/courses"
              />
            ) : (
              <ul className="grid gap-5">
                {filteredInscriptions.map((ins) => {
                  const id = ins.id;
                  const f = ins.format || null;
                  const c = f?.course || null;

                  const groupId = ins.member_of_group_id || ins.groupe_id || null;
                  const isTeam =
                    !!groupId || (f?.type_format && safeLower(f.type_format) !== "individuel") || !!ins.team_name;

                  const detailUrl = groupId ? `/mon-inscription-equipe/${groupId}` : `/mon-inscription/${id}`;
                  const courseId = c?.id || f?.course_id || ins.course_id || null;

                  return (
                    <li key={id}>
                      <Card>
                        <div className="flex flex-col md:flex-row">
                          <div className="md:w-52 bg-neutral-100 flex-shrink-0">
                            {c?.image_url ? (
                              <img
                                src={c.image_url}
                                alt={c?.nom || "Course"}
                                className="h-36 md:h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-36 md:h-full w-full grid place-items-center text-sm text-neutral-400">
                                Pas d’image
                              </div>
                            )}
                          </div>

                          <div className="flex-1 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h2 className="text-lg font-semibold leading-snug">{f?.nom || "Format"}</h2>
                                <p className="text-sm text-neutral-600">
                                  {c?.nom ? `${c.nom}${c?.lieu ? ` — ${c.lieu}` : ""}` : "Course"}
                                </p>
                              </div>
                              <StatusPill value={ins.statut} />
                            </div>

                            <div className="mt-2 text-sm text-neutral-700 flex flex-wrap gap-x-4 gap-y-1">
                              {f?.distance_km != null && <span>🏁 {f.distance_km} km</span>}
                              {f?.denivele_dplus != null && <span>⛰️ {f.denivele_dplus} m D+</span>}
                              {f?.date && <span>📅 {formatDate(f.date)}</span>}
                              {isTeam && <span>👥 Équipe</span>}
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-2">
                              <Link
                                to={courseId ? `/courses/${courseId}` : "/courses"}
                                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                              >
                                Voir la page
                              </Link>

                              <Link
                                to={detailUrl}
                                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
                              >
                                {isTeam ? "Voir l’inscription équipe" : "Voir / Modifier"}
                              </Link>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}

          {tab === "preinscriptions" ? (
            filteredPre.length === 0 ? (
              <EmptyState
                title="Aucune préinscription"
                desc="Tu n’as pas de préinscription associée à ton compte/email."
                ctaLabel="Explorer les courses"
                ctaTo="/courses"
              />
            ) : (
              <ul className="grid gap-5">
                {filteredPre.map((p) => {
                  const f = p.format || null;
                  const c = f?.course || null;

                  const courseId = c?.id || f?.course_id || p.course_id || null;
                  const formatId = f?.id || p.format_id || null;

                  const invite = p._invite || null;
                  const isInvited = safeLower(p.status) === "invited";

                  return (
                    <li key={p.id}>
                      <Card>
                        <div className="flex flex-col md:flex-row">
                          <div className="md:w-52 bg-neutral-100 flex-shrink-0">
                            {c?.image_url ? (
                              <img
                                src={c.image_url}
                                alt={c?.nom || "Course"}
                                className="h-36 md:h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-36 md:h-full w-full grid place-items-center text-sm text-neutral-400">
                                Pas d’image
                              </div>
                            )}
                          </div>

                          <div className="flex-1 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h2 className="text-lg font-semibold leading-snug">{f?.nom || "Format"}</h2>
                                <p className="text-sm text-neutral-600">
                                  {c?.nom ? `${c.nom}${c?.lieu ? ` — ${c.lieu}` : ""}` : "Course"}
                                </p>
                              </div>
                              <StatusPill value={p.status} />
                            </div>

                            <div className="mt-2 text-sm text-neutral-700 flex flex-wrap gap-x-4 gap-y-1">
                              {f?.distance_km != null && <span>🏁 {f.distance_km} km</span>}
                              {f?.denivele_dplus != null && <span>⛰️ {f.denivele_dplus} m D+</span>}
                              {f?.date && <span>📅 {formatDate(f.date)}</span>}
                              {p.rank != null && <span>🎲 Rang : {p.rank}</span>}
                            </div>

                            <div className="mt-3 text-sm text-neutral-700">
                              <div>
                                Préinscrit le : <span className="font-medium">{fmtDT(p.created_at)}</span>
                              </div>
                              {invite ? (
                                <div className="mt-1 text-xs text-neutral-600">
                                  Invitation :{" "}
                                  <span className="font-medium">
                                    {invite.used_at
                                      ? `utilisée (${fmtDT(invite.used_at)})`
                                      : invite.expires_at
                                      ? `expire le ${fmtDT(invite.expires_at)}`
                                      : "—"}
                                  </span>
                                  {invite.batch_no != null ? <span className="text-neutral-300"> • </span> : null}
                                  {invite.batch_no != null ? <span>Lot #{invite.batch_no}</span> : null}
                                </div>
                              ) : null}

                              {isInvited ? (
                                <div className="mt-2 text-xs text-blue-700 bg-blue-50 ring-1 ring-blue-200 rounded-xl px-3 py-2">
                                  Tu es <b>invité</b>. Utilise le lien reçu par email pour finaliser ton inscription
                                  (le token est volontairement non affiché ici).
                                </div>
                              ) : null}
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-2">
                              <Link
                                to={courseId ? `/courses/${courseId}` : "/courses"}
                                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                              >
                                Voir la course
                              </Link>

                              <Link
                                to={formatId ? `/tirage/${formatId}` : "/courses"}
                                className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
                              >
                                Voir le tirage / statut
                              </Link>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}

          {tab === "waitlist" ? (
            filteredWaitlist.length === 0 ? (
              <EmptyState
                title="Aucune liste d’attente"
                desc="Tu n’es sur aucune liste d’attente avec ton email."
                ctaLabel="Explorer les courses"
                ctaTo="/courses"
              />
            ) : (
              <ul className="grid gap-5">
                {filteredWaitlist.map((w) => {
                  const f = w.format || null;
                  const c = f?.course || null;

                  const courseId = c?.id || f?.course_id || w.course_id || null;
                  const formatId = f?.id || w.format_id || null;

                  const invited = !!w.invited_at;
                  const consumed = !!w.consumed_at;
                  const expired = w.invite_expires_at ? new Date(w.invite_expires_at).getTime() < Date.now() : false;

                  const statusLabel = consumed
                    ? "consommée"
                    : invited
                    ? expired
                      ? "expirée"
                      : "invitation envoyée"
                    : "en attente";

                  // ⚠️ lien “soft” : ne casse rien même si InscriptionCourse ignore "waitlist"
                  const softInviteUrl =
                    courseId && formatId && w.invite_token
                      ? `/inscription/${courseId}?formatId=${encodeURIComponent(formatId)}&waitlist=${encodeURIComponent(
                          w.invite_token
                        )}`
                      : courseId
                      ? `/inscription/${courseId}?formatId=${encodeURIComponent(formatId || "")}`
                      : "/courses";

                  return (
                    <li key={w.id}>
                      <Card>
                        <div className="flex flex-col md:flex-row">
                          <div className="md:w-52 bg-neutral-100 flex-shrink-0">
                            {c?.image_url ? (
                              <img
                                src={c.image_url}
                                alt={c?.nom || "Course"}
                                className="h-36 md:h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-36 md:h-full w-full grid place-items-center text-sm text-neutral-400">
                                Pas d’image
                              </div>
                            )}
                          </div>

                          <div className="flex-1 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h2 className="text-lg font-semibold leading-snug">{f?.nom || "Format"}</h2>
                                <p className="text-sm text-neutral-600">
                                  {c?.nom ? `${c.nom}${c?.lieu ? ` — ${c.lieu}` : ""}` : "Course"}
                                </p>
                              </div>
                              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs ring-1 bg-gray-100 ring-gray-200 text-gray-700">
                                {statusLabel}
                              </span>
                            </div>

                            <div className="mt-2 text-sm text-neutral-700 flex flex-wrap gap-x-4 gap-y-1">
                              {f?.distance_km != null && <span>🏁 {f.distance_km} km</span>}
                              {f?.denivele_dplus != null && <span>⛰️ {f.denivele_dplus} m D+</span>}
                              {f?.date && <span>📅 {formatDate(f.date)}</span>}
                            </div>

                            <div className="mt-3 text-xs text-neutral-600">
                              <div>Ajouté le : <span className="font-medium">{fmtDT(w.created_at)}</span></div>
                              {w.invited_at ? (
                                <div>Invité le : <span className="font-medium">{fmtDT(w.invited_at)}</span></div>
                              ) : null}
                              {w.invite_expires_at ? (
                                <div>Expire le : <span className="font-medium">{fmtDT(w.invite_expires_at)}</span></div>
                              ) : null}
                              {w.consumed_at ? (
                                <div>Utilisé le : <span className="font-medium">{fmtDT(w.consumed_at)}</span></div>
                              ) : null}
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-2">
                              <Link
                                to={courseId ? `/courses/${courseId}` : "/courses"}
                                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                              >
                                Voir la course
                              </Link>

                              <Link
                                to={softInviteUrl}
                                className={[
                                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white",
                                  invited && !consumed && !expired ? "bg-orange-500 hover:brightness-110" : "bg-neutral-300 cursor-not-allowed",
                                ].join(" ")}
                                onClick={(e) => {
                                  if (!(invited && !consumed && !expired)) e.preventDefault();
                                }}
                                title={
                                  invited && !consumed && !expired
                                    ? "Utiliser l’invitation"
                                    : "Invitation non disponible (pas invité / expirée / déjà utilisée)"
                                }
                              >
                                Utiliser mon invitation
                              </Link>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}
        </div>
      </Container>
    </div>
  );
}

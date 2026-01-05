// src/pages/MesInscriptions.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import { Link, useNavigate } from "react-router-dom";

/* ----------------------------- Utils ----------------------------- */
const safeLower = (s) => String(s || "").trim().toLowerCase();

const formatDate = (d) =>
  d
    ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(
        typeof d === "string" ? new Date(d) : d
      )
    : "";

const formatDateTime = (d) =>
  d
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(typeof d === "string" ? new Date(d) : d)
    : "";

function StatusPill({ children, tone = "gray" }) {
  const tones = {
    gray: "bg-neutral-100 text-neutral-800 ring-neutral-200",
    green: "bg-green-50 text-green-800 ring-green-200",
    orange: "bg-orange-50 text-orange-800 ring-orange-200",
    red: "bg-red-50 text-red-800 ring-red-200",
    blue: "bg-blue-50 text-blue-800 ring-blue-200",
  };
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
        tones[tone] || tones.gray,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function Card({ children }) {
  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      {children}
    </div>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-black tracking-tight text-neutral-900">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-neutral-600">{subtitle}</p> : null}
    </div>
  );
}

/* ----------------------------- Page ------------------------------ */
export default function MesInscriptions() {
  const { session } = useUser();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  const [inscriptions, setInscriptions] = useState([]);
  const [preinscriptions, setPreinscriptions] = useState([]);
  const [waitlist, setWaitlist] = useState([]);

  const hasAny = useMemo(
    () => (inscriptions?.length || 0) + (preinscriptions?.length || 0) + (waitlist?.length || 0) > 0,
    [inscriptions, preinscriptions, waitlist]
  );

  useEffect(() => {
    (async () => {
      const sess = session ?? (await supabase.auth.getSession()).data?.session;
      if (!sess?.user) {
        navigate(`/login?next=${encodeURIComponent("/mesinscriptions")}`);
        return;
      }
      await fetchAll(sess.user);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function fetchAll(user) {
    setLoading(true);
    try {
      const uid = user.id;
      const uemail = safeLower(user.email || "");

      /* =========================
         A) INSCRIPTIONS (payées / coureur / capitaine / email)
         ========================= */
      // 1) Inscriptions où tu es le coureur
      const { data: asRunner, error: e1 } = await supabase.from("inscriptions").select("id").eq("coureur_id", uid);
      if (e1) console.warn("asRunner error:", e1?.message);

      // 2) Inscriptions payées par toi (via paiements)
      const { data: pays, error: e2 } = await supabase.from("paiements").select("inscription_id, inscription_ids").eq("user_id", uid);
      if (e2) console.warn("pays error:", e2?.message);

      const paidIds = new Set();
      for (const p of pays || []) {
        if (p?.inscription_id) paidIds.add(p.inscription_id);
        if (Array.isArray(p?.inscription_ids)) for (const x of p.inscription_ids) if (x) paidIds.add(x);
      }

      // 3) Groupes où tu es capitaine
      const { data: groups, error: e3 } = await supabase.from("inscriptions_groupes").select("id").eq("capitaine_user_id", uid);
      if (e3) console.warn("groups error:", e3?.message);

      let groupInscr = [];
      if (groups?.length) {
        const gIds = groups.map((g) => g.id);

        // a) Ancien modèle : groupe_id
        const { data: d3a, error: e3a } = await supabase.from("inscriptions").select("id").in("groupe_id", gIds);
        if (e3a) console.warn("groupInscr (groupe_id) error:", e3a?.message);

        // b) Nouveau modèle : member_of_group_id
        const { data: d3b, error: e3b } = await supabase.from("inscriptions").select("id").in("member_of_group_id", gIds);
        if (e3b) console.warn("groupInscr (member_of_group_id) error:", e3b?.message);

        groupInscr = [...(d3a || []), ...(d3b || [])];
      }

      // 4) Inscriptions liées à ton email
      let emailInscr = [];
      if (uemail) {
        const { data: d4, error: e4 } = await supabase.from("inscriptions").select("id,email").eq("email", uemail);
        if (e4) console.warn("emailInscr error:", e4?.message);
        emailInscr = d4 || [];
      }

      // Déduplication IDs inscriptions
      const ids = new Set();
      for (const r of asRunner || []) if (r?.id) ids.add(r.id);
      for (const id of paidIds) if (id) ids.add(id);
      for (const r of groupInscr || []) if (r?.id) ids.add(r.id);
      for (const r of emailInscr || []) if (r?.id) ids.add(r.id);

      const finalInsIds = Array.from(ids);

      let richIns = [];
      if (finalInsIds.length) {
        const { data: rich, error: eRich } = await supabase
          .from("inscriptions")
          .select(
            `
            *,
            format:format_id (
              id,
              nom,
              distance_km,
              denivele_dplus,
              date,
              type_format,
              course:course_id (
                id,
                nom,
                lieu,
                image_url
              )
            )
          `
          )
          .in("id", finalInsIds)
          .order("created_at", { ascending: false });

        if (eRich) {
          console.error("Erreur chargement inscriptions enrichies:", eRich.message);
          richIns = [];
        } else {
          richIns = rich || [];
        }
      }
      setInscriptions(richIns);

      /* =========================
         B) PRÉINSCRIPTIONS LOTERIE (format_preinscriptions)
         ========================= */
      let pre = [];
      if (uemail) {
        const { data: p1, error: pe1 } = await supabase
          .from("format_preinscriptions")
          .select(
            `
            id,
            course_id,
            format_id,
            email,
            prenom,
            nom,
            status,
            rank,
            created_at,
            withdrawn_at,
            format:format_id (
              id,
              nom,
              date,
              distance_km,
              denivele_dplus,
              course:course_id (
                id,
                nom,
                lieu,
                image_url
              )
            )
          `
          )
          .or(`user_id.eq.${uid},email.eq.${uemail}`)
          .order("created_at", { ascending: false });

        if (pe1) {
          console.warn("preinscriptions error:", pe1?.message);
          pre = [];
        } else {
          pre = p1 || [];
        }
      }
      setPreinscriptions(pre);

      /* =========================
         C) LISTE D’ATTENTE (waitlist)
         ========================= */
      let wl = [];
      if (uemail) {
        const { data: w1, error: we1 } = await supabase
          .from("waitlist")
          .select(
            `
            id,
            course_id,
            format_id,
            email,
            prenom,
            nom,
            created_at,
            invited_at,
            invite_expires_at,
            consumed_at,
            source,
            format:format_id (
              id,
              nom,
              date,
              distance_km,
              denivele_dplus,
              course:course_id (
                id,
                nom,
                lieu,
                image_url
              )
            )
          `
          )
          .eq("email", uemail)
          .order("created_at", { ascending: false });

        if (we1) {
          console.warn("waitlist error:", we1?.message);
          wl = [];
        } else {
          wl = w1 || [];
        }
      }
      setWaitlist(wl);
    } catch (err) {
      console.error("fetchAll fatal:", err);
      setInscriptions([]);
      setPreinscriptions([]);
      setWaitlist([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-7xl px-4 py-10">
            <div className="h-6 w-52 bg-neutral-100 rounded mb-2" />
            <div className="h-4 w-96 bg-neutral-100 rounded" />
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="grid gap-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl ring-1 ring-neutral-200 bg-white p-5">
                <div className="h-5 w-1/3 bg-neutral-100 rounded mb-2" />
                <div className="h-4 w-2/3 bg-neutral-100 rounded mb-1" />
                <div className="h-4 w-1/2 bg-neutral-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

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
            Inscriptions, préinscriptions (loterie) et listes d’attente — au même endroit.
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-10">
        {!hasAny ? (
          <EmptyState />
        ) : (
          <>
            {/* =========================
               1) Inscriptions
               ========================= */}
            <div>
              <SectionTitle
                title="✅ Inscriptions"
                subtitle="Vos inscriptions confirmées / en cours (solo ou équipe)."
              />

              {inscriptions.length === 0 ? (
                <div className="rounded-2xl ring-1 ring-neutral-200 bg-white p-6 text-sm text-neutral-600">
                  Aucune inscription trouvée.
                </div>
              ) : (
                <ul className="grid gap-5">
                  {inscriptions.map((inscription) => {
                    const { format, statut, id } = inscription || {};
                    const course = format?.course || null;

                    const courseId = course?.id || inscription?.course_id || null;
                    const formatId = format?.id || inscription?.format_id || null;

                    const groupId = inscription?.member_of_group_id || inscription?.groupe_id || null;
                    const isTeam =
                      !!groupId ||
                      (!!format?.type_format && format.type_format !== "individuel") ||
                      !!inscription?.team_name;

                    const detailUrl = groupId ? `/mon-inscription-equipe/${groupId}` : `/mon-inscription/${id}`;

                    const pillTone =
                      statut === "paye" || statut === "validé" ? "green" : statut?.includes("attente") ? "orange" : "gray";

                    return (
                      <li key={id}>
                        <Card>
                          <div className="flex flex-col md:flex-row">
                            {/* Cover */}
                            <div className="md:w-52 flex-shrink-0 bg-neutral-100">
                              {course?.image_url ? (
                                <img
                                  src={course.image_url}
                                  alt={course?.nom || "Course"}
                                  className="h-36 md:h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="h-36 md:h-full w-full grid place-items-center text-sm text-neutral-400">
                                  Pas d’image
                                </div>
                              )}
                            </div>

                            {/* Body */}
                            <div className="flex-1 p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <h3 className="text-lg font-semibold leading-snug">{format?.nom || "Format"}</h3>
                                  <p className="text-sm text-neutral-600">
                                    {course?.nom || "Course"} {course?.lieu ? <>— {course.lieu}</> : null}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  {isTeam ? <StatusPill tone="blue">👥 Équipe</StatusPill> : null}
                                  <StatusPill tone={pillTone}>{statut || "—"}</StatusPill>
                                </div>
                              </div>

                              <div className="mt-2 text-sm text-neutral-700 flex flex-wrap gap-x-4 gap-y-1">
                                {format?.distance_km != null && <span>🏁 {format.distance_km} km</span>}
                                {format?.denivele_dplus != null && <span>⛰️ {format.denivele_dplus} m D+</span>}
                                {format?.date && <span>📅 {formatDate(format.date)}</span>}
                              </div>

                              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
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

                              {/* Bonus lien tirage public si tu veux l’avoir aussi ici */}
                              {formatId ? (
                                <div className="mt-3">
                                  <Link
                                    to={`/tirage/${formatId}`}
                                    className="text-sm font-semibold text-neutral-900 underline decoration-neutral-300 hover:decoration-neutral-800"
                                  >
                                    Voir le tirage / statut public
                                  </Link>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* =========================
               2) Préinscriptions (loterie)
               ========================= */}
            <div>
              <SectionTitle
                title="🎟️ Préinscriptions (loterie)"
                subtitle="Ici, tu retrouves tes préinscriptions et tu peux consulter le tirage public (statut/rang)."
              />

              {preinscriptions.length === 0 ? (
                <div className="rounded-2xl ring-1 ring-neutral-200 bg-white p-6 text-sm text-neutral-600">
                  Aucune préinscription loterie trouvée.
                </div>
              ) : (
                <ul className="grid gap-5">
                  {preinscriptions.map((p) => {
                    const f = p?.format || null;
                    const c = f?.course || null;

                    const courseId = c?.id || p?.course_id || null;
                    const formatId = f?.id || p?.format_id || null;

                    const status = p?.status || "—";
                    const tone =
                      status === "invited" ? "orange" : status === "ranked" ? "blue" : status === "pending" ? "gray" : status === "withdrawn" ? "red" : "gray";

                    return (
                      <li key={p.id}>
                        <Card>
                          <div className="flex flex-col md:flex-row">
                            <div className="md:w-52 flex-shrink-0 bg-neutral-100">
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
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <h3 className="text-lg font-semibold leading-snug">{f?.nom || "Format"}</h3>
                                  <p className="text-sm text-neutral-600">
                                    {c?.nom || "Course"} {c?.lieu ? <>— {c.lieu}</> : null}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  {p?.rank ? <StatusPill tone="blue">Rang #{p.rank}</StatusPill> : null}
                                  <StatusPill tone={tone}>{status}</StatusPill>
                                </div>
                              </div>

                              <div className="mt-2 text-sm text-neutral-700 flex flex-wrap gap-x-4 gap-y-1">
                                {f?.distance_km != null && <span>🏁 {f.distance_km} km</span>}
                                {f?.denivele_dplus != null && <span>⛰️ {f.denivele_dplus} m D+</span>}
                                {f?.date && <span>📅 {formatDate(f.date)}</span>}
                                {p?.created_at && <span>🕒 Préinscrit le {formatDateTime(p.created_at)}</span>}
                              </div>

                              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                                <Link
                                  to={courseId ? `/courses/${courseId}` : "/courses"}
                                  className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                                >
                                  Voir la page
                                </Link>

                                {/* ✅ BOUTON DEMANDÉ : Tirage public */}
                                <Link
                                  to={formatId ? `/tirage/${formatId}` : "/courses"}
                                  className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
                                  title="Consulter le tirage public (statut / rang / infos)"
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
              )}
            </div>

            {/* =========================
               3) Liste d’attente
               ========================= */}
            <div>
              <SectionTitle
                title="⏳ Listes d’attente"
                subtitle="Tu es en liste d’attente sur un format complet : tu verras ici si tu as été invité(e)."
              />

              {waitlist.length === 0 ? (
                <div className="rounded-2xl ring-1 ring-neutral-200 bg-white p-6 text-sm text-neutral-600">
                  Aucune liste d’attente trouvée.
                </div>
              ) : (
                <ul className="grid gap-5">
                  {waitlist.map((w) => {
                    const f = w?.format || null;
                    const c = f?.course || null;

                    const courseId = c?.id || w?.course_id || null;
                    const formatId = f?.id || w?.format_id || null;

                    const isInvited = !!w?.invited_at && !w?.consumed_at;
                    const isConsumed = !!w?.consumed_at;

                    const statusLabel = isConsumed ? "consommée" : isInvited ? "invité(e)" : "en attente";
                    const statusTone = isConsumed ? "green" : isInvited ? "orange" : "gray";

                    return (
                      <li key={w.id}>
                        <Card>
                          <div className="flex flex-col md:flex-row">
                            <div className="md:w-52 flex-shrink-0 bg-neutral-100">
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
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <h3 className="text-lg font-semibold leading-snug">{f?.nom || "Format"}</h3>
                                  <p className="text-sm text-neutral-600">
                                    {c?.nom || "Course"} {c?.lieu ? <>— {c.lieu}</> : null}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  <StatusPill tone={statusTone}>{statusLabel}</StatusPill>
                                </div>
                              </div>

                              <div className="mt-2 text-sm text-neutral-700 flex flex-wrap gap-x-4 gap-y-1">
                                {f?.distance_km != null && <span>🏁 {f.distance_km} km</span>}
                                {f?.denivele_dplus != null && <span>⛰️ {f.denivele_dplus} m D+</span>}
                                {f?.date && <span>📅 {formatDate(f.date)}</span>}
                                {w?.created_at && <span>🕒 Ajouté le {formatDateTime(w.created_at)}</span>}
                              </div>

                              {isInvited && w?.invite_expires_at ? (
                                <div className="mt-2 text-sm text-neutral-700">
                                  ⏱️ Invitation valable jusqu’au <b>{formatDateTime(w.invite_expires_at)}</b>
                                </div>
                              ) : null}

                              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                                <Link
                                  to={courseId ? `/courses/${courseId}` : "/courses"}
                                  className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                                >
                                  Voir la page
                                </Link>

                                {/* Optionnel : tirage public aussi */}
                                <Link
                                  to={formatId ? `/tirage/${formatId}` : "/courses"}
                                  className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
                                >
                                  Voir le tirage / statut
                                </Link>
                              </div>

                              {isInvited ? (
                                <div className="mt-3 text-xs text-neutral-500">
                                  Si tu as reçu un lien d’invitation par email, utilise-le pour finaliser l’inscription.
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* --------------------------- Empty state -------------------------- */
function EmptyState() {
  return (
    <div className="rounded-2xl ring-1 ring-neutral-200 bg-white p-10 text-center">
      <h3 className="text-lg font-semibold">Rien ici pour le moment</h3>
      <p className="mt-1 text-neutral-600">
        Parcourez les épreuves et trouvez votre prochaine course, ou rejoignez une loterie / liste d’attente.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Link
          to="/courses"
          className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
        >
          Explorer les courses
        </Link>
      </div>
    </div>
  );
}

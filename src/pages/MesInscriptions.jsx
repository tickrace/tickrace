// src/pages/MesInscriptions.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import { Link, useNavigate } from "react-router-dom";

/* Utils */
const formatDate = (d) =>
  d
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(typeof d === "string" ? new Date(d) : d)
    : "";

const formatDateTime = (d) => {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(d);
  }
};

// ✅ Ajuste si ta route front n’est pas celle-ci
const acceptUrl =
  w.invite_token && !consumed && !expired
    ? `/inscription/${w.course_id}?formatId=${encodeURIComponent(w.format_id)}&invite=${encodeURIComponent(w.invite_token)}`
    : null;
 // ex: /waitlist/accept?token=...

export default function MesInscriptions() {
  const { session } = useUser();
  const navigate = useNavigate();

  const [inscriptions, setInscriptions] = useState([]);
  const [waitlists, setWaitlists] = useState([]);
  const [loading, setLoading] = useState(true);

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
      await Promise.all([fetchInscriptions(user), fetchWaitlists(user)]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchWaitlists(user) {
    try {
      const uemail = (user.email || "").trim();
      if (!uemail) {
        setWaitlists([]);
        return;
      }

      // waitlist est basée sur email (index ux_waitlist_format_email sur lower(email))
      // côté front: on fait un match case-insensitive via ILIKE
      const { data, error } = await supabase
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
          invite_token,
          invite_expires_at,
          consumed_at,
          source,
          course:course_id (
            id,
            nom,
            lieu,
            image_url
          ),
          format:format_id (
            id,
            nom,
            date,
            distance_km,
            denivele_dplus,
            type_format
          )
        `
        )
        .ilike("email", uemail)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("waitlist fetch error:", error.message);
        setWaitlists([]);
        return;
      }

      setWaitlists(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("fetchWaitlists fatal:", err);
      setWaitlists([]);
    }
  }

  async function fetchInscriptions(user) {
    try {
      const uid = user.id;
      const uemail = user.email || "";

      /* 1) Inscriptions où tu es le coureur */
      const { data: asRunner, error: e1 } = await supabase
        .from("inscriptions")
        .select("id")
        .eq("coureur_id", uid);
      if (e1) console.warn("asRunner error:", e1?.message);

      /* 2) Inscriptions payées par toi (via paiements) */
      const { data: pays, error: e2 } = await supabase
        .from("paiements")
        .select("inscription_id, inscription_ids")
        .eq("user_id", uid);
      if (e2) console.warn("pays error:", e2?.message);

      const paidIds = new Set();
      for (const p of pays || []) {
        if (p.inscription_id) paidIds.add(p.inscription_id);
        if (Array.isArray(p.inscription_ids)) {
          for (const x of p.inscription_ids) if (x) paidIds.add(x);
        }
      }

      /* 3) Groupes où tu es capitaine */
      const { data: groups, error: e3 } = await supabase
        .from("inscriptions_groupes")
        .select("id")
        .eq("capitaine_user_id", uid);
      if (e3) console.warn("groups error:", e3?.message);

      let groupInscr = [];
      if (groups?.length) {
        const gIds = groups.map((g) => g.id);

        // a) Ancien modèle : lien via groupe_id
        const { data: d3a, error: e3a } = await supabase
          .from("inscriptions")
          .select("id")
          .in("groupe_id", gIds);
        if (e3a) console.warn("groupInscr (groupe_id) error:", e3a?.message);

        // b) Nouveau modèle : lien via member_of_group_id
        const { data: d3b, error: e3b } = await supabase
          .from("inscriptions")
          .select("id")
          .in("member_of_group_id", gIds);
        if (e3b) console.warn("groupInscr (member_of_group_id) error:", e3b?.message);

        groupInscr = [...(d3a || []), ...(d3b || [])];
      }

      /* 4) Inscriptions liées à ton email */
      let emailInscr = [];
      if (uemail) {
        const { data: d4, error: e4 } = await supabase
          .from("inscriptions")
          .select("id")
          .eq("email", uemail);
        if (e4) console.warn("emailInscr error:", e4?.message);
        emailInscr = d4 || [];
      }

      /* Déduplication des IDs */
      const ids = new Set();
      for (const r of asRunner || []) ids.add(r.id);
      for (const id of paidIds) ids.add(id);
      for (const r of groupInscr || []) ids.add(r.id);
      for (const r of emailInscr || []) ids.add(r.id);

      const finalIds = Array.from(ids);
      if (finalIds.length === 0) {
        setInscriptions([]);
        return;
      }

      /* Requête riche pour affichage */
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
        .in("id", finalIds)
        .order("created_at", { ascending: false });

      if (eRich) {
        console.error("Erreur chargement inscriptions enrichies:", eRich.message);
        setInscriptions([]);
      } else {
        setInscriptions(rich || []);
      }
    } catch (err) {
      console.error("fetchInscriptions fatal:", err);
      setInscriptions([]);
    }
  }

  const waitlistSorted = useMemo(() => {
    const arr = Array.isArray(waitlists) ? [...waitlists] : [];
    // Tri: invitations actives d’abord, puis pending
    const now = Date.now();
    const score = (w) => {
      const consumed = !!w.consumed_at;
      const invited = !!w.invited_at;
      const exp = w.invite_expires_at ? new Date(w.invite_expires_at).getTime() : null;
      const expired = invited && exp && exp <= now;

      if (consumed) return 3;
      if (invited && !expired) return 0;
      if (invited && expired) return 2;
      return 1; // pending
    };
    arr.sort((a, b) => score(a) - score(b));
    return arr;
  }, [waitlists]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-7xl px-4 py-10">
            <div className="h-6 w-48 bg-neutral-100 rounded mb-2" />
            <div className="h-4 w-80 bg-neutral-100 rounded" />
          </div>
        </section>
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="grid gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
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
          <p className="mt-2 text-neutral-600 text-base">Inscrivez-vous. Courez. Partagez.</p>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* ✅ Inscriptions */}
        {inscriptions.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid gap-5">
            {inscriptions.map((inscription) => {
              const { format, statut, id } = inscription;
              const course = format?.course;

              // ID du groupe (nouveau modèle: member_of_group_id, ancien: groupe_id)
              const groupId = inscription.member_of_group_id || inscription.groupe_id || null;

              // Inscription d'équipe si reliée à un groupe OU type_format≠individuel OU team_name présent
              const isTeam =
                !!groupId || (format?.type_format && format.type_format !== "individuel") || !!inscription.team_name;

              const detailUrl = groupId ? `/mon-inscription-equipe/${groupId}` : `/mon-inscription/${id}`;

              return (
                <li
                  key={id}
                  className="overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col md:flex-row">
                    {/* Cover */}
                    <div className="md:w-48 flex-shrink-0 bg-neutral-100">
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
                      <h2 className="text-lg font-semibold leading-snug">{format?.nom || "Format"}</h2>
                      <p className="text-sm text-neutral-600">
                        {course?.nom} — {course?.lieu}
                      </p>

                      <div className="mt-1 text-sm text-neutral-700 flex flex-wrap gap-x-4 gap-y-1">
                        {format?.distance_km != null && <span>🏁 {format.distance_km} km</span>}
                        {format?.denivele_dplus != null && <span>⛰️ {format.denivele_dplus} m D+</span>}
                        {format?.date && <span>📅 {formatDate(format.date)}</span>}
                        {isTeam && <span>👥 Inscription équipe</span>}
                      </div>

                      <div className="mt-2 text-sm">
                        Statut : <span className="font-medium">{statut || "—"}</span>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <Link
                          to={`/courses/${course?.id ?? ""}`}
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
                </li>
              );
            })}
          </ul>
        )}

        {/* ✅ WAITLISTS */}
        {waitlistSorted.length > 0 ? (
          <div className="mt-10">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-neutral-900">Mes listes d’attente</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Si une place se libère, tu reçois une invitation avec une durée limitée.
                </p>
              </div>
              <span className="text-xs text-neutral-500">{waitlistSorted.length} demande(s)</span>
            </div>

            <ul className="mt-4 grid gap-5">
              {waitlistSorted.map((w) => {
                const course = w.course;
                const format = w.format;

                const now = Date.now();
                const hasInvite = !!w.invited_at;
                const consumed = !!w.consumed_at;
                const expTs = w.invite_expires_at ? new Date(w.invite_expires_at).getTime() : null;
                const expired = hasInvite && expTs && expTs <= now;

                let label = "En attente";
                let pillClass = "bg-gray-50 ring-gray-200 text-gray-700";
                if (consumed) {
                  label = "Invitation utilisée";
                  pillClass = "bg-neutral-100 ring-neutral-200 text-neutral-700";
                } else if (hasInvite && !expired) {
                  label = "Invité(e) — action requise";
                  pillClass = "bg-green-50 ring-green-200 text-green-700";
                } else if (hasInvite && expired) {
                  label = "Invitation expirée";
                  pillClass = "bg-amber-50 ring-amber-200 text-amber-800";
                }

                const acceptUrl =
                  w.invite_token && !consumed && !expired
                    ? `${WAITLIST_ACCEPT_PATH}?token=${encodeURIComponent(w.invite_token)}`
                    : null;

                return (
                  <li
                    key={w.id}
                    className="overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white shadow-sm"
                  >
                    <div className="flex flex-col md:flex-row">
                      <div className="md:w-48 flex-shrink-0 bg-neutral-100">
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

                      <div className="flex-1 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-lg font-semibold leading-snug">
                              {format?.nom || "Format"}{" "}
                              <span className="text-neutral-400">• Liste d’attente</span>
                            </h3>
                            <p className="text-sm text-neutral-600">
                              {course?.nom} — {course?.lieu}
                            </p>
                          </div>

                          <span
                            className={[
                              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1",
                              pillClass,
                            ].join(" ")}
                          >
                            {label}
                          </span>
                        </div>

                        <div className="mt-2 text-sm text-neutral-700 flex flex-wrap gap-x-4 gap-y-1">
                          {format?.date && <span>📅 {formatDate(format.date)}</span>}
                          {w.created_at && <span>🕒 Demande : {formatDateTime(w.created_at)}</span>}
                          {w.invited_at && <span>✉️ Invité : {formatDateTime(w.invited_at)}</span>}
                          {w.invite_expires_at && <span>⏳ Expire : {formatDateTime(w.invite_expires_at)}</span>}
                        </div>

                        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              to={`/courses/${course?.id ?? ""}`}
                              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                            >
                              Voir la course
                            </Link>

                            {format?.id ? (
                              <Link
                                to={`/tirage/${format.id}`}
                                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                                title="Si le format utilise un tirage, tu peux suivre ici."
                              >
                                Voir le tirage / statut
                              </Link>
                            ) : null}
                          </div>

                          {acceptUrl ? (
                            <Link
                              to={acceptUrl}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
                            >
                              Utiliser l’invitation
                            </Link>
                          ) : (
                            <span className="text-xs text-neutral-500">
                              {consumed
                                ? "Invitation déjà utilisée."
                                : hasInvite && expired
                                ? "Invitation expirée."
                                : "En attente de libération de place."}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 text-xs text-neutral-500">
                          Email : <span className="font-medium">{w.email}</span>
                          {w.source ? <span className="text-neutral-300"> • </span> : null}
                          {w.source ? <span>Source : {w.source}</span> : null}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* Empty state */
function EmptyState() {
  return (
    <div className="rounded-2xl ring-1 ring-neutral-200 bg-white p-10 text-center">
      <h3 className="text-lg font-semibold">Aucune inscription pour le moment</h3>
      <p className="mt-1 text-neutral-600">Parcourez les épreuves et trouvez votre prochaine course.</p>
      <Link
        to="/courses"
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
      >
        Explorer les courses
      </Link>
    </div>
  );
}

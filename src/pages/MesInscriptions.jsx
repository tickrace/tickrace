// src/pages/MesInscriptions.jsx
import React, { useEffect, useState } from "react";
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

export default function MesInscriptions() {
  const { session } = useUser();
  const navigate = useNavigate();
  const [inscriptions, setInscriptions] = useState([]);
  const [groupes, setGroupes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Exiger la connexion (les policies RLS bloquent anon)
      const sess = session ?? (await supabase.auth.getSession()).data?.session;
      if (!sess?.user) {
        navigate(`/login?next=${encodeURIComponent("/mesinscriptions")}`);
        return;
      }
      await fetchInscriptions(sess.user);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function fetchInscriptions(user) {
    setLoading(true);
    try {
      const uid = user.id;
      const uemail = user.email || "";

      /* -------------------- 1) Inscriptions "classiques" -------------------- */

      // 1a) Inscriptions où tu es le coureur
      const { data: asRunner, error: e1 } = await supabase
        .from("inscriptions")
        .select("id")
        .eq("coureur_id", uid);
      if (e1) console.warn("asRunner error:", e1?.message);

      // 1b) Inscriptions payées par toi (via paiements.inscription_ids)
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

      // 1c) Inscriptions liées à des groupes dont tu es capitaine
      const { data: groupsForIds, error: e3 } = await supabase
        .from("inscriptions_groupes")
        .select("id")
        .eq("capitaine_user_id", uid);
      if (e3) console.warn("groupsForIds error:", e3?.message);

      let groupInscr = [];
      if (groupsForIds?.length) {
        const gIds = groupsForIds.map((g) => g.id);
        const { data: d3, error: e3b } = await supabase
          .from("inscriptions")
          .select("id")
          .in("groupe_id", gIds);
        if (e3b) console.warn("groupInscr error:", e3b?.message);
        groupInscr = d3 || [];
      }

      // 1d) Inscriptions où ton email est utilisé
      let emailInscr = [];
      if (uemail) {
        const { data: d4, error: e4 } = await supabase
          .from("inscriptions")
          .select("id")
          .eq("email", uemail);
        if (e4) console.warn("emailInscr error:", e4?.message);
        emailInscr = d4 || [];
      }

      // Déduplication de tous les IDs collectés
      const ids = new Set();
      for (const r of asRunner || []) ids.add(r.id);
      for (const id of paidIds) ids.add(id);
      for (const r of groupInscr) ids.add(r.id);
      for (const r of emailInscr) ids.add(r.id);

      const finalIds = Array.from(ids);

      let rich = [];
      if (finalIds.length > 0) {
        const { data: richData, error: eRich } = await supabase
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
          console.error(
            "Erreur chargement inscriptions enrichies:",
            eRich.message
          );
          rich = [];
        } else {
          rich = richData || [];
        }
      }

      setInscriptions(rich);

      /* -------------------- 2) Groupes dont tu es capitaine -------------------- */

      const { data: grp, error: eGrp } = await supabase
        .from("inscriptions_groupes")
        .select(
          `
          id,
          format_id,
          nom_groupe,
          team_size,
          statut,
          created_at,
          team_name,
          members_count,
          category,
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
        .eq("capitaine_user_id", uid)
        .order("created_at", { ascending: false });

      if (eGrp) {
        console.error("Erreur chargement groupes:", eGrp.message);
        setGroupes([]);
      } else {
        setGroupes(grp || []);
      }
    } catch (err) {
      console.error("fetchInscriptions fatal:", err);
      setInscriptions([]);
      setGroupes([]);
    } finally {
      setLoading(false);
    }
  }

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
              <div
                key={i}
                className="animate-pulse rounded-2xl ring-1 ring-neutral-200 bg-white p-5"
              >
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

  const hasIndiv = inscriptions.length > 0;
  const hasTeams = groupes.length > 0;

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
            Inscrivez-vous. Courez. Partagez.
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        {!hasIndiv && !hasTeams ? (
          <EmptyState />
        ) : (
          <>
            {/* Inscriptions individuelles */}
            {hasIndiv && (
              <section>
                <h2 className="text-lg font-semibold mb-3">
                  Inscriptions individuelles / classiques
                </h2>
                <ul className="grid gap-5">
                  {inscriptions.map((inscription) => {
                    const { format, statut, id, groupe_id } = inscription;
                    const course = format?.course;

                    // Si cette inscription appartient à un groupe dont tu es capitaine
                    // et qu'on a déjà une carte "groupe", on peut choisir de l'afficher ou non.
                    const isGrouped = !!groupe_id;
                    const hasGroupCard = isGrouped
                      ? groupes.some((g) => g.id === groupe_id)
                      : false;

                    // Ici, on garde l'affichage même si hasGroupCard === true.
                    // Si tu veux les masquer, retourne null dans ce cas.
                    // if (hasGroupCard) return null;

                    const isTeam =
                      (format?.type_format &&
                        format.type_format !== "individuel") ||
                      !!inscription.team_name;

                    const detailUrl = isTeam && groupe_id
                      ? `/mon-inscription-equipe/${groupe_id}`
                      : `/mon-inscription/${id}`;

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
                            <h2 className="text-lg font-semibold leading-snug">
                              {format?.nom || "Format"}
                            </h2>
                            <p className="text-sm text-neutral-600">
                              {course?.nom} — {course?.lieu}
                            </p>

                            <div className="mt-1 text-sm text-neutral-700 flex flex-wrap gap-x-4 gap-y-1">
                              {format?.distance_km != null && (
                                <span>🏁 {format.distance_km} km</span>
                              )}
                              {format?.denivele_dplus != null && (
                                <span>⛰️ {format.denivele_dplus} m D+</span>
                              )}
                              {format?.date && (
                                <span>📅 {formatDate(format.date)}</span>
                              )}
                              {isTeam && (
                                <span>👥 Inscription équipe</span>
                              )}
                            </div>

                            <div className="mt-2 text-sm">
                              Statut :{" "}
                              <span className="font-medium">
                                {statut || "—"}
                              </span>
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
              </section>
            )}

            {/* Inscriptions équipe / relais (niveau groupe) */}
            {hasTeams && (
              <section>
                <h2 className="text-lg font-semibold mb-3">
                  Inscriptions équipe / relais (capitaine)
                </h2>
                <ul className="grid gap-5">
                  {groupes.map((g) => {
                    const { format, id, statut, team_name, nom_groupe, members_count, team_size } = g;
                    const course = format?.course;
                    const displayName = team_name || nom_groupe || "Équipe";
                    const count = members_count || team_size || 0;

                    const detailUrl = `/mon-inscription-equipe/${id}`;

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
                            <h2 className="text-lg font-semibold leading-snug">
                              {displayName}
                            </h2>
                            <p className="text-sm text-neutral-600">
                              {course?.nom} — {course?.lieu}
                            </p>

                            <div className="mt-1 text-sm text-neutral-700 flex flex-wrap gap-x-4 gap-y-1">
                              {format?.nom && <span>🏷️ {format.nom}</span>}
                              {format?.distance_km != null && (
                                <span>🏁 {format.distance_km} km</span>
                              )}
                              {format?.denivele_dplus != null && (
                                <span>⛰️ {format.denivele_dplus} m D+</span>
                              )}
                              {format?.date && (
                                <span>📅 {formatDate(format.date)}</span>
                              )}
                              <span>👥 {count} participant(s)</span>
                            </div>

                            <div className="mt-2 text-sm">
                              Statut :{" "}
                              <span className="font-medium">
                                {statut || "—"}
                              </span>
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
                                Gérer l’inscription équipe
                              </Link>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* Empty state */
function EmptyState() {
  return (
    <div className="rounded-2xl ring-1 ring-neutral-200 bg-white p-10 text-center">
      <h3 className="text-lg font-semibold">
        Aucune inscription pour le moment
      </h3>
      <p className="mt-1 text-neutral-600">
        Parcourez les épreuves et trouvez votre prochaine course.
      </p>
      <Link
        to="/courses"
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
      >
        Explorer les courses
      </Link>
    </div>
  );
}

// src/pages/MonInscriptionEquipe.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

/* Utils */
function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MonInscriptionEquipe() {
  const params = useParams();
  const routeId = params.groupeId || params.groupId || params.id; // compatible avec plusieurs routes
  const { session } = useUser();

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState(null);      // ligne de inscriptions_groupes
  const [members, setMembers] = useState([]);    // lignes de inscriptions
  const [format, setFormat] = useState(null);    // format lié
  const [course, setCourse] = useState(null);    // course liée
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!routeId) {
        setLoading(false);
        setError("missing-id");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // S'assure qu'on a un user (mais ProtectedRoute le fait déjà normalement)
        const user =
          session?.user ||
          (await supabase.auth.getSession()).data?.session?.user;

        if (!user) {
          setError("not-auth");
          setLoading(false);
          return;
        }

        let grp = null;
        let fmt = null;
        let crs = null;
        let groupIdForMembers = null;

        /* 1) On essaie d'abord de traiter routeId comme un id DE GROUPE */
        const { data: g, error: gErr } = await supabase
          .from("inscriptions_groupes")
          .select(
            `
            *,
            format:format_id (
              id, nom, date, distance_km, denivele_dplus, prix, prix_equipe, type_format,
              course:course_id ( id, nom, lieu, image_url )
            )
          `
          )
          .eq("id", routeId)
          .maybeSingle();

        if (!cancelled && gErr) {
          console.warn("Erreur chargement groupe (par id de groupe):", gErr);
        }

        if (g) {
          grp = g;
          fmt = g.format || null;
          crs = fmt?.course || null;
          groupIdForMembers = g.id;
        }

        /* 2) Si on n'a PAS trouvé de groupe, on considère que routeId est un id D’INSCRIPTION */
        if (!grp) {
          const { data: insc, error: inscErr } = await supabase
            .from("inscriptions")
            .select(
              `
              *,
              format:format_id (
                id, nom, date, distance_km, denivele_dplus, prix, prix_equipe, type_format,
                course:course_id ( id, nom, lieu, image_url )
              )
            `
            )
            .eq("id", routeId)
            .maybeSingle();

          if (!cancelled && inscErr) {
            console.warn("Erreur chargement inscription (fallback):", inscErr);
          }

          if (insc) {
            fmt = insc.format || null;
            crs = fmt?.course || null;

            if (insc.groupe_id) {
              // On a un groupe, on peut le charger
              const { data: g2, error: g2Err } = await supabase
                .from("inscriptions_groupes")
                .select(
                  `
                  *,
                  format:format_id (
                    id, nom, date, distance_km, denivele_dplus, prix, prix_equipe, type_format,
                    course:course_id ( id, nom, lieu, image_url )
                  )
                `
                )
                .eq("id", insc.groupe_id)
                .maybeSingle();

              if (!cancelled && g2Err) {
                console.warn(
                  "Erreur chargement groupe depuis l'inscription:",
                  g2Err
                );
              }

              if (g2) {
                grp = g2;
                fmt = g2.format || fmt;
                crs = fmt?.course || crs;
                groupIdForMembers = g2.id;
              } else {
                // Pas de groupe trouvé malgré groupe_id → on affiche au moins cette inscription
                groupIdForMembers = insc.groupe_id;
                setMembers([insc]);
              }
            } else {
              // Inscription sans groupe_id : on montre au moins cette inscription
              groupIdForMembers = null;
              setMembers([insc]);
            }
          }
        }

        // Si tout a échoué
        if (!grp && !groupIdForMembers && (!members || members.length === 0)) {
          if (!cancelled) {
            setGroup(null);
            setFormat(fmt || null);
            setCourse(crs || null);
            setMembers([]);
            setLoading(false);
          }
          return;
        }

        // On met à jour état groupe/format/course
        if (!cancelled) {
          setGroup(grp);
          setFormat(fmt || null);
          setCourse(crs || null);
        }

        /* 3) Charger tous les membres du groupe si on a un groupe_id */
        if (groupIdForMembers) {
          const { data: inscs, error: mErr } = await supabase
            .from("inscriptions")
            .select(
              `
              id, nom, prenom, genre, date_naissance,
              numero_licence, email, statut, created_at
            `
            )
            .eq("groupe_id", groupIdForMembers)
            .order("created_at", { ascending: true });

          if (!cancelled) {
            if (mErr) {
              console.error("Erreur chargement membres d'équipe:", mErr);
              // On peut garder les membres déjà éventuellement renseignés
              if (!members || members.length === 0) {
                setMembers([]);
              }
            } else {
              setMembers(inscs || []);
            }
          }
        }
      } catch (err) {
        console.error("Erreur fatale MonInscriptionEquipe:", err);
        if (!cancelled) setError("fatal");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [routeId, session]);

  /* ----------------------------- UI : loading ----------------------------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-7xl px-4 py-10">
            <div className="h-6 w-64 bg-neutral-100 rounded mb-2 animate-pulse" />
            <div className="h-4 w-80 bg-neutral-100 rounded animate-pulse" />
          </div>
        </section>
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="rounded-2xl ring-1 ring-neutral-200 bg-white p-6">
            <div className="h-5 w-1/2 bg-neutral-100 rounded mb-3 animate-pulse" />
            <div className="h-4 w-full bg-neutral-100 rounded mb-2 animate-pulse" />
            <div className="h-4 w-2/3 bg-neutral-100 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------- UI : no data ----------------------------- */
  if (!group && (!members || members.length === 0)) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-7xl px-4 py-10">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-neutral-900">
              Mon inscription équipe
            </h1>
            <p className="mt-2 text-neutral-600 text-base">
              Gestion de votre inscription en équipe / relais.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="rounded-2xl ring-1 ring-neutral-200 bg-white p-8">
            <h2 className="text-lg font-semibold mb-2">
              Aucune inscription trouvée pour ce groupe.
            </h2>
            <p className="text-sm text-neutral-700">
              Il est possible que :
            </p>
            <ul className="mt-2 list-disc list-inside text-sm text-neutral-700 space-y-1">
              <li>Vous ne soyez pas connecté avec le bon compte.</li>
              <li>
                Les règles de sécurité (RLS) empêchent l’accès à ce groupe pour
                ce compte.
              </li>
              <li>
                L’URL a été modifiée ou ne correspond pas à un groupe valide.
              </li>
            </ul>

            <div className="mt-6">
              <Link
                to="/mesinscriptions"
                className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                ← Retour à mes inscriptions
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const teamName =
    group?.team_name || group?.nom_groupe || group?.team_name_public || members?.[0]?.team_name;

  const participantsCount = members?.length || group?.members_count || group?.team_size || 0;

  /* ------------------------------- UI main ------------------------------- */
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-neutral-900">
            Mon inscription équipe
          </h1>
          <p className="mt-2 text-neutral-600 text-base">
            Gestion de votre inscription en équipe / relais.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Résumé course / format */}
        <div className="rounded-2xl ring-1 ring-neutral-200 bg-white p-6">
          <p className="text-sm text-neutral-500 mb-1">Épreuve</p>
          <h2 className="text-xl font-semibold text-neutral-900">
            {course?.nom || "Course inconnue"}
            {course?.lieu ? (
              <span className="text-neutral-600"> — {course.lieu}</span>
            ) : null}
          </h2>

          <div className="mt-2 text-sm text-neutral-700 flex flex-wrap gap-3">
            {format?.nom && (
              <span>
                <b>Format :</b> {format.nom}
              </span>
            )}
            {format?.distance_km != null && (
              <span>
                · {format.distance_km} km
              </span>
            )}
            {format?.denivele_dplus != null && (
              <span>
                · {format.denivele_dplus} m D+
              </span>
            )}
            {format?.date && (
              <span>· {formatDateTime(format.date)}</span>
            )}
            {format?.type_format && (
              <span>· {format.type_format === "relais" ? "Relais" : "Groupe"}</span>
            )}
          </div>
        </div>

        {/* Bloc infos groupe */}
        <div className="rounded-2xl ring-1 ring-neutral-200 bg-white p-6 space-y-3">
          <h3 className="text-lg font-semibold mb-2">Inscription équipe / relais</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-neutral-500 text-xs uppercase tracking-wide mb-1">
                Équipe
              </p>
              <p className="font-medium">{teamName || "—"}</p>
            </div>

            <div>
              <p className="text-neutral-500 text-xs uppercase tracking-wide mb-1">
                ID (URL)
              </p>
              <p className="font-mono text-xs break-all">{routeId}</p>
            </div>

            {group && (
              <>
                <div>
                  <p className="text-neutral-500 text-xs uppercase tracking-wide mb-1">
                    Participants
                  </p>
                  <p className="font-medium">{participantsCount}</p>
                </div>

                <div>
                  <p className="text-neutral-500 text-xs uppercase tracking-wide mb-1">
                    Inscription créée le
                  </p>
                  <p className="font-medium">
                    {formatDateTime(group.created_at)}
                  </p>
                </div>

                <div>
                  <p className="text-neutral-500 text-xs uppercase tracking-wide mb-1">
                    Statut global inscrit
                  </p>
                  <p className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                    {group.statut || "—"}
                  </p>
                </div>

                {group.team_category && (
                  <div>
                    <p className="text-neutral-500 text-xs uppercase tracking-wide mb-1">
                      Catégorie d’équipe
                    </p>
                    <p className="font-medium">{group.team_category}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Liste des membres */}
        <div className="rounded-2xl ring-1 ring-neutral-200 bg-white p-6">
          <h3 className="text-lg font-semibold mb-3">Détail des membres</h3>
          <p className="text-sm text-neutral-600 mb-4">
            Retrouvez la liste des coureurs rattachés à cette équipe.
          </p>

          {(!members || members.length === 0) ? (
            <p className="text-sm text-neutral-500">
              Aucun membre visible pour ce groupe.
              <br />
              Si vous êtes capitaine de l’équipe, vérifiez les règles RLS sur la table{" "}
              <code className="font-mono text-xs bg-neutral-100 px-1 py-0.5 rounded">
                inscriptions
              </code>{" "}
              (accès aux lignes où{" "}
              <code className="font-mono text-xs">groupe_id</code> correspond à ce
              groupe).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-600 border-b">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Nom</th>
                    <th className="py-2 pr-3">Prénom</th>
                    <th className="py-2 pr-3">Sexe</th>
                    <th className="py-2 pr-3">Date de naissance</th>
                    <th className="py-2 pr-3">N° licence / PPS</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, idx) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 w-10">{idx + 1}</td>
                      <td className="py-2 pr-3">{m.nom || "—"}</td>
                      <td className="py-2 pr-3">{m.prenom || "—"}</td>
                      <td className="py-2 pr-3">{m.genre || "—"}</td>
                      <td className="py-2 pr-3">
                        {m.date_naissance
                          ? new Date(m.date_naissance).toLocaleDateString("fr-FR")
                          : "—"}
                      </td>
                      <td className="py-2 pr-3">{m.numero_licence || "—"}</td>
                      <td className="py-2 pr-3">{m.email || "—"}</td>
                      <td className="py-2 pr-3">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-neutral-100 text-neutral-800">
                          {m.statut || "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Liens bas de page */}
        <div className="flex flex-wrap gap-3">
          {course?.id && (
            <Link
              to={`/courses/${course.id}`}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              ← Voir la page de la course
            </Link>
          )}

          <Link
            to="/mesinscriptions"
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Retour à mes inscriptions
          </Link>
        </div>
      </div>
    </div>
  );
}

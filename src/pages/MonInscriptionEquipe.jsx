// src/pages/MonInscriptionEquipe.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

/* ----- Helpers ----- */
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

function Pill({ children, color = "neutral" }) {
  const map = {
    neutral: "bg-neutral-100 text-neutral-800 ring-neutral-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    orange: "bg-orange-50 text-orange-700 ring-orange-200",
    red: "bg-rose-50 text-rose-700 ring-rose-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${map[color]}`}
    >
      {children}
    </span>
  );
}

export default function MonInscriptionEquipe() {
  const { groupeId } = useParams(); // <-- IMPORTANT : doit matcher la route
  const { session } = useUser();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState(null);
  const [inscriptions, setInscriptions] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    (async () => {
      // Vérif session (comme MesInscriptions / MonInscription)
      const sess =
        session ?? (await supabase.auth.getSession()).data?.session;
      if (!sess?.user) {
        navigate(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      if (!groupeId || groupeId === "undefined") {
        setErrorMsg("Identifiant de groupe invalide.");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // 1) Charger la ligne de groupe
        const { data: groupRow, error: eGroup } = await supabase
          .from("inscriptions_groupes")
          .select(
            `
            id,
            format_id,
            course_id,
            equipe_nom,
            team_name,
            nom,
            capitaine_user_id,
            statut_global,
            statut,
            created_at,
            format:format_id (
              id,
              nom,
              date,
              distance_km,
              denivele_dplus,
              prix,
              prix_equipe,
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
          .eq("id", groupeId)
          .maybeSingle();

        if (eGroup) {
          console.error("Erreur chargement groupe :", eGroup.message);
        }

        if (!groupRow) {
          setGroup(null);
          setInscriptions([]);
          setLoading(false);
          return;
        }

        setGroup(groupRow);

        // 2) Charger toutes les inscriptions rattachées à ce groupe
        const { data: members, error: eIns } = await supabase
          .from("inscriptions")
          .select(
            `
            id,
            nom,
            prenom,
            genre,
            date_naissance,
            email,
            numero_licence,
            statut,
            groupe_id
          `
          )
          .eq("groupe_id", groupeId)
          .order("created_at", { ascending: true });

        if (eIns) {
          console.error("Erreur chargement inscriptions groupe :", eIns.message);
        }

        setInscriptions(members || []);
      } catch (err) {
        console.error("MonInscriptionEquipe fatal:", err);
        setErrorMsg("Erreur lors du chargement de l'inscription d'équipe.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupeId, session]);

  const course = group?.format?.course || null;
  const format = group?.format || null;

  const teamName =
    group?.equipe_nom ||
    group?.team_name ||
    group?.nom ||
    (inscriptions[0]?.nom ? `Équipe ${inscriptions[0].nom}` : "Équipe");

  const statutGlobal =
    group?.statut_global || group?.statut || inscriptions[0]?.statut || "—";

  const participantsCount = inscriptions.length;

  const statutColor = useMemo(() => {
    const s = (statutGlobal || "").toLowerCase();
    if (s.includes("valid") || s.includes("pay")) return "green";
    if (s.includes("attent")) return "orange";
    if (s.includes("annul")) return "red";
    return "neutral";
  }, [statutGlobal]);

  /* --------------------------- Rendering --------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="h-6 w-64 bg-neutral-100 rounded mb-2 animate-pulse" />
            <div className="h-4 w-80 bg-neutral-100 rounded animate-pulse" />
          </div>
        </section>
        <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
          <div className="h-40 bg-white rounded-2xl ring-1 ring-neutral-200 animate-pulse" />
          <div className="h-40 bg-white rounded-2xl ring-1 ring-neutral-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!group || inscriptions.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-5xl px-4 py-8">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900">
              Mon inscription équipe
            </h1>
            <p className="mt-2 text-neutral-600 text-sm">
              Gestion de votre inscription en équipe / relais.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-2xl bg-white ring-1 ring-neutral-200 p-6">
            <h2 className="text-lg font-semibold mb-2">
              Aucune inscription trouvée pour ce groupe.
            </h2>
            <p className="text-sm text-neutral-600">
              Il est possible que :
            </p>
            <ul className="mt-2 text-sm text-neutral-600 list-disc list-inside space-y-1">
              <li>Vous ne soyez pas connecté avec le bon compte.</li>
              <li>
                Les règles de sécurité (RLS) empêchent l’accès à ce groupe pour
                ce compte.
              </li>
              <li>
                L’URL a été modifiée ou ne correspond pas à un groupe valide.
              </li>
            </ul>
            {errorMsg && (
              <p className="mt-3 text-sm text-red-600">{errorMsg}</p>
            )}

            <div className="mt-6">
              <Link
                to="/mesinscriptions"
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              >
                ← Retour à mes inscriptions
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-5xl px-4 py-8 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900">
                Mon inscription équipe{" "}
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                Gestion de votre inscription en équipe / relais.
              </p>
            </div>
            <Pill color={statutColor}>{statutGlobal}</Pill>
          </div>
          {course && (
            <p className="text-sm text-neutral-700">
              <span className="font-semibold">
                {course.nom} — {course.lieu}
              </span>
            </p>
          )}
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Carte résumé course/format */}
        <div className="rounded-2xl bg-white ring-1 ring-neutral-200 overflow-hidden">
          <div className="flex flex-col md:flex-row">
            <div className="md:w-48 flex-shrink-0 bg-neutral-100">
              {course?.image_url ? (
                <img
                  src={course.image_url}
                  alt={course.nom}
                  className="h-40 md:h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-40 md:h-full w-full grid place-items-center text-xs text-neutral-400">
                  Pas d’image
                </div>
              )}
            </div>
            <div className="flex-1 p-4 space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {course?.nom || "Course"}
                </span>
                {format?.type_format && (
                  <Pill color="blue">
                    {format.type_format === "relais"
                      ? "Relais"
                      : format.type_format === "groupe"
                      ? "Groupe"
                      : "Individuel"}
                  </Pill>
                )}
              </div>
              {course?.lieu && (
                <p className="text-neutral-600">Lieu : {course.lieu}</p>
              )}
              {format && (
                <p className="text-neutral-700">
                  Format :{" "}
                  <span className="font-medium">
                    {format.nom || "Format"}
                  </span>{" "}
                  · {format.distance_km} km / {format.denivele_dplus} m D+ ·{" "}
                  {format.date
                    ? new Date(format.date).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })
                    : "Date non renseignée"}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
                <span>
                  <b>Équipe :</b> {teamName}
                </span>
                <span>
                  <b>ID (URL) :</b> {groupeId}
                </span>
                <span>
                  <b>Participants :</b> {participantsCount}
                </span>
                {group?.created_at && (
                  <span>
                    <b>Inscription créée le </b>
                    {formatDateTime(group.created_at)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Détail des membres */}
        <section className="rounded-2xl bg-white ring-1 ring-neutral-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold">Détail des membres</h2>
              <p className="text-sm text-neutral-600">
                Retrouvez la liste des coureurs rattachés à cette équipe.
              </p>
            </div>
          </div>

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
                {inscriptions.map((m, idx) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 w-10">{idx + 1}</td>
                    <td className="py-2 pr-3">{m.nom || "—"}</td>
                    <td className="py-2 pr-3">{m.prenom || "—"}</td>
                    <td className="py-2 pr-3">{m.genre || "—"}</td>
                    <td className="py-2 pr-3">
                      {m.date_naissance
                        ? new Date(m.date_naissance).toLocaleDateString(
                            "fr-FR",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            }
                          )
                        : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {m.numero_licence || "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {m.email || "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <Pill
                        color={
                          (m.statut || "").toLowerCase().includes("pay") ||
                          (m.statut || "").toLowerCase().includes("valid")
                            ? "green"
                            : (m.statut || "")
                                .toLowerCase()
                                .includes("annul")
                            ? "red"
                            : "neutral"
                        }
                      >
                        {m.statut || "—"}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Liens de navigation */}
        <div className="flex flex-wrap gap-3">
          {course && (
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

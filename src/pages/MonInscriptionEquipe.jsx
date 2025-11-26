// src/pages/MonInscriptionEquipe.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

const formatDate = (d) =>
  d
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(typeof d === "string" ? new Date(d) : d)
    : "";

const formatDateTime = (d) =>
  d
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(typeof d === "string" ? new Date(d) : d)
    : "";

export default function MonInscriptionEquipe() {
  const { groupId } = useParams();
  const { session } = useUser();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      if (!groupId) {
        setError("URL invalide : aucun identifiant de groupe n’a été fourni dans l’URL.");
        setLoading(false);
        return;
      }

      const sess =
        session ?? (await supabase.auth.getSession()).data?.session;
      if (!sess?.user) {
        navigate(`/login?next=${encodeURIComponent(`/mon-inscription-equipe/${groupId}`)}`);
        return;
      }

      await fetchGroupAndMembers(groupId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, session]);

  async function fetchGroupAndMembers(id) {
    setLoading(true);
    setError("");
    try {
      // 1) Récupérer le groupe + format + course
      const { data: grp, error: gErr } = await supabase
        .from("inscriptions_groupes")
        .select(
          `
          *,
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
        .eq("id", id)
        .maybeSingle();

      if (gErr) {
        console.error("Erreur chargement groupe:", gErr);
        setError("Erreur lors du chargement de l’inscription d’équipe.");
        setLoading(false);
        return;
      }
      if (!grp) {
        setError("Aucune inscription trouvée pour ce groupe.");
        setLoading(false);
        return;
      }

      setGroup(grp);

      // 2) Récupérer les membres liés à ce groupe :
      //    - soit via groupe_id
      //    - soit via member_of_group_id (cas actuel dans ta BDD)
      const { data: memb, error: mErr } = await supabase
        .from("inscriptions")
        .select(
          `
          id,
          nom,
          prenom,
          genre,
          date_naissance,
          numero_licence,
          email,
          statut,
          member_of_group_id,
          groupe_id
        `
        )
        .or(
          `groupe_id.eq.${id},member_of_group_id.eq.${id}`
        )
        .eq("format_id", grp.format_id);

      if (mErr) {
        console.error("Erreur chargement membres groupe:", mErr);
        setMembers([]);
      } else {
        setMembers(memb || []);
      }
    } catch (e) {
      console.error("fetchGroupAndMembers fatal:", e);
      setError("Erreur inattendue lors du chargement de l’inscription d’équipe.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-4">
            <div className="h-4 w-40 bg-neutral-200 rounded animate-pulse mb-2" />
            <div className="h-7 w-72 bg-neutral-200 rounded animate-pulse" />
          </div>
          <div className="space-y-4">
            <div className="h-32 bg-neutral-200 rounded-2xl animate-pulse" />
            <div className="h-40 bg-neutral-200 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
          <Link
            to="/mesinscriptions"
            className="inline-flex items-center text-sm text-neutral-600 hover:text-neutral-900"
          >
            ← Retour à mes inscriptions
          </Link>
          <div className="rounded-2xl bg-white ring-1 ring-red-100 p-6">
            <h1 className="text-2xl font-bold mb-2">Mon inscription équipe</h1>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
          <Link
            to="/mesinscriptions"
            className="inline-flex items-center text-sm text-neutral-600 hover:text-neutral-900"
          >
            ← Retour à mes inscriptions
          </Link>
          <div className="rounded-2xl bg-white ring-1 ring-neutral-200 p-6">
            <h1 className="text-2xl font-bold mb-2">Mon inscription équipe</h1>
            <p className="text-sm text-neutral-700">
              Aucune inscription trouvée pour ce groupe.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { format } = group;
  const course = format?.course;
  const isCaptain =
    group.capitaine_user_id === session?.user?.id;

  const categoryLabel =
    group.category === "masculine"
      ? "Équipe masculine"
      : group.category === "feminine"
      ? "Équipe féminine"
      : group.category === "mixte"
      ? "Équipe mixte"
      : null;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <Link
          to="/mesinscriptions"
          className="inline-flex items-center text-sm text-neutral-600 hover:text-neutral-900"
        >
          ← Retour à mes inscriptions
        </Link>

        {/* Header */}
        <header className="rounded-2xl bg-white ring-1 ring-neutral-200 p-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">
            Mon inscription équipe
          </h1>
          <p className="text-sm text-neutral-600">
            Gestion de votre inscription en équipe / relais.
          </p>
        </header>

        {/* Bloc principal */}
        <section className="rounded-2xl bg-white ring-1 ring-neutral-200 p-6 space-y-4">
          {/* Course / format */}
          {course && (
            <div className="mb-3">
              <h2 className="text-lg font-semibold">
                {course.nom} — {course.lieu}
              </h2>
              {format && (
                <p className="text-sm text-neutral-700">
                  {format.nom} · {format.distance_km} km / {format.denivele_dplus} m D+
                </p>
              )}
            </div>
          )}

          {format?.date && (
            <p className="text-sm text-neutral-700">
              Inscription équipe / relais • {formatDate(format.date)}
            </p>
          )}

          {/* Infos groupe */}
          <div className="grid sm:grid-cols-2 gap-4 mt-3">
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium">Équipe</span>{" "}
                <span className="ml-1">{group.team_name || group.nom_groupe}</span>
              </div>
              <div>
                <span className="font-medium">ID (URL)</span>
                <div className="mt-0.5 text-xs break-all text-neutral-600">
                  {group.id}
                </div>
              </div>
              <div>
                <span className="font-medium">Participants</span>{" "}
                <span className="ml-1">
                  {group.members_count ?? group.team_size} / {group.team_size}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-sm">
              {categoryLabel && (
                <div>
                  <span className="font-medium">Catégorie</span>{" "}
                  <span className="ml-1">{categoryLabel}</span>
                </div>
              )}
              <div>
                <span className="font-medium">Statut global inscrit</span>{" "}
                <span className="ml-1">{group.statut || "—"}</span>
              </div>
              <div>
                <span className="font-medium">Inscription créée le</span>{" "}
                <span className="ml-1">
                  {formatDateTime(group.created_at)}
                </span>
              </div>
              {group.updated_at && (
                <div>
                  <span className="font-medium">Dernière mise à jour</span>{" "}
                  <span className="ml-1">
                    {formatDateTime(group.updated_at)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {isCaptain && (
            <p className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 inline-block">
              Vous êtes le capitaine de cette équipe.
            </p>
          )}
        </section>

        {/* Détail des membres */}
        <section className="rounded-2xl bg-white ring-1 ring-neutral-200 p-6 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-lg font-semibold">Détail des membres</h2>
              <p className="text-sm text-neutral-600">
                Retrouvez la liste des coureurs rattachés à cette équipe.
              </p>
            </div>
          </div>

          {members.length === 0 ? (
            <p className="text-sm text-neutral-600">
              Aucun membre visible pour ce groupe. Les règles RLS peuvent limiter l’accès
              à certains coureurs.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-neutral-600">
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
                    <tr key={m.id} className="border-b border-neutral-100">
                      <td className="py-2 pr-3">{idx + 1}</td>
                      <td className="py-2 pr-3">{m.nom || "—"}</td>
                      <td className="py-2 pr-3">{m.prenom || "—"}</td>
                      <td className="py-2 pr-3">{m.genre || "—"}</td>
                      <td className="py-2 pr-3">
                        {m.date_naissance
                          ? formatDate(m.date_naissance)
                          : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {m.numero_licence || "—"}
                      </td>
                      <td className="py-2 pr-3">
                          {m.email || "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-neutral-100 text-neutral-800">
                          {m.statut || "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Liens bas de page */}
        <div className="flex flex-wrap gap-3 justify-between items-center">
          {course && (
            <Link
              to={`/courses/${course.id}`}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              ← Voir la page de la course
            </Link>
          )}
          <Link
            to="/mesinscriptions"
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Retour à mes inscriptions
          </Link>
        </div>
      </div>
    </div>
  );
}

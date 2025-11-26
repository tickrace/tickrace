// src/pages/MonInscriptionEquipe.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

const formatDate = (d, withTime = false) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    ...(withTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
  }).format(date);
};

export default function MonInscriptionEquipe() {
  const { session } = useUser();
  const params = useParams();

  // ⚠️ On accepte plusieurs noms de params pour être à l'abri :
  // /mon-inscription-equipe/:groupeId
  // /mon-inscription-equipe/:groupId
  // /mon-inscription-equipe/:id
  const groupId =
    params.groupeId || params.groupId || params.id || params.gid || null;

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      // Vérif session (ProtectedRoute devrait déjà gérer, mais on sécurise)
      const sess = session ?? (await supabase.auth.getSession()).data?.session;
      if (!sess?.user) {
        setError(
          "Vous devez être connecté pour accéder au détail de cette inscription."
        );
        setLoading(false);
        return;
      }

      if (!groupId) {
        setError("URL invalide : aucun identifiant de groupe n’a été fourni dans l’URL.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        // 1) Charger le groupe
        const { data: grp, error: grpErr } = await supabase
          .from("inscriptions_groupes")
          .select(
            `
            id,
            format_id,
            nom_groupe,
            team_size,
            capitaine_user_id,
            statut,
            paiement_id,
            created_at,
            updated_at,
            team_category,
            team_name_public,
            members_count,
            team_name,
            category,
            format:format_id(
              id,
              nom,
              distance_km,
              denivele_dplus,
              date,
              type_format,
              prix,
              prix_equipe,
              course:course_id(
                id,
                nom,
                lieu,
                image_url
              )
            )
          `
          )
          .eq("id", groupId)
          .maybeSingle();

        if (grpErr) {
          console.error("Erreur chargement groupe:", grpErr);
          setError("Erreur lors du chargement du groupe.");
          setLoading(false);
          return;
        }
        if (!grp) {
          setError(
            "Aucune inscription trouvée pour ce groupe.\n\nIl est possible que :\n- Vous ne soyez pas connecté avec le bon compte.\n- Les règles de sécurité (RLS) empêchent l’accès à ce groupe pour ce compte.\n- L’URL ne corresponde pas à un groupe valide."
          );
          setLoading(false);
          return;
        }

        setGroup(grp);

        // 2) Charger les membres liés
        // On gère les deux schémas : member_of_group_id (nouveau) et groupe_id (ancien)
        const { data: mems, error: memErr } = await supabase
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
            created_at,
            member_of_group_id,
            groupe_id,
            team_name
          `
          )
          .or(
            `member_of_group_id.eq.${groupId},groupe_id.eq.${groupId}`
          )
          .order("created_at", { ascending: true });

        if (memErr) {
          console.error("Erreur chargement membres:", memErr);
          // On n'arrête pas l'affichage du groupe pour autant
          setMembers([]);
        } else {
          setMembers(mems || []);
        }
      } catch (err) {
        console.error("MonInscriptionEquipe fatal:", err);
        setError("Une erreur inattendue est survenue.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, session]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link
            to="/mesinscriptions"
            className="inline-flex items-center text-sm text-neutral-600 hover:text-neutral-900 mb-4"
          >
            ← Retour à mes inscriptions
          </Link>
          <div className="h-6 w-64 bg-neutral-200 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            <div className="h-4 w-2/3 bg-neutral-200 rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-neutral-200 rounded animate-pulse" />
            <div className="h-4 w-1/3 bg-neutral-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Erreur globale (URL ou autre)
  if (error && !group) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link
            to="/mesinscriptions"
            className="inline-flex items-center text-sm text-neutral-600 hover:text-neutral-900 mb-4"
          >
            ← Retour à mes inscriptions
          </Link>
          <h1 className="text-2xl font-bold mb-3">Mon inscription équipe</h1>
          <div className="rounded-2xl bg-white ring-1 ring-red-200 p-5 whitespace-pre-line">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const format = group?.format;
  const course = format?.course;
  const createdAt = group?.created_at ? new Date(group.created_at) : null;
  const updatedAt = group?.updated_at ? new Date(group.updated_at) : null;

  const categoryLabel =
    group?.category === "masculine"
      ? "Équipe masculine"
      : group?.category === "feminine"
      ? "Équipe féminine"
      : group?.category === "mixte"
      ? "Équipe mixte"
      : null;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link
          to="/mesinscriptions"
          className="inline-flex items-center text-sm text-neutral-600 hover:text-neutral-900 mb-4"
        >
          ← Retour à mes inscriptions
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold mb-2">
          Mon inscription équipe
        </h1>

        {course && (
          <p className="text-sm text-neutral-600 mb-4">
            {course.nom} — {course.lieu}
          </p>
        )}

        {/* Carte principale */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-6">
          <section className="rounded-2xl bg-white ring-1 ring-neutral-200 p-5 space-y-4">
            {/* En-tête format */}
            {format && (
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">
                  {format.nom}{" "}
                  {format.type_format &&
                    format.type_format !== "individuel" &&
                    "· inscription équipe / relais"}
                </h2>
                <p className="text-sm text-neutral-600">
                  {format.distance_km != null && `${format.distance_km} km`}{" "}
                  {format.denivele_dplus != null && (
                    <>· {format.denivele_dplus} m D+</>
                  )}
                </p>
                {format.date && (
                  <p className="text-sm text-neutral-600">
                    Épreuve le {formatDate(format.date)}
                  </p>
                )}
              </div>
            )}

            {/* Infos groupe */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-neutral-100">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Équipe</span>
                  <span className="font-medium">
                    {group?.team_name || group?.nom_groupe || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">ID (URL)</span>
                  <span className="font-mono text-xs bg-neutral-100 px-2 py-0.5 rounded">
                    {group?.id}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Participants</span>
                  <span className="font-medium">
                    {group?.members_count ?? group?.team_size ?? 0} /{" "}
                    {group?.team_size ?? "?"}
                  </span>
                </div>
                {categoryLabel && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Catégorie</span>
                    <span className="font-medium">{categoryLabel}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Statut global inscrit</span>
                  <span className="font-medium">{group?.statut || "—"}</span>
                </div>
                {createdAt && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Inscription créée le</span>
                    <span className="font-medium">
                      {formatDate(createdAt, true)}
                    </span>
                  </div>
                )}
                {updatedAt && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Dernière mise à jour</span>
                    <span className="font-medium">
                      {formatDate(updatedAt, true)}
                    </span>
                  </div>
                )}
                {/* On ne peut pas toujours savoir côté client si tu es capitaine
                    mais on garde l'info si RLS renvoie bien capitaine_user_id */}
                <div className="flex justify-between">
                  <span className="text-neutral-600">Capitaine</span>
                  <span className="text-xs font-medium bg-neutral-100 px-2 py-0.5 rounded">
                    {group?.capitaine_user_id
                      ? "Vous êtes le capitaine de cette équipe"
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Carte secondaire : lien course / actions */}
          <aside className="rounded-2xl bg-white ring-1 ring-neutral-200 p-5 space-y-3 h-fit">
            {course && (
              <>
                {course.image_url && (
                  <img
                    src={course.image_url}
                    alt={course.nom}
                    className="w-full h-40 object-cover rounded-xl mb-3"
                  />
                )}
                <h3 className="text-sm font-semibold mb-1">
                  Course associée
                </h3>
                <p className="text-sm text-neutral-600 mb-3">
                  {course.nom} — {course.lieu}
                </p>
              </>
            )}

            <Link
              to={`/courses/${course?.id ?? ""}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              ← Voir la page de la course
            </Link>
            <Link
              to="/mesinscriptions"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              Retour à mes inscriptions
            </Link>
          </aside>
        </div>

        {/* Liste des membres */}
        <section className="mt-8 rounded-2xl bg-white ring-1 ring-neutral-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Détail des membres</h2>
              <p className="text-sm text-neutral-600">
                Retrouvez la liste des coureurs rattachés à cette équipe.
              </p>
            </div>
          </div>

          {members.length === 0 ? (
            <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4 text-sm text-neutral-700">
              Aucun membre visible pour ce groupe.
              <br />
              <span className="text-xs text-neutral-500">
                Si vous venez de finaliser l’inscription, essayez de rafraîchir
                la page. Les règles RLS peuvent aussi limiter l’accès à certains
                coureurs.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
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
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-neutral-100 text-neutral-800">
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
      </div>
    </div>
  );
}

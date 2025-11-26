// src/pages/MonInscriptionEquipe.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

/* Utils */
function formatDate(d) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateTime(d) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function MonInscriptionEquipe() {
  const params = useParams();
  // On accepte plusieurs noms de param pour éviter les bugs de route
  const groupeId =
    params.groupeId || params.groupe_id || params.id || "";

  const { session } = useUser();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [optionsByInscription, setOptionsByInscription] = useState({});

  useEffect(() => {
    (async () => {
      if (!groupeId) {
        setError("URL invalide : aucun identifiant de groupe n’a été fourni dans l’URL.");
        setLoading(false);
        return;
      }

      const sess = session ?? (await supabase.auth.getSession()).data?.session;
      if (!sess?.user) {
        setError("Vous devez être connecté pour accéder à cette page.");
        setLoading(false);
        return;
      }
      const user = sess.user;

      setLoading(true);
      setError("");

      // 1) Charger le groupe + format + course
      const { data: grp, error: eGrp } = await supabase
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
        .eq("id", groupeId)
        .maybeSingle();

      if (eGrp) {
        console.error("Erreur chargement groupe:", eGrp);
        setError("Erreur lors du chargement du groupe.");
        setLoading(false);
        return;
      }

      if (!grp) {
        setError("Aucune inscription trouvée pour ce groupe.");
        setLoading(false);
        return;
      }

      // (optionnel) vérification côté client que l'utilisateur a un lien avec le groupe
      // La vraie sécurité reste gérée par les policies RLS.
      const isCaptain = grp.capitaine_user_id === user.id;

      // 2) Charger les inscriptions membres du groupe
      const { data: membs, error: eM } = await supabase
        .from("inscriptions")
        .select("*")
        .eq("groupe_id", groupeId)
        .order("created_at", { ascending: true });

      if (eM) {
        console.error("Erreur chargement membres:", eM);
      }

      const safeMembers = membs || [];

      // 3) Charger les options liées aux inscriptions de ce groupe
      let optsMap = {};
      if (safeMembers.length > 0) {
        const ids = safeMembers.map((m) => m.id);
        const { data: opts, error: eO } = await supabase
          .from("inscriptions_options")
          .select(
            `
            *,
            option:option_id (
              id,
              label,
              description
            )
          `
          )
          .in("inscription_id", ids);

        if (eO) {
          console.error("Erreur chargement options:", eO);
        } else {
          (opts || []).forEach((row) => {
            if (!optsMap[row.inscription_id]) {
              optsMap[row.inscription_id] = [];
            }
            optsMap[row.inscription_id].push(row);
          });
        }
      }

      setGroup({ ...grp, isCaptain });
      setMembers(safeMembers);
      setOptionsByInscription(optsMap);
      setLoading(false);
    })();
  }, [groupeId, session]);

  const participantsCount = useMemo(
    () => members.length || group?.members_count || 0,
    [members.length, group?.members_count]
  );

  const displayTeamName = useMemo(() => {
    if (!group) return "";
    return (
      group.team_name_public ||
      group.team_name ||
      group.nom_groupe ||
      "Équipe"
    );
  }, [group]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="h-6 w-48 bg-neutral-100 rounded mb-2" />
            <div className="h-4 w-80 bg-neutral-100 rounded" />
          </div>
        </section>
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="rounded-2xl ring-1 ring-neutral-200 bg-white p-6">
            <div className="h-4 w-1/2 bg-neutral-100 rounded mb-2" />
            <div className="h-4 w-1/3 bg-neutral-100 rounded mb-2" />
            <div className="h-4 w-2/3 bg-neutral-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-5xl px-4 py-8">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Mon inscription équipe
            </h1>
            <p className="mt-2 text-neutral-600">
              Gestion de votre inscription en équipe / relais.
            </p>
          </div>
        </section>
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="rounded-2xl ring-1 ring-rose-200 bg-white p-6">
            <p className="text-rose-700 font-medium mb-2">{error}</p>
            <ul className="text-sm text-neutral-700 list-disc ml-5 space-y-1">
              <li>Vous ne soyez pas connecté avec le bon compte.</li>
              <li>Les règles de sécurité (RLS) empêchent l’accès à ce groupe.</li>
              <li>L’URL a été modifiée ou ne correspond pas à un groupe valide.</li>
            </ul>
            <div className="mt-4 flex gap-3">
              <Link
                to="/mesinscriptions"
                className="inline-flex items-center rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
              >
                ← Retour à mes inscriptions
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const format = group?.format;
  const course = format?.course;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <p className="text-sm text-neutral-500 mb-1">
            <Link
              to="/mesinscriptions"
              className="hover:text-neutral-900 inline-flex items-center gap-1"
            >
              ← Retour à mes inscriptions
            </Link>
          </p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Mon inscription équipe
          </h1>
          <p className="mt-2 text-neutral-600">
            {course?.nom} — {course?.lieu}
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Bloc résumé équipe */}
        <div className="rounded-2xl ring-1 ring-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold mb-2">
            {format?.nom || "Format"}{" "}
            {format?.distance_km != null && (
              <> · {format.distance_km} km</>
            )}{" "}
            {format?.denivele_dplus != null && (
              <> / {format.denivele_dplus} m D+</>
            )}
          </h2>

          <p className="text-sm text-neutral-700 mb-4">
            Inscription équipe / relais •{" "}
            {format?.date ? formatDate(format.date) : ""}
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-600">Équipe</span>
                <span className="font-semibold">{displayTeamName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">ID (URL)</span>
                <code className="text-xs bg-neutral-100 px-2 py-1 rounded-lg">
                  {group.id}
                </code>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Participants</span>
                <span className="font-semibold">
                  {participantsCount} / {group.team_size}
                </span>
              </div>
              {group.team_category && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">Catégorie</span>
                  <span className="font-semibold">
                    {group.team_category === "male"
                      ? "Équipe masculine"
                      : group.team_category === "female"
                      ? "Équipe féminine"
                      : "Équipe mixte"}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-neutral-600">Statut global inscrit</span>
                <span className="font-semibold">{group.statut}</span>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-600">Inscription créée le</span>
                <span className="font-semibold">
                  {formatDateTime(group.created_at)}
                </span>
              </div>
              {group.updated_at && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">Dernière mise à jour</span>
                  <span className="font-semibold">
                    {formatDateTime(group.updated_at)}
                  </span>
                </div>
              )}
              {group.isCaptain && (
                <div className="mt-2 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Vous êtes le capitaine de cette équipe
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Liste des membres */}
        <div className="rounded-2xl ring-1 ring-neutral-200 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">
                Détail des membres
              </h2>
              <p className="text-sm text-neutral-600">
                Retrouvez la liste des coureurs rattachés à cette équipe.
              </p>
            </div>
          </div>

          {members.length === 0 ? (
            <p className="text-sm text-neutral-600">
              Aucun membre visible pour ce groupe. Les règles RLS peuvent limiter
              l’accès à certains coureurs.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
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
                    <th className="py-2 pr-3">Options</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, idx) => {
                    const opts = optionsByInscription[m.id] || [];
                    return (
                      <tr key={m.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-3 align-top">{idx + 1}</td>
                        <td className="py-2 pr-3 align-top">{m.nom || "—"}</td>
                        <td className="py-2 pr-3 align-top">{m.prenom || "—"}</td>
                        <td className="py-2 pr-3 align-top">{m.genre || "—"}</td>
                        <td className="py-2 pr-3 align-top">
                          {m.date_naissance
                            ? formatDate(m.date_naissance)
                            : "—"}
                        </td>
                        <td className="py-2 pr-3 align-top">
                          {m.numero_licence || "—"}
                        </td>
                        <td className="py-2 pr-3 align-top">
                          {m.email || "—"}
                        </td>
                        <td className="py-2 pr-3 align-top">
                          <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-800">
                            {m.statut || "—"}
                          </span>
                        </td>
                        <td className="py-2 pr-3 align-top">
                          {opts.length === 0 ? (
                            <span className="text-xs text-neutral-400">—</span>
                          ) : (
                            <ul className="text-xs text-neutral-800 space-y-1">
                              {opts.map((o) => (
                                <li key={o.id}>
                                  {o.option?.label || "Option"} × {o.quantity}{" "}
                                  {(o.prix_unitaire_cents / 100).toFixed(2)} €
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Actions */}
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
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            Retour à mes inscriptions
          </Link>
        </div>
      </div>
    </div>
  );
}

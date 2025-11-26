// src/pages/MonInscriptionEquipe.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

/* ------------------------------ Helpers UI ------------------------------ */

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

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

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

/* ------------------------------ Composant ------------------------------ */

export default function MonInscriptionEquipe() {
  const { groupeId: paramGroupeId, id: paramId } = useParams();
  const groupeId = paramGroupeId || paramId; // tolérant aux deux routes
  const { session } = useUser();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [groupe, setGroupe] = useState(null);
  const [membres, setMembres] = useState([]);
  const [error, setError] = useState("");

  // Vérifier connexion + charger les données
  useEffect(() => {
    (async () => {
      // Auth
      const sess =
        session ?? (await supabase.auth.getSession()).data?.session;
      if (!sess?.user) {
        navigate(
          `/login?next=${encodeURIComponent(
            `/mon-inscription-equipe/${groupeId}`
          )}`
        );
        return;
      }

      if (!groupeId) {
        setError("Identifiant de groupe manquant.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        // 1) Charger la ligne de groupe avec format + course
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
          setError("Impossible de charger ce groupe.");
          setLoading(false);
          return;
        }
        if (!grp) {
          setError("Aucune inscription trouvée pour ce groupe.");
          setLoading(false);
          return;
        }

        setGroupe(grp);

        // 2) Charger TOUTES les inscriptions liées à ce groupe
        //   ⚠️ NE PAS filtrer sur coureur_id or email ici, on laisse RLS décider
        const { data: ins, error: eIns } = await supabase
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
            created_at
          `
          )
          .eq("groupe_id", groupeId)
          .order("created_at", { ascending: true });

        if (eIns) {
          console.error("Erreur chargement membres groupe:", eIns);
          setMembres([]);
        } else {
          setMembres(ins || []);
        }
      } catch (err) {
        console.error("Erreur fatale MonInscriptionEquipe:", err);
        setError("Une erreur est survenue lors du chargement.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupeId, session]);

  const participantsCount = membres.length;

  const course = groupe?.format?.course;
  const format = groupe?.format;

  const statutGlobalPill = useMemo(() => {
    const statut = (groupe?.statut_global || groupe?.statut || "").toLowerCase();
    let color =
      "bg-neutral-100 text-neutral-800 ring-neutral-200";
    let label = groupe?.statut_global || groupe?.statut || "—";

    if (statut.includes("pay")) {
      color = "bg-emerald-50 text-emerald-700 ring-emerald-200";
      label = "payé";
    } else if (statut.includes("attent")) {
      color = "bg-amber-50 text-amber-700 ring-amber-200";
      label = "en attente";
    } else if (statut.includes("annul")) {
      color = "bg-rose-50 text-rose-700 ring-rose-200";
      label = "annulé";
    }

    return (
      <span
        className={cls(
          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
          color
        )}
      >
        Statut global : {label}
      </span>
    );
  }, [groupe]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="h-6 w-64 bg-neutral-100 rounded mb-2 animate-pulse" />
            <div className="h-4 w-80 bg-neutral-100 rounded animate-pulse" />
          </div>
        </section>
        <main className="mx-auto max-w-5xl px-4 py-8">
          <div className="h-40 rounded-2xl bg-white ring-1 ring-neutral-200 animate-pulse" />
        </main>
      </div>
    );
  }

  if (error || !groupe) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-5xl px-4 py-8">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Mon inscription équipe
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Gestion de votre inscription en équipe / relais.
            </p>
          </div>
        </section>
        <main className="mx-auto max-w-3xl px-4 py-8">
          <div className="rounded-2xl bg-white ring-1 ring-rose-200 p-6">
            <h2 className="text-lg font-semibold text-rose-900 mb-2">
              Aucune inscription trouvée pour ce groupe.
            </h2>
            <p className="text-sm text-neutral-700 mb-2">
              Il est possible que :
            </p>
            <ul className="list-disc list-inside text-sm text-neutral-700 space-y-1 mb-4">
              <li>Vous ne soyez pas connecté avec le bon compte.</li>
              <li>
                Les règles de sécurité (RLS) empêchent l’accès à ce groupe pour
                ce compte.
              </li>
              <li>
                L’URL a été modifiée ou ne correspond pas à un groupe valide.
              </li>
            </ul>
            <Link
              to="/mesinscriptions"
              className="inline-flex items-center rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              ← Retour à mes inscriptions
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-5xl px-4 py-8 space-y-2">
          <Link
            to="/mesinscriptions"
            className="inline-flex items-center text-sm text-neutral-500 hover:text-neutral-800"
          >
            ← Retour à mes inscriptions
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Mon inscription équipe
          </h1>
          {course && (
            <p className="text-sm text-neutral-700">
              {course.nom} — {course.lieu}
            </p>
          )}
          {format && (
            <p className="text-sm text-neutral-700">
              Format : {format.nom} · {format.distance_km} km /{" "}
              {format.denivele_dplus} m D+ ·{" "}
              {format.date ? formatDate(format.date) : "date à venir"}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-800 ring-1 ring-neutral-200">
              Inscription équipe / relais
            </span>
            {statutGlobalPill}
          </div>
        </div>
      </section>

      {/* Contenu */}
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Carte récap équipe */}
        <section className="rounded-2xl bg-white ring-1 ring-neutral-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Résumé de l’équipe</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-neutral-500">Équipe</dt>
              <dd className="font-medium">
                {groupe.team_name || groupe.nom_equipe || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">ID (URL)</dt>
              <dd className="font-mono text-xs break-all">
                {groupe.id || groupeId}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Nom d'équipe</dt>
              <dd className="font-medium">
                {groupe.team_name || groupe.nom_equipe || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Participants</dt>
              <dd className="font-medium">
                {participantsCount}
                {groupe.team_size
                  ? ` / ${groupe.team_size} prévu(s)`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Inscription créée le</dt>
              <dd className="font-medium">
                {formatDateTime(groupe.created_at)}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Statut global inscrit</dt>
              <dd className="font-medium">
                {groupe.statut_global || groupe.statut || "—"}
              </dd>
            </div>
          </dl>
        </section>

        {/* Liste des membres */}
        <section className="rounded-2xl bg-white ring-1 ring-neutral-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Détail des membres</h2>
            <p className="text-xs text-neutral-500">
              Retrouvez la liste des coureurs rattachés à cette équipe.
            </p>
          </div>

          {membres.length === 0 ? (
            <p className="text-sm text-neutral-600">
              Aucun coureur n’est encore rattaché à ce groupe.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-neutral-600">
                    <th className="py-2 pr-3 w-10">#</th>
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
                  {membres.map((m, idx) => (
                    <tr key={m.id} className="border-b last:border-0">
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
                        <span
                          className={cls(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
                            (() => {
                              const s = (m.statut || "").toLowerCase();
                              if (s.includes("pay")) {
                                return "bg-emerald-50 text-emerald-700 ring-emerald-200";
                              }
                              if (s.includes("attent")) {
                                return "bg-amber-50 text-amber-700 ring-amber-200";
                              }
                              if (s.includes("annul")) {
                                return "bg-rose-50 text-rose-700 ring-rose-200";
                              }
                              return "bg-neutral-100 text-neutral-800 ring-neutral-200";
                            })()
                          )}
                        >
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

        {/* Lien retour course */}
        <div className="flex items-center justify-between">
          {course && (
            <Link
              to={`/courses/${course.id}`}
              className="inline-flex items-center rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              ← Voir la page de la course
            </Link>
          )}
          <Link
            to="/mesinscriptions"
            className="inline-flex items-center rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Retour à mes inscriptions
          </Link>
        </div>
      </main>
    </div>
  );
}

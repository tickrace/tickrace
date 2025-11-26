// src/pages/MonInscriptionEquipe.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

/* ------------------------ UI helpers ------------------------ */

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

function formatDate(d) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(d) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ------------------------ Page principale ------------------------ */

export default function MonInscriptionEquipe() {
  const { groupId } = useParams(); // 👈 route: /mon-inscription-equipe/:groupId
  const navigate = useNavigate();
  const { session } = useUser();

  const [loading, setLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);

  const [groupRow, setGroupRow] = useState(null);       // ligne dans inscriptions_groupes
  const [members, setMembers] = useState([]);           // lignes dans inscriptions
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function run() {
      if (!groupId) {
        setError("URL invalide : aucun identifiant de groupe fourni.");
        setLoading(false);
        return;
      }

      // Vérification session
      let sess = session;
      if (!sess) {
        const { data } = await supabase.auth.getSession();
        sess = data?.session || null;
      }
      setSessionChecked(true);

      if (!sess?.user) {
        navigate(`/login?next=${encodeURIComponent(`/mon-inscription-equipe/${groupId}`)}`);
        return;
      }

      setLoading(true);
      setError(null);

      try {
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
          .eq("id", groupId)
          .maybeSingle();

        if (eGrp) {
          console.error("Erreur chargement groupe:", eGrp);
          if (!ignore) {
            setError("Impossible de charger ce groupe.");
            setGroupRow(null);
            setMembers([]);
            setLoading(false);
          }
          return;
        }

        if (!grp) {
          if (!ignore) {
            setError("Aucune inscription trouvée pour ce groupe.");
            setGroupRow(null);
            setMembers([]);
            setLoading(false);
          }
          return;
        }

        // 2) Charger les membres (inscriptions liées au groupe)
        const { data: inscs, error: eIns } = await supabase
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
            created_at
          `
          )
          .eq("groupe_id", groupId)
          .order("created_at", { ascending: true });

        if (eIns) {
          console.error("Erreur chargement membres:", eIns);
          if (!ignore) {
            setError("Impossible de charger les membres de cette équipe.");
            setGroupRow(grp);
            setMembers([]);
            setLoading(false);
          }
          return;
        }

        if (!ignore) {
          setGroupRow(grp);
          setMembers(inscs || []);
          setLoading(false);
        }
      } catch (err) {
        console.error("Erreur fatale MonInscriptionEquipe:", err);
        if (!ignore) {
          setError("Erreur inattendue lors du chargement de l’inscription d’équipe.");
          setGroupRow(null);
          setMembers([]);
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      ignore = true;
    };
  }, [groupId, session, navigate]);

  const course = groupRow?.format?.course || null;
  const format = groupRow?.format || null;

  const participantsCount = useMemo(() => members.length || 0, [members]);

  const statutColor = (s) => {
    if (!s) return "neutral";
    const x = s.toLowerCase();
    if (x === "paye" || x === "validé" || x === "valide") return "green";
    if (x === "en attente" || x === "pending") return "orange";
    if (x === "annule" || x === "annulé" || x === "refunded") return "red";
    return "neutral";
  };

  /* ------------------------ Rendu ------------------------ */

  if (!groupId) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <main className="mx-auto max-w-3xl px-4 py-10">
          <h1 className="text-2xl font-bold mb-2">Mon inscription équipe</h1>
          <p className="text-sm text-red-600 mb-4">
            URL invalide : aucun identifiant de groupe n’a été fourni dans l’URL.
          </p>
          <Link
            to="/mesinscriptions"
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            ← Retour à mes inscriptions
          </Link>
        </main>
      </div>
    );
  }

  if (loading && !sessionChecked) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <main className="mx-auto max-w-4xl px-4 py-10">
          <div className="h-6 w-40 bg-neutral-200 rounded animate-pulse mb-3" />
          <div className="h-4 w-56 bg-neutral-200 rounded animate-pulse mb-6" />
          <div className="h-40 w-full bg-neutral-100 rounded-2xl animate-pulse" />
        </main>
      </div>
    );
  }

  if (!groupRow) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <main className="mx-auto max-w-3xl px-4 py-10">
          <h1 className="text-2xl font-bold mb-2">Mon inscription équipe</h1>
          <p className="text-sm text-neutral-600 mb-2">
            Gestion de votre inscription en équipe / relais.
          </p>
          <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-white p-6">
            <p className="font-medium mb-1">Aucune inscription trouvée pour ce groupe.</p>
            <p className="text-sm text-neutral-600">
              Il est possible que :
            </p>
            <ul className="mt-2 text-sm text-neutral-600 list-disc list-inside space-y-1">
              <li>Vous ne soyez pas connecté avec le bon compte.</li>
              <li>Les règles de sécurité (RLS) empêchent l’accès à ce groupe pour ce compte.</li>
              <li>L’URL ait été modifiée ou ne corresponde pas à un groupe valide.</li>
            </ul>
          </div>

          <div className="mt-6">
            <Link
              to="/mesinscriptions"
              className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
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
        <div className="mx-auto max-w-5xl px-4 py-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Mon inscription équipe
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Gestion de votre inscription en équipe / relais.
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-2">
            <Link
              to="/mesinscriptions"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              ← Retour à mes inscriptions
            </Link>
          </div>
        </div>
      </section>

      {/* Contenu */}
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        {/* Carte course + format + groupe */}
        <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col md:flex-row">
            {/* Image course */}
            <div className="md:w-56 flex-shrink-0 bg-neutral-100">
              {course?.image_url ? (
                <img
                  src={course.image_url}
                  alt={course?.nom || "Course"}
                  className="h-40 md:h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-40 md:h-full w-full grid place-items-center text-sm text-neutral-400">
                  Pas d’image
                </div>
              )}
            </div>

            <div className="flex-1 p-5 space-y-3">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-500">
                    {course?.nom || "Course"}
                  </p>
                  <h2 className="text-lg sm:text-xl font-bold">
                    {course?.nom || "Course"}{" "}
                    {course?.lieu ? (
                      <span className="text-sm font-medium text-neutral-600">
                        — {course.lieu}
                      </span>
                    ) : null}
                  </h2>
                </div>
                {groupRow.statut && (
                  <Pill color={statutColor(groupRow.statut)}>
                    Statut global : {groupRow.statut}
                  </Pill>
                )}
              </div>

              {format && (
                <div className="text-sm text-neutral-700 space-y-1">
                  <div>
                    <span className="font-semibold">
                      Format : {format.nom || "—"}
                    </span>{" "}
                    {format.type_format && (
                      <span className="text-neutral-600">
                        · {format.type_format === "relais" ? "Relais" : format.type_format}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {format.distance_km != null && (
                      <span>🏁 {format.distance_km} km</span>
                    )}
                    {format.denivele_dplus != null && (
                      <span>⛰️ {format.denivele_dplus} m D+</span>
                    )}
                    {format.date && (
                      <span>📅 {formatDate(format.date)}</span>
                    )}
                  </div>
                </div>
              )}

              <div className="h-px bg-neutral-200 my-1" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-neutral-500">
                    Équipe
                  </p>
                  <p className="text-base font-semibold">
                    {groupRow.team_name || groupRow.nom_groupe || "Équipe"}
                  </p>
                  <p className="text-sm text-neutral-600">
                    ID (URL) :{" "}
                    <span className="font-mono text-xs break-all">
                      {groupRow.id}
                    </span>
                  </p>
                  <p className="text-sm text-neutral-600">
                    Nom d&apos;équipe public :{" "}
                    <span className="font-medium">
                      {groupRow.team_name_public || groupRow.team_name || groupRow.nom_groupe || "—"}
                    </span>
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-neutral-500">
                    Détails équipe
                  </p>
                  <p className="text-sm text-neutral-700">
                    Participants :{" "}
                    <span className="font-semibold">{participantsCount}</span>
                    {groupRow.team_size
                      ? ` / ${groupRow.team_size}`
                      : ""}
                  </p>
                  {groupRow.team_category && (
                    <p className="text-sm text-neutral-700">
                      Catégorie :{" "}
                      <span className="font-medium">
                        {groupRow.team_category === "male" ||
                        groupRow.team_category === "masculine"
                          ? "Équipe masculine"
                          : groupRow.team_category === "female" ||
                            groupRow.team_category === "feminine"
                          ? "Équipe féminine"
                          : groupRow.team_category === "mixte"
                          ? "Équipe mixte"
                          : groupRow.team_category}
                      </span>
                    </p>
                  )}
                  <p className="text-sm text-neutral-600">
                    Inscription créée le{" "}
                    <span className="font-medium">
                      {formatDateTime(groupRow.created_at)}
                    </span>
                  </p>
                  {groupRow.updated_at && (
                    <p className="text-xs text-neutral-500">
                      Dernière mise à jour : {formatDateTime(groupRow.updated_at)}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-2">
                {course && (
                  <Link
                    to={`/courses/${course.id}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-neutral-50"
                  >
                    ← Voir la page de la course
                  </Link>
                )}
                <Link
                  to="/mesinscriptions"
                  className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
                >
                  Retour à mes inscriptions
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Tableau des membres */}
        <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="p-5 border-b border-neutral-100 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Détail des membres</h3>
              <p className="text-sm text-neutral-600">
                Retrouvez la liste des coureurs rattachés à cette équipe.
              </p>
            </div>
            <Pill color="blue">
              {participantsCount} participant{participantsCount > 1 ? "s" : ""}
            </Pill>
          </div>

          <div className="p-5 overflow-x-auto">
            {members.length === 0 ? (
              <p className="text-sm text-neutral-600">
                Aucun membre visible pour cette équipe avec votre compte.  
                Cela peut venir des règles de sécurité (RLS) sur les inscriptions.
              </p>
            ) : (
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
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, idx) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">{idx + 1}</td>
                      <td className="py-2 pr-3">{m.nom || "—"}</td>
                      <td className="py-2 pr-3">{m.prenom || "—"}</td>
                      <td className="py-2 pr-3">{m.genre || "—"}</td>
                      <td className="py-2 pr-3">
                        {m.date_naissance ? formatDate(m.date_naissance) : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {m.numero_licence || "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {m.email || <span className="text-neutral-400">—</span>}
                      </td>
                      <td className="py-2 pr-3">
                        <Pill color={statutColor(m.statut)}>
                          {m.statut || "—"}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* (Plus tard : bloc remboursement équipe si tu ajoutes une Edge Function dédiée) */}
      </main>
    </div>
  );
}

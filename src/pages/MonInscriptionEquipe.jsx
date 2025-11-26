// src/pages/MonInscriptionEquipe.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

/* ---------- Utils ---------- */
function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Pill({ children, color = "neutral" }) {
  const map = {
    neutral: "bg-neutral-100 text-neutral-800 ring-neutral-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    orange: "bg-amber-50 text-amber-700 ring-amber-200",
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
  const params = useParams();
  // Supporte /mon-inscription-equipe/:groupId ET /mon-inscription-equipe/:id
  const groupId = params.groupId || params.id;
  const navigate = useNavigate();

  const [sessionChecked, setSessionChecked] = useState(false);
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [groupRow, setGroupRow] = useState(null);
  const [members, setMembers] = useState([]);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!groupId) {
      setLoadError("missing_id");
      setLoading(false);
      return;
    }

    (async () => {
      // 1) Vérifier la session
      const { data } = await supabase.auth.getSession();
      const sessUser = data?.session?.user || null;

      if (!sessUser) {
        navigate(
          `/login?next=${encodeURIComponent(`/mon-inscription-equipe/${groupId}`)}`
        );
        return;
      }

      setUser(sessUser);
      setSessionChecked(true);

      // 2) Charger le groupe + format + course
      try {
        setLoading(true);

        const { data: grp, error: grpErr } = await supabase
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

        if (grpErr) {
          console.error("Erreur chargement groupe:", grpErr);
          setLoadError("group_error");
          setLoading(false);
          return;
        }

        if (!grp) {
          setLoadError("group_not_found");
          setLoading(false);
          return;
        }

        setGroupRow(grp);

        // 3) Charger tous les membres de ce groupe
        const { data: membs, error: memErr } = await supabase
          .from("inscriptions")
          .select("*")
          .eq("groupe_id", groupId)
          .order("created_at", { ascending: true });

        if (memErr) {
          console.error("Erreur chargement membres:", memErr);
          setLoadError("members_error");
          setMembers([]);
          setLoading(false);
          return;
        }

        setMembers(membs || []);
        setLoading(false);
      } catch (err) {
        console.error("Erreur fatale MonInscriptionEquipe:", err);
        setLoadError("fatal");
        setLoading(false);
      }
    })();
  }, [groupId, navigate]);

  /* ---------- States de chargement ---------- */

  if (!groupId) {
    return (
      <PageShell>
        <ErrorBlock
          title="URL invalide"
          description="Aucun identifiant de groupe n’a été fourni dans l’URL."
        />
      </PageShell>
    );
  }

  if (!sessionChecked && loading) {
    return (
      <PageShell>
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="h-7 w-64 bg-neutral-200 rounded animate-pulse mb-4" />
          <div className="h-4 w-80 bg-neutral-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-neutral-200 rounded animate-pulse" />
        </div>
      </PageShell>
    );
  }

  if (loading) {
    return (
      <PageShell>
        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="h-7 w-80 bg-neutral-200 rounded animate-pulse mb-6" />
          <div className="space-y-4">
            <div className="h-24 bg-neutral-100 rounded-2xl animate-pulse" />
            <div className="h-40 bg-neutral-100 rounded-2xl animate-pulse" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (
    loadError === "group_not_found" ||
    loadError === "group_error" ||
    loadError === "members_error" ||
    !groupRow
  ) {
    return (
      <PageShell>
        <ErrorBlock
          title="Aucune inscription trouvée pour ce groupe."
          description={
            <>
              <p className="mb-2">
                Il est possible que :
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700">
                <li>Vous ne soyez pas connecté avec le bon compte.</li>
                <li>
                  Les règles de sécurité (RLS) empêchent l’accès à ce groupe pour ce compte.
                </li>
                <li>L’URL a été modifiée ou ne correspond pas à un groupe valide.</li>
              </ul>
            </>
          }
        />
      </PageShell>
    );
  }

  // À ce stade, on a bien un groupe et (normalement) ses membres
  const format = groupRow.format;
  const course = format?.course;
  const teamName =
    groupRow.team_name_public ||
    groupRow.team_name ||
    groupRow.nom_groupe ||
    "Équipe";
  const participantsCount = members.length || groupRow.members_count || 0;

  let statutColor = "neutral";
  if (groupRow.statut === "paye" || groupRow.statut === "validé") statutColor = "green";
  else if (groupRow.statut === "en attente") statutColor = "orange";
  else if (groupRow.statut === "annule" || groupRow.statut === "annulé")
    statutColor = "red";

  return (
    <PageShell>
      {/* Header */}
      <section className="bg-white border-b border-neutral-200">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <p className="text-sm text-neutral-500 mb-1">
            <Link to="/mesinscriptions" className="hover:text-neutral-800">
              ← Retour à mes inscriptions
            </Link>
          </p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900">
            Mon inscription équipe
          </h1>
          <p className="mt-1 text-neutral-600">
            Gestion de votre inscription en équipe / relais.
          </p>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Carte principale */}
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col md:flex-row">
            {/* Couverture */}
            <div className="md:w-60 bg-neutral-100 flex-shrink-0">
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

            {/* Corps */}
            <div className="flex-1 p-4 sm:p-6 space-y-3">
              {course && (
                <div className="text-sm text-neutral-600">
                  <div className="font-semibold text-neutral-900">
                    {course.nom}
                  </div>
                  <div>{course.lieu}</div>
                </div>
              )}

              {format && (
                <div className="text-sm text-neutral-700 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      Format : {format.nom}
                    </span>
                    {format.type_format && (
                      <Pill color="blue">
                        {format.type_format === "relais"
                          ? "Relais"
                          : format.type_format === "groupe"
                          ? "Groupe"
                          : "Individuel"}
                      </Pill>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-neutral-700">
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

              <div className="h-px bg-neutral-200 my-2" />

              {/* Infos groupe */}
              <div className="space-y-1 text-sm text-neutral-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">Inscription équipe / relais</span>
                  <Pill color={statutColor}>
                    Statut global : {groupRow.statut || "—"}
                  </Pill>
                </div>
                <div>
                  Équipe : <span className="font-medium">{teamName}</span>
                </div>
                <div className="text-xs text-neutral-500">
                  ID (URL) : <code className="rounded bg-neutral-100 px-1 py-0.5">{groupId}</code>
                </div>
                <div>
                  Participants :{" "}
                  <span className="font-medium">{participantsCount}</span>
                </div>
                <div>
                  Inscription créée le{" "}
                  <span className="font-medium">
                    {formatDateTime(groupRow.created_at)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tableau des membres */}
        <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Détail des membres</h2>
              <p className="text-sm text-neutral-500">
                Retrouvez la liste des coureurs rattachés à cette équipe.
              </p>
            </div>
          </div>

          {members.length === 0 ? (
            <div className="p-5 text-sm text-neutral-600">
              Aucun membre trouvé pour ce groupe.
            </div>
          ) : (
            <div className="p-5 overflow-x-auto">
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
                    <tr key={m.id || idx} className="border-b last:border-0">
                      <td className="py-2 pr-3">{idx + 1}</td>
                      <td className="py-2 pr-3">{m.nom || "—"}</td>
                      <td className="py-2 pr-3">{m.prenom || "—"}</td>
                      <td className="py-2 pr-3">{m.genre || "—"}</td>
                      <td className="py-2 pr-3">
                        {m.date_naissance ? formatDate(m.date_naissance) : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {m.numero_licence || m.pps_identifier || "—"}
                      </td>
                      <td className="py-2 pr-3">{m.email || "—"}</td>
                      <td className="py-2 pr-3">
                        <Pill
                          color={
                            m.statut === "paye" || m.statut === "validé"
                              ? "green"
                              : m.statut === "en attente"
                              ? "orange"
                              : m.statut === "annule" || m.statut === "annulé"
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
          )}
        </section>

        <div className="flex items-center justify-between pt-2">
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
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Retour à mes inscriptions
          </Link>
        </div>
      </main>
    </PageShell>
  );
}

/* ---------- Shell & erreur ---------- */

function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {children}
    </div>
  );
}

function ErrorBlock({ title, description }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-8">
        <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 mb-3">
          {title}
        </h1>
        <div className="text-sm text-neutral-700 mb-4">{description}</div>
        <Link
          to="/mesinscriptions"
          className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
        >
          ← Retour à mes inscriptions
        </Link>
      </div>
    </div>
  );
}

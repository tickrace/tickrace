// src/pages/MonInscriptionEquipe.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabase";

/* ------------------------------ Utils ------------------------------ */

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

/* --------------------------- Main component ------------------------ */

export default function MonInscriptionEquipe() {
  const params = useParams();
  // 🔑 On accepte les deux variantes de route :
  // - /mon-inscription-equipe/:id
  // - /mon-inscription-equipe/groupe/:groupeId
  const groupeId = params.groupeId || params.id || null;

  const [loading, setLoading] = useState(true);
  const [groupRow, setGroupRow] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!groupeId) {
      setLoading(false);
      setError("URL invalide : aucun identifiant de groupe n’a été fourni dans l’URL.");
      return;
    }

    let aborted = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        // 1) On récupère la ligne du groupe + format + course
        const { data: g, error: e1 } = await supabase
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

        if (aborted) return;

        if (e1) {
          console.error("❌ Error loading group:", e1);
          setError("Erreur lors du chargement du groupe.");
          setGroupRow(null);
          setMembers([]);
          setLoading(false);
          return;
        }

        if (!g) {
          setGroupRow(null);
          setMembers([]);
          setLoading(false);
          return;
        }

        setGroupRow(g);

        // 2) On récupère toutes les inscriptions liées à ce groupe
        const { data: insc, error: e2 } = await supabase
          .from("inscriptions")
          .select("*")
          .eq("groupe_id", groupeId)
          .order("created_at", { ascending: true });

        if (aborted) return;

        if (e2) {
          console.error("❌ Error loading members:", e2);
          setError("Erreur lors du chargement des membres de l’équipe.");
          setMembers([]);
        } else {
          setMembers(insc || []);
        }

        setLoading(false);
      } catch (err) {
        if (aborted) return;
        console.error("❌ Fatal error MonInscriptionEquipe:", err);
        setError("Une erreur inattendue est survenue.");
        setGroupRow(null);
        setMembers([]);
        setLoading(false);
      }
    }

    load();
    return () => {
      aborted = true;
    };
  }, [groupeId]);

  /* ------------------------------ UI ------------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-4xl px-4 py-8">
            <div className="h-6 w-64 bg-neutral-100 rounded animate-pulse mb-2" />
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

  if (!groupeId) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-4xl px-4 py-8">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Mon inscription équipe
            </h1>
            <p className="mt-2 text-sm text-red-600">
              URL invalide : aucun identifiant de groupe n’a été fourni dans l’URL.
            </p>
          </div>
        </section>
        <div className="mx-auto max-w-4xl px-4 py-8">
          <Link
            to="/mesinscriptions"
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            ← Retour à mes inscriptions
          </Link>
        </div>
      </div>
    );
  }

  if (!groupRow) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-4xl px-4 py-8">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Mon inscription équipe
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              Gestion de votre inscription en équipe / relais.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          )}
          <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-6 space-y-2">
            <p className="text-sm font-semibold">
              Aucune inscription trouvée pour ce groupe.
            </p>
            <ul className="mt-1 text-sm text-neutral-600 list-disc list-inside space-y-1">
              <li>Vous ne soyez pas connecté avec le bon compte.</li>
              <li>
                Les règles de sécurité (RLS) empêchent l’accès à ce groupe pour ce compte.
              </li>
              <li>L’URL a été modifiée ou ne correspond pas à un groupe valide.</li>
            </ul>
          </div>

          <Link
            to="/mesinscriptions"
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            ← Retour à mes inscriptions
          </Link>
        </div>
      </div>
    );
  }

  const { format } = groupRow;
  const course = format?.course;
  const membersCount = members.length || groupRow.members_count || groupRow.team_size || 0;

  let categoryLabel = "—";
  if (groupRow.team_category || groupRow.category) {
    const c = (groupRow.team_category || groupRow.category || "").toLowerCase();
    if (c === "masculine" || c === "male") categoryLabel = "Équipe masculine";
    else if (c === "feminine" || c === "female") categoryLabel = "Équipe féminine";
    else if (c === "mixte") categoryLabel = "Équipe mixte";
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Mon inscription équipe
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Gestion de votre inscription en équipe / relais.
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        {/* Course / format card */}
        <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
          {course?.image_url && (
            <div className="h-40 w-full overflow-hidden">
              <img
                src={course.image_url}
                alt={course?.nom || "Course"}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}
          <div className="p-5 space-y-2">
            <h2 className="text-lg font-semibold">
              {course?.nom || "Course inconnue"}{" "}
              {course?.lieu && <span className="text-neutral-500">— {course.lieu}</span>}
            </h2>
            {format && (
              <p className="text-sm text-neutral-700">
                Format :{" "}
                <span className="font-medium">
                  {format.nom || format.type_format || "Format équipe"}
                </span>{" "}
                {format.distance_km != null && (
                  <>· {format.distance_km} km</>
                )}{" "}
                {format.denivele_dplus != null && (
                  <> / {format.denivele_dplus} m D+</>
                )}{" "}
                {format.date && (
                  <> · {new Date(format.date).toLocaleDateString("fr-FR")}</>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Group summary */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Inscription équipe / relais</h3>
              <p className="text-sm text-neutral-600">
                Équipe :{" "}
                <span className="font-medium">
                  {groupRow.team_name_public || groupRow.team_name || groupRow.nom_groupe || "—"}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill color="blue">ID (URL) : {groupeId}</Pill>
              {categoryLabel !== "—" && <Pill color="neutral">{categoryLabel}</Pill>}
              {groupRow.statut && (
                <Pill color={groupRow.statut === "paye" || groupRow.statut === "validé" ? "green" : "orange"}>
                  Statut global : {groupRow.statut}
                </Pill>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-neutral-700">
            <div className="flex justify-between">
              <span>Nom d&apos;équipe :</span>
              <span className="font-medium">
                {groupRow.team_name_public || groupRow.team_name || groupRow.nom_groupe || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Participants :</span>
              <span className="font-medium">{membersCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Taille prévue :</span>
              <span className="font-medium">{groupRow.team_size || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span>Inscription créée le</span>
              <span className="font-medium">
                {formatDateTime(groupRow.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Members table */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold">Détail des membres</h3>
            <p className="text-xs text-neutral-500">
              Retrouvez la liste des coureurs rattachés à cette équipe.
            </p>
          </div>

          {members.length === 0 ? (
            <p className="text-sm text-neutral-600">
              Aucun coureur n’est encore rattaché à ce groupe.
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
                      <td className="py-2 pr-3">{idx + 1}</td>
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
                        <Pill
                          color={
                            m.statut === "paye" || m.statut === "validé"
                              ? "green"
                              : m.statut === "annulé"
                              ? "red"
                              : "orange"
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
        </div>

        {/* Footer links */}
        <div className="flex flex-wrap gap-3">
          {course?.id && (
            <Link
              to={`/courses/${course.id}`}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              ← Voir la page de la course
            </Link>
          )}
          <Link
            to="/mesinscriptions"
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            Retour à mes inscriptions
          </Link>
        </div>
      </div>
    </div>
  );
}

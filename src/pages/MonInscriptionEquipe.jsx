// src/pages/MonInscriptionEquipe.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

/* ---------- Helpers UI simples ---------- */
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
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MonInscriptionEquipe() {
  const params = useParams();
  const navigate = useNavigate();

  // On accepte les deux variantes de route : :groupeId ou :id
  const groupId = params.groupeId || params.id;

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Si pas de groupId dans l’URL, on ne fait pas de requête foireuse
    if (!groupId) {
      setLoading(false);
      setError("Identifiant de groupe manquant dans l’URL.");
      return;
    }

    let abort = false;

    async function fetchGroup() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("inscriptions")
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
        .eq("groupe_id", groupId)
        .order("created_at", { ascending: true });

      if (abort) return;

      if (error) {
        console.error("❌ erreur chargement groupe:", error);
        setError(error.message || "Erreur lors du chargement de l'équipe.");
        setRows([]);
      } else {
        setRows(data || []);
      }

      setLoading(false);
    }

    fetchGroup();

    return () => {
      abort = true;
    };
  }, [groupId]);

  const mainInscription = rows[0] || null;
  const format = mainInscription?.format || null;
  const course = format?.course || null;

  const stats = useMemo(() => {
    if (!rows.length) return null;
    const byStatut = rows.reduce((acc, r) => {
      const s = r.statut || "inconnu";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    return {
      total: rows.length,
      byStatut,
    };
  }, [rows]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="h-6 w-64 bg-neutral-100 rounded mb-2 animate-pulse" />
            <div className="h-4 w-80 bg-neutral-100 rounded animate-pulse" />
          </div>
        </section>
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="h-40 bg-white rounded-2xl shadow-sm ring-1 ring-neutral-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-5xl px-4 py-8">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-sm text-neutral-500 hover:text-neutral-800"
            >
              ← Retour
            </button>
            <h1 className="mt-3 text-2xl font-bold">
              Mon inscription en équipe
            </h1>
            <p className="mt-1 text-sm text-red-600">{error}</p>
          </div>
        </section>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-5xl px-4 py-8">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-sm text-neutral-500 hover:text-neutral-800"
            >
              ← Retour
            </button>
            <h1 className="mt-3 text-2xl font-bold">
              Mon inscription en équipe
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Aucune inscription trouvée pour ce groupe.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <button
                type="button"
                onClick={() => navigate("/mesinscriptions")}
                className="text-sm text-neutral-500 hover:text-neutral-800"
              >
                ← Retour à mes inscriptions
              </button>
              <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">
                Mon inscription en équipe
              </h1>
              {course && (
                <p className="mt-1 text-sm text-neutral-600">
                  {course.nom} — {course.lieu}
                </p>
              )}
              {format && (
                <p className="mt-1 text-sm text-neutral-600">
                  Format {format.nom} • {format.distance_km} km /{" "}
                  {format.denivele_dplus} m D+ • {formatDate(format.date)}
                </p>
              )}
            </div>
            {course?.id && (
              <Link
                to={`/courses/${course.id}`}
                className="hidden sm:inline-flex items-center rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-900 hover:bg-neutral-50"
              >
                Voir la page course
              </Link>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Pill color="blue">ID groupe : {groupId}</Pill>
            {stats && (
              <>
                <Pill color="green">
                  {stats.total} participant
                  {stats.total > 1 ? "s" : ""}
                </Pill>
                {Object.entries(stats.byStatut).map(([s, n]) => (
                  <Pill key={s} color={s === "validé" ? "green" : "orange"}>
                    {s} : {n}
                  </Pill>
                ))}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Contenu */}
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Rappel : politique d’annulation / info équipe */}
        <section className="rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200 p-5">
          <h2 className="text-lg font-semibold mb-2">
            Politique d’annulation (équipes)
          </h2>
          <p className="text-sm text-neutral-700 mb-2">
            Cette page est dédiée aux inscriptions en équipe (groupe / relais).
            Les règles d’annulation peuvent être différentes de l’inscription
            individuelle et sont définies par l’organisateur de l’épreuve.
          </p>
          <ul className="list-disc pl-5 text-sm text-neutral-700 space-y-1">
            <li>
              L’annulation porte généralement sur l’ensemble de l’équipe,
              sauf mention contraire de l’organisation.
            </li>
            <li>
              Des frais ou pourcentages spécifiques peuvent s’appliquer en
              fonction de la date par rapport à la course.
            </li>
            <li>
              En cas de doute, merci de contacter directement l’organisateur
              via la page de la course.
            </li>
          </ul>
        </section>

        {/* Tableau des membres */}
        <section className="rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Membres de l’équipe</h2>
            {/* Ici plus tard : actions de gestion de l’équipe / demande de remboursement groupe */}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-600 border-b">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Nom</th>
                  <th className="py-2 pr-3">Prénom</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-3">Créée le</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{idx + 1}</td>
                    <td className="py-2 pr-3">{r.nom || "—"}</td>
                    <td className="py-2 pr-3">{r.prenom || "—"}</td>
                    <td className="py-2 pr-3">{r.email || "—"}</td>
                    <td className="py-2 pr-3">
                      <Pill
                        color={
                          r.statut === "validé"
                            ? "green"
                            : r.statut === "en attente"
                            ? "orange"
                            : r.statut === "annulé"
                            ? "red"
                            : "neutral"
                        }
                      >
                        {r.statut || "—"}
                      </Pill>
                    </td>
                    <td className="py-2 pr-3">
                      {formatDate(r.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Placeholder pour future fonction de remboursement équipe */}
        <section className="rounded-2xl bg-white shadow-sm ring-1 ring-dashed ring-neutral-300 p-5">
          <h2 className="text-lg font-semibold mb-2">
            Remboursement / annulation d’équipe
          </h2>
          <p className="text-sm text-neutral-700">
            La gestion spécifique du remboursement pour les équipes (nouvelle
            Edge Function) sera branchée ici. Pour l’instant, si vous devez
            annuler une équipe complète, merci de contacter l’organisateur
            via ses coordonnées sur la page de la course.
          </p>
        </section>
      </main>
    </div>
  );
}

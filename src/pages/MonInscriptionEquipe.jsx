// src/pages/MonInscriptionEquipe.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

/* Utils */
function formatDate(d) {
  if (!d) return "";
  const dd = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dd);
}

function formatPrice(eur) {
  const n = Number(eur || 0);
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function MonInscriptionEquipe() {
  const params = useParams();
  const navigate = useNavigate();

  // On accepte plusieurs noms possibles pour le paramètre, pour être robuste
  const groupeId =
    params.groupeId || params.groupId || params.groupe_id || params.id;

  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState("");
  const [inscriptions, setInscriptions] = useState([]);
  const [format, setFormat] = useState(null);
  const [course, setCourse] = useState(null);

  useEffect(() => {
    (async () => {
      if (!groupeId) {
        setLoading(false);
        setLoadingError("Identifiant de groupe manquant dans l’URL.");
        return;
      }

      try {
        setLoading(true);
        setLoadingError("");

        // Vérifier que l'utilisateur est connecté (policies RLS)
        const { data: sess } = await supabase.auth.getSession();
        if (!sess?.session?.user) {
          navigate(
            `/login?next=${encodeURIComponent(
              `/mon-inscription-equipe/${groupeId}`
            )}`
          );
          return;
        }

        // 1) Récupérer toutes les inscriptions appartenant à ce groupe
        const { data: rows, error } = await supabase
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
            ),
            inscriptions_options (
              id,
              option_id,
              quantity,
              prix_unitaire_cents,
              status
            )
          `
          )
          .eq("groupe_id", groupeId)
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Erreur chargement inscriptions de groupe:", error);
          setLoadingError("Erreur lors du chargement des inscriptions.");
          setInscriptions([]);
          setFormat(null);
          setCourse(null);
        } else {
          const list = rows || [];
          setInscriptions(list);

          // Si on a au moins une inscription, on récupère le format / course
          if (list.length > 0) {
            const f = list[0].format || null;
            const c = f?.course || null;
            setFormat(f);
            setCourse(c);
          } else {
            setFormat(null);
            setCourse(null);
          }
        }
      } catch (err) {
        console.error("MonInscriptionEquipe fatal error:", err);
        setLoadingError("Erreur inattendue lors du chargement de l’équipe.");
        setInscriptions([]);
        setFormat(null);
        setCourse(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [groupeId, navigate]);

  const teamName = useMemo(() => {
    if (!inscriptions.length) return "Équipe";
    // On essaie différentes colonnes possibles
    const i0 = inscriptions[0];
    return (
      i0.team_name ||
      i0.nom_equipe ||
      i0.groupe_nom ||
      `Équipe (${groupeId.slice(0, 8)}…)`
    );
  }, [inscriptions, groupeId]);

  const totalParticipants = inscriptions.length;

  const totalInscriptionEur = useMemo(() => {
    if (!format) return 0;
    // Approche simple : prix unitaire * nb de membres + éventuel prix_equipe
    const prixUnitaire = Number(format.prix || 0);
    const feeEquipe = Number(format.prix_equipe || 0);
    return prixUnitaire * totalParticipants + feeEquipe;
  }, [format, totalParticipants]);

  const totalOptionsEur = useMemo(() => {
    if (!inscriptions?.length) return 0;
    let cents = 0;
    for (const ins of inscriptions) {
      const opts = ins.inscriptions_options || [];
      for (const o of opts) {
        if (o.status !== "validé" && o.status !== "paid" && o.status !== "pending")
          continue;
        cents += Number(o.prix_unitaire_cents || 0) * Number(o.quantity || 0);
      }
    }
    return cents / 100;
  }, [inscriptions]);

  /* ---------------------------- STATES UI ---------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-7xl px-4 py-8">
            <div className="h-6 w-48 bg-neutral-100 rounded mb-2 animate-pulse" />
            <div className="h-4 w-80 bg-neutral-100 rounded animate-pulse" />
          </div>
        </section>
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl ring-1 ring-neutral-200 bg-white p-4 animate-pulse"
              >
                <div className="h-5 w-1/3 bg-neutral-100 rounded mb-2" />
                <div className="h-4 w-1/2 bg-neutral-100 rounded mb-1" />
                <div className="h-4 w-2/3 bg-neutral-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadingError) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-7xl px-4 py-8">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900">
              Mon inscription équipe
            </h1>
            <p className="mt-2 text-sm text-red-600">{loadingError}</p>
          </div>
        </section>
        <div className="mx-auto max-w-4xl px-4 py-8">
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

  if (!inscriptions || inscriptions.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-7xl px-4 py-8">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900">
              Mon inscription équipe
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              Aucune inscription trouvée pour ce groupe.
            </p>
          </div>
        </section>
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="rounded-2xl ring-1 ring-neutral-200 bg-white p-6 space-y-3">
            <p className="text-sm text-neutral-700">
              Il est possible que :
            </p>
            <ul className="list-disc list-inside text-sm text-neutral-700 space-y-1">
              <li>Vous ne soyez pas connecté avec le bon compte.</li>
              <li>
                Les règles de sécurité (RLS) empêchent l’accès à ce groupe pour
                ce compte.
              </li>
              <li>
                L’URL a été modifiée ou ne correspond pas à un groupe valide.
              </li>
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 py-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              to="/mesinscriptions"
              className="text-sm text-neutral-500 hover:text-neutral-800"
            >
              ← Retour à mes inscriptions
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">
              Mon inscription équipe
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              {course?.nom ? `${course.nom} — ${course.lieu}` : "Course inconnue"}
            </p>
          </div>
          {course?.image_url && (
            <div className="w-32 h-20 overflow-hidden rounded-xl ring-1 ring-neutral-200 bg-neutral-100">
              <img
                src={course.image_url}
                alt={course.nom || "Course"}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Carte équipe */}
        <section className="rounded-2xl ring-1 ring-neutral-200 bg-white p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">{teamName}</h2>
              <p className="text-sm text-neutral-600">
                {format ? (
                  <>
                    Format{" "}
                    <span className="font-medium">
                      {format.nom} — {format.distance_km} km /{" "}
                      {format.denivele_dplus} m D+
                    </span>
                    {format.date && (
                      <>
                        {" • "}
                        {formatDate(format.date)}
                      </>
                    )}
                  </>
                ) : (
                  "Format inconnu"
                )}
              </p>
            </div>
            <div className="text-sm text-neutral-700">
              <div>
                Participants :{" "}
                <span className="font-semibold">{totalParticipants}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
              <div className="text-xs text-neutral-500">Montant estimé</div>
              <div className="text-base font-semibold">
                {formatPrice(totalInscriptionEur)} €{" "}
                <span className="text-xs text-neutral-500">(inscriptions)</span>
              </div>
            </div>
            <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
              <div className="text-xs text-neutral-500">Options payantes</div>
              <div className="text-base font-semibold">
                {formatPrice(totalOptionsEur)} €
              </div>
            </div>
            <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
              <div className="text-xs text-neutral-500">Total estimé</div>
              <div className="text-base font-semibold">
                {formatPrice(totalInscriptionEur + totalOptionsEur)} €
              </div>
            </div>
          </div>
        </section>

        {/* Liste des membres */}
        <section className="rounded-2xl ring-1 ring-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">
              Membres de l’équipe ({totalParticipants})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-600 border-b">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Nom</th>
                  <th className="py-2 pr-3">Prénom</th>
                  <th className="py-2 pr-3">Genre</th>
                  <th className="py-2 pr-3">Date de naissance</th>
                  <th className="py-2 pr-3">N° licence / PPS</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {inscriptions.map((ins, idx) => (
                  <tr key={ins.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{idx + 1}</td>
                    <td className="py-2 pr-3">{ins.nom || "—"}</td>
                    <td className="py-2 pr-3">{ins.prenom || "—"}</td>
                    <td className="py-2 pr-3">{ins.genre || "—"}</td>
                    <td className="py-2 pr-3">
                      {ins.date_naissance
                        ? new Intl.DateTimeFormat("fr-FR").format(
                            new Date(ins.date_naissance)
                          )
                        : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {ins.numero_licence || ins.pps_identifier || "—"}
                    </td>
                    <td className="py-2 pr-3">{ins.email || "—"}</td>
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-neutral-200 bg-neutral-50">
                        {ins.statut || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Bas de page : retour / lien course */}
        <div className="flex flex-wrap gap-3">
          <Link
            to="/mesinscriptions"
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            ← Retour à mes inscriptions
          </Link>
          {course?.id && (
            <Link
              to={`/courses/${course.id}`}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              Voir la page de la course
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

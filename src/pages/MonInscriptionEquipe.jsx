// src/pages/MonInscriptionEquipe.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

/* ------------------------------ UI helpers ------------------------------ */
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

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
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
    month: "2-digit",
    day: "2-digit",
  });
}

/* ------------------------------ Component ------------------------------ */

export default function MonInscriptionEquipe() {
  const { groupeId } = useParams(); // route: /mon-inscription-equipe/:groupeId
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useUser();

  const [loading, setLoading] = useState(true);
  const [inscriptions, setInscriptions] = useState([]);
  const [error, setError] = useState(null);
  const [refundLoadingId, setRefundLoadingId] = useState(null);
  const [refundMessage, setRefundMessage] = useState(null);

  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState("");

  const highlightedInscriptionId = searchParams.get("inscriptionId") || searchParams.get("inscription_id") || null;

  /* ------------------------------ Auth + fetch ------------------------------ */

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Vérifier la session (comme ailleurs dans le site)
        const sess =
          session ?? (await supabase.auth.getSession()).data?.session;
        if (!sess?.user) {
          const nextUrl = `/mon-inscription-equipe/${groupeId}`;
          navigate(`/login?next=${encodeURIComponent(nextUrl)}`);
          return;
        }
        setUserId(sess.user.id);
        setUserEmail(sess.user.email || "");

        // On récupère toutes les inscriptions liées à ce groupe
        const { data, error: e } = await supabase
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
          .eq("groupe_id", groupeId)
          .order("created_at", { ascending: true });

        if (e) {
          console.error("Erreur chargement inscriptions groupe :", e);
          setError("Impossible de charger cette inscription d’équipe.");
          setInscriptions([]);
        } else {
          setInscriptions(data || []);
        }
      } catch (err) {
        console.error("Erreur fatale MonInscriptionEquipe:", err);
        setError("Une erreur s’est produite lors du chargement.");
        setInscriptions([]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupeId, session]);

  /* ------------------------------ Dérivés ------------------------------ */

  const { course, format, teamName, isRelay, totalParticipants, amountApprox } =
    useMemo(() => {
      if (!inscriptions.length) {
        return {
          course: null,
          format: null,
          teamName: "",
          isRelay: false,
          totalParticipants: 0,
          amountApprox: null,
        };
      }
      const any = inscriptions[0];
      const fmt = any.format || null;
      const crs = fmt?.course || null;

      // Nom d’équipe : on tente plusieurs champs possibles
      const tn =
        any.team_name ||
        any.nom_equipe ||
        any.groupe_label ||
        "Équipe";

      const participants = inscriptions.length;

      // Estimation du montant global (simple, pour affichage indicatif)
      const prixUnitaire = Number(fmt?.prix || 0) || 0;
      const prixEquipe = Number(fmt?.prix_equipe || 0) || 0;
      const approx = participants > 0 ? participants * prixUnitaire + prixEquipe : null;

      return {
        course: crs,
        format: fmt,
        teamName: tn,
        isRelay: fmt?.type_format === "relais",
        totalParticipants: participants,
        amountApprox: approx,
      };
    }, [inscriptions]);

  const currentRunnerInscription = useMemo(() => {
    if (!inscriptions.length) return null;

    // 1) Si une inscription est passée dans l’URL
    if (highlightedInscriptionId) {
      const fromParam = inscriptions.find((i) => i.id === highlightedInscriptionId);
      if (fromParam) return fromParam;
    }

    // 2) Si l’utilisateur est identifié : coureur_id ou email
    if (userId) {
      const byUser = inscriptions.find((i) => i.coureur_id === userId);
      if (byUser) return byUser;
    }
    if (userEmail) {
      const byEmail = inscriptions.find(
        (i) => (i.email || "").toLowerCase() === userEmail.toLowerCase()
      );
      if (byEmail) return byEmail;
    }

    // 3) Fallback : première inscription du groupe
    return inscriptions[0];
  }, [inscriptions, highlightedInscriptionId, userId, userEmail]);

  const isCapitaine = useMemo(() => {
    if (!currentRunnerInscription) return false;
    // Plusieurs stratégies possibles selon ton schéma :
    // - champ booléen is_capitaine
    // - ou bien capitaine = celui qui a payé (à gérer côté BDD)
    return !!currentRunnerInscription.is_capitaine;
  }, [currentRunnerInscription]);

  /* ------------------------------ Refund handler ------------------------------ */

  async function handleRefund(inscriptionId) {
    if (!inscriptionId) return;
    if (!window.confirm("Confirmer la demande d’annulation pour cette inscription ?")) {
      return;
    }

    try {
      setRefundLoadingId(inscriptionId);
      setRefundMessage(null);

      // ⚠️ Edge function à créer côté Supabase :
      // supabase/functions/refund-inscription-equipe
      const { data, error } = await supabase.functions.invoke(
        "refund-inscription-equipe",
        {
          body: {
            inscription_id: inscriptionId,
          },
        }
      );

      if (error) {
        console.error("refund-inscription-equipe error:", error);
        setRefundMessage(
          error.message ||
            "Erreur lors de la demande d’annulation pour cette inscription."
        );
        return;
      }

      // On peut soit recharger les données, soit appliquer un patch rapide
      // Ici on refetch proprement :
      const { data: refreshed, error: e2 } = await supabase
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
        .eq("groupe_id", groupeId)
        .order("created_at", { ascending: true });

      if (!e2 && refreshed) {
        setInscriptions(refreshed);
      }

      setRefundMessage(
        data?.message ||
          "La demande d’annulation a bien été prise en compte (si éligible)."
      );
    } catch (err) {
      console.error("refund-inscription-equipe fatal:", err);
      setRefundMessage(
        "Une erreur s’est produite lors de la demande d’annulation."
      );
    } finally {
      setRefundLoadingId(null);
    }
  }

  /* ------------------------------ Rendering ------------------------------ */

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-7xl px-4 py-8">
            <div className="h-6 w-56 bg-neutral-100 rounded mb-2 animate-pulse" />
            <div className="h-4 w-80 bg-neutral-100 rounded animate-pulse" />
          </div>
        </section>
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="grid gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl ring-1 ring-neutral-200 bg-white p-5"
              >
                <div className="h-5 w-1/3 bg-neutral-100 rounded mb-2" />
                <div className="h-4 w-2/3 bg-neutral-100 rounded mb-1" />
                <div className="h-4 w-1/2 bg-neutral-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !inscriptions.length) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <section className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-7xl px-4 py-8">
            <Link
              to="/mesinscriptions"
              className="text-sm text-neutral-500 hover:text-neutral-800"
            >
              ← Retour à mes inscriptions
            </Link>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">
              Mon inscription en équipe
            </h1>
          </div>
        </section>
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-2xl border border-red-100 bg-rose-50 px-4 py-6">
            <p className="text-sm text-rose-700">
              {error || "Aucune inscription d’équipe trouvée pour ce lien."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const statutEquipe =
    inscriptions.some((i) => i.statut === "validé")
      ? "validé"
      : inscriptions.every((i) => i.statut === "annulé")
      ? "annulé"
      : "en cours";

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
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">
              Mon inscription en équipe
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              {course?.nom ? (
                <>
                  {course.nom}
                  {format?.nom ? <> — {format.nom}</> : null}
                </>
              ) : (
                "Détail de l’inscription en équipe"
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
            <Pill color="blue">
              {teamName} • {totalParticipants}{" "}
              participant{totalParticipants > 1 ? "s" : ""}
            </Pill>
            <Pill color={isRelay ? "orange" : "neutral"}>
              {isRelay ? "Format relais" : "Équipe / groupe"}
            </Pill>
            <Pill
              color={
                statutEquipe === "validé"
                  ? "green"
                  : statutEquipe === "annulé"
                  ? "red"
                  : "orange"
              }
            >
              Statut équipe : {statutEquipe}
            </Pill>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">
          {/* Carte course */}
          <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row">
              <div className="sm:w-48 bg-neutral-100 flex-shrink-0">
                {course?.image_url ? (
                  <img
                    src={course.image_url}
                    alt={course.nom}
                    className="h-40 sm:h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-40 sm:h-full w-full grid place-items-center text-sm text-neutral-400">
                    Pas d’image
                  </div>
                )}
              </div>
              <div className="flex-1 p-4">
                <h2 className="text-lg font-semibold">{course?.nom}</h2>
                <p className="text-sm text-neutral-600">
                  {course?.lieu || "Lieu non renseigné"}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-neutral-700">
                  {format?.distance_km != null && (
                    <span>🏁 {format.distance_km} km</span>
                  )}
                  {format?.denivele_dplus != null && (
                    <span>⛰️ {format.denivele_dplus} m D+</span>
                  )}
                  {format?.date && <span>📅 {formatDate(format.date)}</span>}
                </div>
                {amountApprox != null && (
                  <p className="mt-3 text-sm text-neutral-700">
                    Montant estimé payé pour l’équipe (hors options) :{" "}
                    <b>{amountApprox.toFixed(2)} €</b>
                  </p>
                )}
                <div className="mt-4">
                  <Link
                    to={`/courses/${course?.id ?? ""}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                  >
                    Voir la page de la course
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Tableau membres équipe */}
          <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Membres de l’équipe</h2>
                <p className="text-sm text-neutral-500">
                  Liste des coureurs rattachés à ce groupe / équipe.
                </p>
              </div>
            </div>
            <div className="p-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-600 border-b">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Nom</th>
                    <th className="py-2 pr-3">Prénom</th>
                    <th className="py-2 pr-3">Sexe</th>
                    <th className="py-2 pr-3">Date de naissance</th>
                    <th className="py-2 pr-3">Licence / PPS</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Statut</th>
                    <th className="py-2 pr-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inscriptions.map((insc, idx) => {
                    const isHighlighted =
                      insc.id === currentRunnerInscription?.id;
                    const isCancelled = insc.statut === "annulé";
                    const isPending = insc.statut === "en attente";
                    const isValidated = insc.statut === "validé";

                    let pillColor = "neutral";
                    if (isValidated) pillColor = "green";
                    else if (isCancelled) pillColor = "red";
                    else if (isPending) pillColor = "orange";

                    const isSelf =
                      (userId && insc.coureur_id === userId) ||
                      (userEmail &&
                        insc.email &&
                        insc.email.toLowerCase() ===
                          userEmail.toLowerCase());

                    return (
                      <tr
                        key={insc.id}
                        className={`border-t ${
                          isHighlighted ? "bg-amber-50" : ""
                        }`}
                      >
                        <td className="py-2 pr-3 w-10">{idx + 1}</td>
                        <td className="py-2 pr-3">{insc.nom || "—"}</td>
                        <td className="py-2 pr-3">{insc.prenom || "—"}</td>
                        <td className="py-2 pr-3">
                          {insc.genre || "—"}
                        </td>
                        <td className="py-2 pr-3">
                          {insc.date_naissance
                            ? formatDate(insc.date_naissance)
                            : "—"}
                        </td>
                        <td className="py-2 pr-3">
                          {insc.numero_licence || "—"}
                        </td>
                        <td className="py-2 pr-3">
                          {insc.email || "—"}
                          {isSelf && (
                            <span className="ml-2 text-[11px] text-emerald-700">
                              (vous)
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <Pill color={pillColor}>{insc.statut || "—"}</Pill>
                        </td>
                        <td className="py-2 pl-3 text-right">
                          {/* Bouton d’annulation individuel */}
                          {isValidated && isSelf && (
                            <button
                              type="button"
                              onClick={() => handleRefund(insc.id)}
                              disabled={refundLoadingId === insc.id}
                              className="inline-flex items-center rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                            >
                              {refundLoadingId === insc.id
                                ? "Traitement…"
                                : "Annuler mon inscription"}
                            </button>
                          )}
                          {!isSelf && isValidated && isCapitaine && (
                            <button
                              type="button"
                              onClick={() => handleRefund(insc.id)}
                              disabled={refundLoadingId === insc.id}
                              className="inline-flex items-center rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                            >
                              {refundLoadingId === insc.id
                                ? "Traitement…"
                                : "Annuler ce coureur"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <p className="mt-3 text-xs text-neutral-500">
                Les montants précis remboursés (ou crédités) sont calculés par
                l’algorithme d’annulation de Tickrace en fonction de la date de
                la demande, du règlement de l’épreuve et des options associées.
              </p>
            </div>
          </section>

          {/* Politique d'annulation (rappel) */}
          <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="p-5 border-b border-neutral-100">
              <h2 className="text-lg font-semibold">Politique d’annulation</h2>
            </div>
            <div className="p-5 space-y-3 text-sm text-neutral-700">
              <p>
                Tickrace applique pour cette épreuve une politique
                d’annulation basée sur la <b>date de la demande</b> par rapport
                à la date de la course. Plus la demande est tardive, plus le
                pourcentage remboursé est faible.
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  Le montant remboursable est calculé automatiquement à partir
                  du prix d’inscription et des options payantes associées.
                </li>
                <li>
                  Les frais de plateforme et/ou une part non remboursable
                  peuvent être conservés selon le règlement de l’épreuve.
                </li>
                <li>
                  Le remboursement peut prendre la forme d’un{" "}
                  <b>crédit Tickrace</b> utilisable sur d’autres courses, ou
                  d’un remboursement Stripe partiel, selon le choix de
                  l’organisateur.
                </li>
              </ul>
              <p className="text-xs text-neutral-500">
                Le détail précis des pourcentages et délais est défini dans le
                règlement de la course et implémenté dans la fonction{" "}
                <code className="font-mono text-[11px]">
                  calculer_credit_annulation
                </code>{" "}
                côté base de données.
              </p>
            </div>
          </section>
        </div>

        {/* Colonne côté */}
        <aside className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="p-5 border-b border-neutral-100">
              <h3 className="text-lg font-semibold">Résumé équipe</h3>
              <p className="text-sm text-neutral-500">
                Vue d’ensemble de votre inscription en équipe.
              </p>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-600">Équipe</span>
                <span className="font-medium text-right">
                  {teamName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Participants</span>
                <span className="font-medium">
                  {totalParticipants}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Format</span>
                <span className="font-medium text-right">
                  {format?.nom || "—"}
                </span>
              </div>
              {format?.date && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">Date de la course</span>
                  <span className="font-medium">
                    {formatDate(format.date)}
                  </span>
                </div>
              )}
              {amountApprox != null && (
                <>
                  <div className="h-px bg-neutral-200 my-2" />
                  <div className="flex justify-between">
                    <span className="text-neutral-600">
                      Estimation montant équipe
                    </span>
                    <span className="font-medium">
                      ~{amountApprox.toFixed(2)} €
                    </span>
                  </div>
                </>
              )}
              <div className="h-px bg-neutral-200 my-2" />
              <p className="text-xs text-neutral-500">
                Toute demande d’annulation doit passer par les boutons
                dédiés. Le calcul final et le traitement du remboursement sont
                gérés automatiquement par Tickrace et Stripe.
              </p>
            </div>
          </div>

          {currentRunnerInscription && (
            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="p-5 border-b border-neutral-100">
                <h3 className="text-lg font-semibold">
                  Votre statut dans l’équipe
                </h3>
              </div>
              <div className="p-5 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Nom</span>
                  <span className="font-medium text-right">
                    {currentRunnerInscription.prenom}{" "}
                    {currentRunnerInscription.nom}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Statut</span>
                  <span className="font-medium text-right">
                    {currentRunnerInscription.statut}
                  </span>
                </div>
                {isCapitaine && (
                  <p className="mt-2 text-xs text-emerald-700">
                    Vous êtes identifié comme <b>capitaine</b> de cette équipe
                    (ou personne ayant effectué la réservation).
                  </p>
                )}
              </div>
            </div>
          )}

          {refundMessage && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              {refundMessage}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

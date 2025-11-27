// src/pages/MonInscriptionEquipe.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

/* --------------------------------- Utils --------------------------------- */

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    year: "numeric",
    month: "long",
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
    month: "long",
    day: "2-digit",
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

/* --------------------------------- Page ---------------------------------- */

export default function MonInscriptionEquipe() {
  const { groupeId } = useParams(); // route: /mon-inscription-equipe/:groupeId
  const navigate = useNavigate();
  const { session } = useUser();

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState(null);
  const [format, setFormat] = useState(null);
  const [course, setCourse] = useState(null);
  const [members, setMembers] = useState([]);
  const [paiement, setPaiement] = useState(null);
  const [options, setOptions] = useState([]);

  const [simLoading, setSimLoading] = useState(false);
  const [simulation, setSimulation] = useState(null);
  const [simError, setSimError] = useState(null);

  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [cancelSuccess, setCancelSuccess] = useState(null);

  useEffect(() => {
    (async () => {
      const sess =
        session ?? (await supabase.auth.getSession()).data?.session ?? null;
      const user = sess?.user ?? null;

      if (!groupeId) {
        setLoading(false);
        return;
      }

      if (!user) {
        navigate(
          `/login?next=${encodeURIComponent(
            `/mon-inscription-equipe/${groupeId}`
          )}`
        );
        return;
      }

      setLoading(true);
      try {
        // 1) Charger le groupe + format + course
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
          .eq("id", groupeId)
          .maybeSingle();

        if (gErr) {
          console.error("GROUP_FETCH_ERROR", gErr);
        }

        if (!grp) {
          setGroup(null);
          setFormat(null);
          setCourse(null);
          setMembers([]);
          setPaiement(null);
          setOptions([]);
          setLoading(false);
          return;
        }

        setGroup(grp);
        setFormat(grp.format || null);
        setCourse(grp.format?.course || null);

        // 2) Charger les membres (inscriptions liées au groupe)
        const { data: membs, error: mErr } = await supabase
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
            groupe_id,
            member_of_group_id,
            team_name
          `
          )
          .or(
            `groupe_id.eq.${groupeId},member_of_group_id.eq.${groupeId}`
          );

        if (mErr) {
          console.error("MEMBERS_FETCH_ERROR", mErr);
        }

        setMembers(membs || []);

        // 3) Charger le paiement lié au groupe (si présent)
        if (grp.paiement_id) {
          const { data: pay, error: pErr } = await supabase
            .from("paiements")
            .select("*")
            .eq("id", grp.paiement_id)
            .maybeSingle();

          if (pErr) {
            console.error("PAIEMENT_FETCH_ERROR", pErr);
          } else {
            setPaiement(pay || null);
          }
        } else {
          setPaiement(null);
        }

        // 4) Charger les options liées aux membres
        if (membs && membs.length > 0) {
          const mIds = membs.map((m) => m.id);
          const { data: opts, error: oErr } = await supabase
            .from("inscriptions_options")
            .select(
              `
              id,
              inscription_id,
              option_id,
              quantity,
              prix_unitaire_cents,
              status
            `
            )
            .in("inscription_id", mIds);

          if (oErr) {
            console.error("OPTIONS_FETCH_ERROR", oErr);
          } else {
            setOptions(opts || []);
          }
        } else {
          setOptions([]);
        }
      } catch (e) {
        console.error("MON_INSCRIPTION_EQUIPE_FATAL", e);
        setGroup(null);
        setFormat(null);
        setCourse(null);
        setMembers([]);
        setPaiement(null);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupeId, session]);

  const participantsCount = useMemo(
    () => (members || []).length,
    [members]
  );

  const teamCategoryLabel = useMemo(() => {
    const cat =
      group?.category || group?.team_category || group?.team_name_public;
    if (!cat) return null;
    const c = String(cat).toLowerCase();
    if (c.includes("mix")) return "Équipe mixte";
    if (c.includes("fem")) return "Équipe féminine";
    if (c.includes("masc") || c.includes("male")) return "Équipe masculine";
    return cat;
  }, [group]);

  // Montant total payé (EUR) basé sur la table paiements
  const totalPaidCents = useMemo(() => {
    if (!paiement) return null;

    // Priorité: total_amount_cents (déjà en cents)
    if (paiement.total_amount_cents != null) {
      return Number(paiement.total_amount_cents) || 0;
    }

    // Sinon amount_total (en €, *100)
    if (paiement.amount_total != null) {
      return Math.round(Number(paiement.amount_total) * 100) || 0;
    }

    // Sinon montant_total (en €, *100)
    if (paiement.montant_total != null) {
      return Math.round(Number(paiement.montant_total) * 100) || 0;
    }

    return null;
  }, [paiement]);

  const totalPaidEur = useMemo(() => {
    if (totalPaidCents == null) return "—";
    return (totalPaidCents / 100).toFixed(2) + " €";
  }, [totalPaidCents]);

  // Total options (côté équipe) pour info
  const optionsTotalCents = useMemo(() => {
    if (!options || options.length === 0) return 0;
    return options.reduce((acc, o) => {
      const q = Number(o.quantity ?? 0);
      const pu = Number(o.prix_unitaire_cents ?? 0);
      return acc + q * pu;
    }, 0);
  }, [options]);

  const optionsTotalEur = useMemo(
    () => (optionsTotalCents / 100).toFixed(2) + " €",
    [optionsTotalCents]
  );

  const currentUserId = session?.user?.id || null;
  const isCaptain =
    !!currentUserId && group?.capitaine_user_id === currentUserId;

  const canCancel = useMemo(() => {
    if (!group || !isCaptain) return false;
    if (!group.statut) return false;
    const s = String(group.statut).toLowerCase();
    return ["paye", "payé", "paid", "valide", "validé"].includes(s);
  }, [group, isCaptain]);

  async function handleSimulateRefund() {
    if (!groupeId) {
      setSimError("URL invalide (groupe_id manquant).");
      return;
    }

    setSimLoading(true);
    setSimError(null);
    setSimulation(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        "simulate-team-refund",
        {
          body: { groupe_id: groupeId },
        }
      );

      if (error) {
        console.error("SIMULATE_TEAM_REFUND_ERROR", error);
        setSimError(
          error.message || "Erreur lors de la simulation du remboursement."
        );
        return;
      }
      if (!data || !data.ok) {
        console.error("SIMULATE_TEAM_REFUND_DATA_ERROR", data);
        setSimError(
          data?.message ||
            "Impossible de simuler le remboursement pour ce groupe."
        );
        return;
      }

      setSimulation(data);
    } catch (e) {
      console.error("SIMULATE_TEAM_REFUND_FATAL", e);
      setSimError(
        e instanceof Error
          ? e.message
          : "Erreur inconnue lors de la simulation."
      );
    } finally {
      setSimLoading(false);
    }
  }

  async function handleRequestTeamRefund() {
    if (!groupeId) {
      setCancelError("URL invalide (groupe_id manquant).");
      return;
    }
    if (!currentUserId) {
      setCancelError(
        "Vous devez être connecté pour annuler cette inscription d’équipe."
      );
      return;
    }
    if (!isCaptain) {
      setCancelError(
        "Seul le capitaine de l’équipe peut demander l’annulation."
      );
      return;
    }

    const ok = window.confirm(
      "Confirmez-vous l’annulation de cette inscription d’équipe ?\nUn remboursement sera demandé selon la politique d’annulation."
    );
    if (!ok) return;

    setCancelLoading(true);
    setCancelError(null);
    setCancelSuccess(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        "request-team-refund",
        {
          body: {
            groupe_id: groupeId,
            user_id: currentUserId,
            reason: "Annulation par le capitaine depuis MonInscriptionEquipe",
          },
        }
      );

      if (error) {
        console.error("REQUEST_TEAM_REFUND_ERROR", error);
        setCancelError(
          error.message ||
            "Erreur lors de la demande d’annulation / remboursement."
        );
        return;
      }

      if (!data || data.error || data.ok === false) {
        console.error("REQUEST_TEAM_REFUND_DATA_ERROR", data);
        setCancelError(
          data?.message ||
            data?.details ||
            data?.error ||
            "La demande de remboursement n’a pas pu être traitée."
        );
        return;
      }

      setCancelSuccess(
        "Votre demande d’annulation a été prise en compte. Un remboursement est en cours de traitement."
      );

      // Mise à jour optimiste du statut local
      setGroup((prev) =>
        prev ? { ...prev, statut: "annulé" } : prev
      );
      setMembers((prev) =>
        (prev || []).map((m) =>
          m.statut === "paye" ||
          m.statut === "payé" ||
          m.statut === "validé" ||
          m.statut === "valide"
            ? { ...m, statut: "annulé" }
            : m
        )
      );
    } catch (e) {
      console.error("REQUEST_TEAM_REFUND_FATAL", e);
      setCancelError(
        e instanceof Error
          ? e.message
          : "Erreur inattendue lors de la demande de remboursement."
      );
    } finally {
      setCancelLoading(false);
    }
  }

  /* ----------------------------- Rendu UI ------------------------------- */

  if (!groupeId) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <p className="text-sm text-red-600">
          URL invalide : aucun identifiant de groupe n’a été fourni dans
          l’URL.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-4">
          <div className="h-5 w-48 bg-neutral-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-neutral-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-48 bg-neutral-100 rounded-2xl animate-pulse" />
            <div className="h-64 bg-neutral-100 rounded-2xl animate-pulse" />
          </div>
          <div className="h-72 bg-neutral-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!group || !format || !course) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link
          to="/mesinscriptions"
          className="inline-flex items-center text-sm text-neutral-600 hover:text-neutral-900 mb-4"
        >
          ← Retour à mes inscriptions
        </Link>
        <h1 className="text-2xl font-bold mb-3">Mon inscription équipe</h1>
        <p className="text-neutral-700 mb-3">
          Aucune inscription trouvée pour ce groupe.
        </p>
        <ul className="list-disc pl-5 text-sm text-neutral-600 space-y-1">
          <li>Vous ne soyez pas connecté avec le bon compte.</li>
          <li>
            Les règles de sécurité (RLS) empêchent l’accès à ce groupe pour ce
            compte.
          </li>
          <li>
            L’URL a été modifiée ou ne correspond pas à un groupe valide.
          </li>
        </ul>
        <div className="mt-5">
          <Link
            to="/mesinscriptions"
            className="inline-flex items-center rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            ← Retour à mes inscriptions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/mesinscriptions"
          className="inline-flex items-center text-sm text-neutral-600 hover:text-neutral-900"
        >
          ← Retour à mes inscriptions
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">
          Mon inscription équipe
        </h1>
        <p className="text-neutral-700 text-sm">
          Gestion de votre inscription en équipe / relais.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">
          {/* Carte course / format / équipe */}
          <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="p-5 border-b border-neutral-100">
              <h2 className="text-lg font-semibold">
                {course.nom} — {course.lieu}
              </h2>
              <p className="text-sm text-neutral-600 mt-1">
                {format.nom} · {format.distance_km} km / {format.denivele_dplus}{" "}
                m D+
              </p>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Pill color="blue">
                  Inscription équipe / relais • {formatDate(format.date)}
                </Pill>
                <Pill color="neutral">
                  Équipe <b className="ml-1">{group.team_name}</b>
                </Pill>
                {teamCategoryLabel && (
                  <Pill color="green">{teamCategoryLabel}</Pill>
                )}
                <Pill color="orange">
                  Participants {participantsCount} / {group.team_size}
                </Pill>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-neutral-500">ID (URL)</dt>
                  <dd className="font-mono text-[13px] break-all">
                    {group.id}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Nom d’équipe</dt>
                  <dd className="font-medium">{group.team_name}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Statut global inscrit</dt>
                  <dd className="font-medium">{group.statut}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Créée le</dt>
                  <dd>{formatDateTime(group.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Dernière mise à jour</dt>
                  <dd>{formatDateTime(group.updated_at)}</dd>
                </div>
              </dl>

              {isCaptain ? (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 inline-block mt-1">
                  Vous êtes le capitaine de cette équipe.
                </p>
              ) : (
                <p className="text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 inline-block mt-1">
                  Seul le capitaine de l’équipe peut demander l’annulation.
                </p>
              )}
            </div>
          </section>

          {/* Cadre OPTIONS & PRIX TOTAL PAYÉ */}
          <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Récapitulatif financier de l’équipe
                </h2>
                <p className="text-sm text-neutral-500">
                  Montant total payé et options associées au groupe.
                </p>
              </div>
            </div>

            <div className="p-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-600">Prix total payé</span>
                <span className="font-semibold">{totalPaidEur}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-neutral-600">
                  Nombre de participants
                </span>
                <span className="font-medium">{participantsCount}</span>
              </div>

              {participantsCount > 0 && totalPaidCents != null && (
                <div className="flex justify-between text-xs text-neutral-600">
                  <span>Prix moyen par participant (approx.)</span>
                  <span className="font-medium">
                    {((totalPaidCents / participantsCount) / 100).toFixed(2)} €
                  </span>
                </div>
              )}

              <div className="h-px bg-neutral-200 my-2" />

              <div className="flex justify-between">
                <span className="text-neutral-600">
                  Total options (tous les membres)
                </span>
                <span className="font-medium">{optionsTotalEur}</span>
              </div>

              {options.length > 0 && (
                <p className="text-xs text-neutral-500 mt-1">
                  Les options affichées correspondent à toutes les options
                  achetées par l’équipe (par exemple : repas, T-shirt, etc.).
                </p>
              )}
            </div>
          </section>

          {/* Tableau des membres */}
          <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="p-5 border-b border-neutral-100">
              <h2 className="text-lg font-semibold">Détail des membres</h2>
              <p className="text-sm text-neutral-500">
                Retrouvez la liste des coureurs rattachés à cette équipe.
              </p>
            </div>

            <div className="p-5 overflow-x-auto">
              {members.length === 0 ? (
                <p className="text-sm text-neutral-600">
                  Aucun membre visible pour ce groupe. Les règles RLS peuvent
                  limiter l’accès à certains coureurs.
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
                        <td className="py-2 pr-3">{m.nom}</td>
                        <td className="py-2 pr-3">{m.prenom}</td>
                        <td className="py-2 pr-3">{m.genre}</td>
                        <td className="py-2 pr-3">
                          {m.date_naissance
                            ? formatDate(m.date_naissance)
                            : "—"}
                        </td>
                        <td className="py-2 pr-3">
                          {m.numero_licence || "—"}
                        </td>
                        <td className="py-2 pr-3">{m.email || "—"}</td>
                        <td className="py-2 pr-3">
                          <Pill
                            color={
                              m.statut === "paye" ||
                              m.statut === "validé" ||
                              m.statut === "payé"
                                ? "green"
                                : m.statut === "annulé"
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
              )}
            </div>
          </section>

          {/* SIMULATEUR REMBOURSEMENT + ANNULATION */}
          <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Simulateur de remboursement
                </h2>
                <p className="text-sm text-neutral-500">
                  Estime le montant remboursable pour l’équipe selon la
                  politique en vigueur.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSimulateRefund}
                disabled={simLoading}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                  simLoading
                    ? "bg-neutral-400 cursor-not-allowed"
                    : "bg-neutral-900 hover:bg-black"
                }`}
              >
                {simLoading ? "Simulation..." : "Simuler un remboursement"}
              </button>
            </div>

            <div className="p-5 text-sm space-y-3">
              {simError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                  {simError}
                </div>
              )}

              {!simulation && !simError && (
                <p className="text-neutral-600">
                  Aucune simulation encore effectuée. Cliquez sur{" "}
                  <b>“Simuler un remboursement”</b> pour voir une estimation
                  basée sur la date de la course et la politique d’annulation.
                </p>
              )}

              {simulation && (
                <>
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">
                        Montant total considéré
                      </span>
                      <span className="font-semibold">
                        {(simulation.amounts.base_cents / 100).toFixed(2)} €
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">
                        Pourcentage remboursable
                      </span>
                      <span className="font-semibold">
                        {simulation.policy.percent}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">
                        Montant remboursable estimé
                      </span>
                      <span className="font-semibold">
                        {(simulation.amounts.refund_cents / 100).toFixed(2)} €
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">
                        Part non remboursable
                      </span>
                      <span className="font-semibold">
                        {(
                          simulation.amounts.non_refundable_cents / 100
                        ).toFixed(2)}{" "}
                        €
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-500">
                    Politique appliquée :{" "}
                    <b>
                      {simulation.policy.policy_tier} (
                      {simulation.policy.percent}
                      %)
                    </b>
                    . Il s’agit d’une <b>simulation</b> : le remboursement réel
                    pourra être ajusté par l’organisateur.
                  </p>
                </>
              )}

              {/* Bloc annulation */}
              <div className="pt-3 mt-3 border-t border-dashed border-neutral-200 space-y-2">
                <button
                  type="button"
                  onClick={handleRequestTeamRefund}
                  disabled={!canCancel || cancelLoading}
                  className={`w-full rounded-xl px-4 py-2 text-sm font-semibold ${
                    !canCancel || cancelLoading
                      ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                      : "bg-rose-600 text-white hover:bg-rose-700"
                  }`}
                >
                  {cancelLoading
                    ? "Annulation en cours…"
                    : "Annuler cette inscription d’équipe"}
                </button>

                {!isCaptain && (
                  <p className="text-[11px] text-neutral-500">
                    Seul le capitaine de l’équipe connecté peut demander
                    l’annulation.
                  </p>
                )}
                {group.statut &&
                  !["paye", "payé", "paid", "valide", "validé"].includes(
                    String(group.statut).toLowerCase()
                  ) && (
                    <p className="text-[11px] text-neutral-500">
                      L’inscription n’est plus dans un état « payée », la
                      demande de remboursement peut être refusée.
                    </p>
                  )}

                {cancelError && (
                  <p className="text-xs text-rose-600 whitespace-pre-line">
                    {cancelError}
                  </p>
                )}
                {cancelSuccess && (
                  <p className="text-xs text-emerald-700 whitespace-pre-line">
                    {cancelSuccess}
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Colonne latérale */}
        <aside className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="p-5 border-b border-neutral-100">
              <h3 className="text-lg font-semibold">Actions</h3>
              <p className="text-sm text-neutral-500">
                Accédez rapidement à la page de la course.
              </p>
            </div>
            <div className="p-5 space-y-3">
              <Link
                to={`/courses/${course.id}`}
                className="w-full inline-flex items-center justify-center rounded-xl bg-white border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              >
                ← Voir la page de la course
              </Link>

              <Link
                to="/mesinscriptions"
                className="w-full inline-flex items-center justify-center rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                Retour à mes inscriptions
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

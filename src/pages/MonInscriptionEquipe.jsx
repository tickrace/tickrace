// src/pages/MonInscriptionEquipe.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

/* -------------------------------------------------------------------------- */
/* Utils                                                                      */
/* -------------------------------------------------------------------------- */

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

function formatDateTime(d) {
  if (!d) return "—";
  const dateObj = typeof d === "string" ? new Date(d) : d;
  return dateObj.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(d) {
  if (!d) return "";
  const dateObj = typeof d === "string" ? new Date(d) : d;
  return dateObj.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* -------------------------------------------------------------------------- */
/* Simulateur / actions d'annulation équipe                                   */
/* -------------------------------------------------------------------------- */

function TeamRefundSimulator({ groupeId, isCaptain, groupStatus }) {
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState(null);
  const [simError, setSimError] = useState(null);

  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [cancelSuccess, setCancelSuccess] = useState(null);

  const canRefund = isCaptain && groupStatus === "paye";

  async function handleSimulate() {
    if (!groupeId) return;
    setSimLoading(true);
    setSimError(null);
    setSimResult(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "simulate-team-refund",
        {
          body: { groupe_id: groupeId },
        }
      );
      if (error) {
        console.error("simulate-team-refund error:", error);
        setSimError(error.message || "Erreur lors de la simulation.");
        return;
      }
      setSimResult(data || null);
    } catch (err) {
      console.error("simulate-team-refund fatal:", err);
      setSimError("Erreur inattendue lors de la simulation.");
    } finally {
      setSimLoading(false);
    }
  }

  async function handleCancel() {
    if (!groupeId) return;
    if (!canRefund) return;

    const ok = window.confirm(
      "Confirmer l’annulation de toute l’équipe et la demande de remboursement ?"
    );
    if (!ok) return;

    setCancelLoading(true);
    setCancelError(null);
    setCancelSuccess(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        "request-team-refund",
        {
          body: { groupe_id: groupeId },
        }
      );
      if (error) {
        console.error("request-team-refund error:", error);
        setCancelError(
          error.message ||
            "Erreur lors de la demande de remboursement d’équipe."
        );
        return;
      }
      setCancelSuccess(
        data?.message ||
          "Demande d’annulation / remboursement enregistrée avec succès."
      );
    } catch (err) {
      console.error("request-team-refund fatal:", err);
      setCancelError(
        "Erreur inattendue lors de la demande de remboursement."
      );
    } finally {
      setCancelLoading(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            Annulation & remboursement d’équipe
          </h2>
          <p className="text-sm text-neutral-500">
            Simule le montant remboursé avant de lancer une annulation
            définitive.
          </p>
        </div>
        {groupStatus && (
          <Pill color={groupStatus === "paye" ? "green" : "orange"}>
            Statut : {groupStatus}
          </Pill>
        )}
      </div>

      <div className="p-5 space-y-4 text-sm">
        {!isCaptain && (
          <p className="text-xs text-neutral-600">
            Seul le capitaine de l’équipe peut demander une annulation /
            remboursement.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSimulate}
            disabled={simLoading || !groupeId}
            className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold border ${
              simLoading
                ? "bg-neutral-100 text-neutral-500 cursor-wait"
                : "bg-white text-neutral-900 hover:bg-neutral-50"
            }`}
          >
            {simLoading ? "Simulation en cours…" : "Simuler le remboursement"}
          </button>

          <button
            type="button"
            onClick={handleCancel}
            disabled={!canRefund || cancelLoading}
            className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold ${
              !canRefund
                ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                : cancelLoading
                ? "bg-red-300 text-white cursor-wait"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
          >
            {cancelLoading ? "Annulation en cours…" : "Annuler l’équipe"}
          </button>
        </div>

        {simError && (
          <p className="text-xs text-red-600 mt-1">{simError}</p>
        )}

        {simResult && (
          <div className="mt-3 rounded-xl bg-neutral-50 border border-dashed border-neutral-200 p-3 text-sm">
            <p className="font-medium mb-1">Résultat de la simulation</p>
            <ul className="space-y-0.5">
              {simResult.policy_tier && (
                <li>
                  Règle appliquée :{" "}
                  <b>{simResult.policy_tier}</b>
                </li>
              )}
              {typeof simResult.percent === "number" && (
                <li>
                  Pourcentage remboursé :{" "}
                  <b>{simResult.percent}%</b>
                </li>
              )}
              {typeof simResult.base_cents === "number" && (
                <li>
                  Base de calcul :{" "}
                  <b>{(simResult.base_cents / 100).toFixed(2)} €</b>
                </li>
              )}
              {typeof simResult.non_refundable_cents === "number" && (
                <li>
                  Part non remboursable :{" "}
                  <b>
                    {(simResult.non_refundable_cents / 100).toFixed(
                      2
                    )}{" "}
                    €
                  </b>
                </li>
              )}
              {typeof simResult.refund_cents === "number" && (
                <li>
                  Montant remboursé estimé :{" "}
                  <b>
                    {(simResult.refund_cents / 100).toFixed(2)} €
                  </b>
                </li>
              )}
            </ul>
            <p className="mt-2 text-xs text-neutral-500">
              Ce montant est indicatif. Le montant final peut varier en
              fonction du traitement Stripe et des règles de l’organisateur.
            </p>
          </div>
        )}

        {cancelError && (
          <p className="text-xs text-red-600 mt-1">{cancelError}</p>
        )}
        {cancelSuccess && (
          <p className="text-xs text-emerald-700 mt-1">
            {cancelSuccess}
          </p>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Page principale MonInscriptionEquipe                                       */
/* -------------------------------------------------------------------------- */

export default function MonInscriptionEquipe() {
  const { session } = useUser();
  const navigate = useNavigate();
  const params = useParams();
  const groupeId = params.groupeId || params.id; // sécurité si route encore en /:id

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState(null);
  const [format, setFormat] = useState(null);
  const [course, setCourse] = useState(null);
  const [members, setMembers] = useState([]);
  const [optionsAgg, setOptionsAgg] = useState([]);
  const [optionsTotalCents, setOptionsTotalCents] = useState(0);
  const [isCaptain, setIsCaptain] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    (async () => {
      if (!groupeId) {
        setLoading(false);
        return;
      }

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
      setUserId(sess.user.id);
      await fetchData(sess.user);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupeId, session]);

  async function fetchData(user) {
    try {
      setLoading(true);

      // 1) Récup groupe + format + course
      const { data: g, error: gErr } = await supabase
        .from("inscriptions_groupes")
        .select(
          `
          *,
          format:format_id (
            id,
            nom,
            distance_km,
            denivele_dplus,
            date,
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
        console.error("Erreur chargement groupe:", gErr);
      }

      if (!g) {
        setGroup(null);
        setFormat(null);
        setCourse(null);
        setMembers([]);
        setOptionsAgg([]);
        setOptionsTotalCents(0);
        setIsCaptain(false);
        return;
      }

      setGroup(g);
      setFormat(g.format || null);
      setCourse(g.format?.course || null);
      setIsCaptain(g.capitaine_user_id === user.id);

      // 2) Récup membres (inscriptions liées au groupe)
      const { data: memb, error: mErr } = await supabase
        .from("inscriptions")
        .select("*")
        .or(
          `groupe_id.eq.${g.id},member_of_group_id.eq.${g.id}`
        );
      if (mErr) {
        console.error("Erreur chargement membres:", mErr);
      }

      const membersSorted = (memb || []).sort((a, b) =>
        (a.created_at || "").localeCompare(b.created_at || "")
      );
      setMembers(membersSorted);

      // 3) Options payantes agrégées sur les membres
      const inscriptionIds = membersSorted
        .map((m) => m.id)
        .filter(Boolean);

      if (inscriptionIds.length > 0) {
        const { data: rawOpts, error: oErr } = await supabase
          .from("inscriptions_options")
          .select(
            `
            id,
            inscription_id,
            option_id,
            quantity,
            prix_unitaire_cents,
            status,
            option:option_id (
              id,
              label,
              description,
              price_cents
            )
          `
          )
          .in("inscription_id", inscriptionIds)
          .neq("status", "pending"); // on ne montre que les options confirmées

        if (oErr) {
          console.error("Erreur chargement options:", oErr);
          setOptionsAgg([]);
          setOptionsTotalCents(0);
        } else {
          const aggMap = new Map();
          for (const row of rawOpts || []) {
            const key = row.option_id;
            const label = row.option?.label || "Option";
            const desc = row.option?.description || "";
            const puCents =
              Number(row.prix_unitaire_cents ?? row.option?.price_cents ?? 0);
            const qty = Number(row.quantity || 0);
            if (!aggMap.has(key)) {
              aggMap.set(key, {
                option_id: key,
                label,
                description: desc,
                prix_unitaire_cents: puCents,
                quantity: 0,
                totalCents: 0,
              });
            }
            const prev = aggMap.get(key);
            prev.quantity += qty;
            prev.totalCents += qty * puCents;
            aggMap.set(key, prev);
          }
          const agg = Array.from(aggMap.values());
          const total = agg.reduce(
            (acc, o) => acc + o.totalCents,
            0
          );
          setOptionsAgg(agg);
          setOptionsTotalCents(total);
        }
      } else {
        setOptionsAgg([]);
        setOptionsTotalCents(0);
      }
    } catch (err) {
      console.error("fetchData MonInscriptionEquipe fatal:", err);
      setGroup(null);
      setFormat(null);
      setCourse(null);
      setMembers([]);
      setOptionsAgg([]);
      setOptionsTotalCents(0);
    } finally {
      setLoading(false);
    }
  }

  const participantsCount = useMemo(
    () => members.filter((m) => !m.is_waitlist).length,
    [members]
  );

  if (!groupeId) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <Link
            to="/mesinscriptions"
            className="text-sm text-neutral-500 hover:text-neutral-800"
          >
            ← Retour à mes inscriptions
          </Link>
          <h1 className="mt-4 text-2xl font-bold">Mon inscription équipe</h1>
          <p className="mt-4 text-sm text-red-600">
            URL invalide : aucun identifiant de groupe n’a été fourni dans
            l’URL.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <Link
            to="/mesinscriptions"
            className="text-sm text-neutral-500 hover:text-neutral-800"
          >
            ← Retour à mes inscriptions
          </Link>
          <div className="mt-4 h-6 w-56 rounded bg-neutral-200 animate-pulse" />
          <div className="mt-2 h-4 w-80 rounded bg-neutral-200 animate-pulse" />
          <div className="mt-6 h-40 rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!group || !format || !course) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <Link
            to="/mesinscriptions"
            className="text-sm text-neutral-500 hover:text-neutral-800"
          >
            ← Retour à mes inscriptions
          </Link>
          <h1 className="mt-4 text-2xl font-bold">Mon inscription équipe</h1>
          <p className="mt-4 text-sm text-neutral-700">
            Aucune inscription trouvée pour ce groupe.
          </p>
          <ul className="mt-2 text-xs text-neutral-500 list-disc list-inside space-y-1">
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
      </div>
    );
  }

  const teamCategoryLabel =
    group.category === "masculine"
      ? "Équipe masculine"
      : group.category === "feminine"
      ? "Équipe féminine"
      : group.category === "mixte"
      ? "Équipe mixte"
      : null;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link
          to="/mesinscriptions"
          className="text-sm text-neutral-500 hover:text-neutral-800"
        >
          ← Retour à mes inscriptions
        </Link>

        <header className="mt-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Mon inscription équipe
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Gestion de votre inscription en équipe / relais.
          </p>
        </header>

        {/* Carte principale */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-6">
            {/* Infos course / format / équipe */}
            <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="p-5 border-b border-neutral-100 flex justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-500">
                    Course
                  </p>
                  <h2 className="text-lg font-semibold">
                    {course.nom} — {course.lieu}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    {format.nom} · {format.distance_km} km /{" "}
                    {format.denivele_dplus} m D+
                  </p>
                  {format.date && (
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Date de l’épreuve : {formatDateShort(format.date)}
                    </p>
                  )}
                </div>
                {course.image_url && (
                  <div className="hidden sm:block w-28 h-20 rounded-xl overflow-hidden bg-neutral-100">
                    <img
                      src={course.image_url}
                      alt={course.nom}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              <div className="p-5 space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill color="blue">Inscription équipe / relais</Pill>
                  {teamCategoryLabel && (
                    <Pill color="neutral">{teamCategoryLabel}</Pill>
                  )}
                  <Pill color={group.statut === "paye" ? "green" : "orange"}>
                    Statut global : {group.statut || "—"}
                  </Pill>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 mt-3">
                  <div className="space-y-1">
                    <p className="text-xs uppercase text-neutral-500">
                      Équipe
                    </p>
                    <p className="text-sm font-medium">
                      {group.team_name || group.nom_groupe || "—"}
                    </p>
                    <p className="text-xs text-neutral-500">
                      ID (URL) : {group.id}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase text-neutral-500">
                      Participants
                    </p>
                    <p className="text-sm font-medium">
                      {participantsCount} / {group.team_size}
                    </p>
                    {isCaptain && (
                      <p className="text-xs text-emerald-700">
                        Vous êtes le capitaine de cette équipe.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 mt-3 text-xs text-neutral-600">
                  <div>
                    <p>Inscription créée le :</p>
                    <p className="font-medium">
                      {formatDateTime(group.created_at)}
                    </p>
                  </div>
                  <div>
                    <p>Dernière mise à jour :</p>
                    <p className="font-medium">
                      {formatDateTime(group.updated_at)}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Cadre options payantes */}
            {optionsAgg.length > 0 && (
              <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Options payantes associées à l’équipe
                    </h2>
                    <p className="text-sm text-neutral-500">
                      Détail des options prises par les membres de l’équipe
                      (hors statut “pending”).
                    </p>
                  </div>
                  <Pill color="neutral">
                    Total options :{" "}
                    {(optionsTotalCents / 100).toFixed(2)} €
                  </Pill>
                </div>

                <div className="p-5 text-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-neutral-600 border-b">
                          <th className="py-2 pr-3">Option</th>
                          <th className="py-2 pr-3">Description</th>
                          <th className="py-2 pr-3 text-right">
                            Prix unitaire
                          </th>
                          <th className="py-2 pr-3 text-right">Quantité</th>
                          <th className="py-2 pl-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {optionsAgg.map((o) => (
                          <tr
                            key={o.option_id}
                            className="border-b last:border-b-0"
                          >
                            <td className="py-2 pr-3 font-medium">
                              {o.label}
                            </td>
                            <td className="py-2 pr-3 text-neutral-600">
                              {o.description || "—"}
                            </td>
                            <td className="py-2 pr-3 text-right">
                              {(o.prix_unitaire_cents / 100).toFixed(2)} €
                            </td>
                            <td className="py-2 pr-3 text-right">
                              {o.quantity}
                            </td>
                            <td className="py-2 pl-3 text-right font-medium">
                              {(o.totalCents / 100).toFixed(2)} €
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* Détail des membres */}
            <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    Détail des membres
                  </h2>
                  <p className="text-sm text-neutral-500">
                    Retrouvez la liste des coureurs rattachés à cette équipe.
                  </p>
                </div>
                <Pill color="neutral">
                  {participantsCount} membre
                  {participantsCount > 1 ? "s" : ""}
                </Pill>
              </div>

              <div className="p-5 text-sm">
                {members.length === 0 ? (
                  <p className="text-neutral-600">
                    Aucun membre visible pour ce groupe. Les règles RLS
                    peuvent limiter l’accès à certains coureurs.
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
                          <tr
                            key={m.id}
                            className="border-b last:border-b-0"
                          >
                            <td className="py-2 pr-3">{idx + 1}</td>
                            <td className="py-2 pr-3">
                              {m.nom || "—"}
                            </td>
                            <td className="py-2 pr-3">
                              {m.prenom || "—"}
                            </td>
                            <td className="py-2 pr-3">
                              {m.genre || "—"}
                            </td>
                            <td className="py-2 pr-3">
                              {m.date_naissance
                                ? formatDateShort(m.date_naissance)
                                : "—"}
                            </td>
                            <td className="py-2 pr-3">
                              {m.numero_licence || "—"}
                            </td>
                            <td className="py-2 pr-3">
                              {m.email || "—"}
                            </td>
                            <td className="py-2 pr-3">
                              <Pill
                                color={
                                  m.statut === "paye"
                                    ? "green"
                                    : m.statut === "en attente"
                                    ? "orange"
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
              </div>
            </section>

            {/* Simulateur / annulation équipe */}
            <TeamRefundSimulator
              groupeId={group.id}
              isCaptain={isCaptain}
              groupStatus={group.statut}
            />
          </div>

          {/* Colonne latérale */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5">
              <h3 className="text-sm font-semibold mb-2">Raccourcis</h3>
              <div className="flex flex-col gap-2 text-sm">
                <Link
                  to={`/courses/${course.id}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 font-semibold text-neutral-900 hover:bg-neutral-50"
                >
                  ← Voir la page de la course
                </Link>
                <Link
                  to="/mesinscriptions"
                  className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 font-semibold text-white hover:bg-black"
                >
                  Retour à mes inscriptions
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

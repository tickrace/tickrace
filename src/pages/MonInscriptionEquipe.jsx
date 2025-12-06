// src/pages/MonInscriptionEquipe.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

/* --------------------------------- UI helpers --------------------------------- */

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

function Card({ title, subtitle, right, children }) {
  return (
    <div className="rounded-2xl bg-white shadow-lg shadow-neutral-900/5 ring-1 ring-neutral-200">
      {(title || subtitle || right) && (
        <div className="p-5 border-b border-neutral-200 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title && (
              <h2 className="text-lg sm:text-xl font-bold">{title}</h2>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>
            )}
          </div>
          {right}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

const Row = ({ label, children }) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 py-2">
    <div className="text-sm font-semibold text-neutral-600">{label}</div>
    <div className="sm:col-span-2 text-sm">{children}</div>
  </div>
);

const euros = (n) => {
  if (n == null || isNaN(Number(n))) return "—";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(Number(n));
  } catch {
    return `${Number(n).toFixed(2)} €`;
  }
};

const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatDateTime = (iso, tz = "Europe/Paris") => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    timeZone: tz,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/* ---------------------------- Raisons d’annulation ---------------------------- */

const TEAM_CANCEL_REASONS = [
  {
    value: "blessure_coureur",
    label: "Blessure ou problème de santé d’un membre de l’équipe",
  },
  {
    value: "indisponibilite_professionnelle",
    label: "Indisponibilité professionnelle",
  },
  {
    value: "indisponibilite_familiale",
    label: "Indisponibilité familiale / personnelle",
  },
  {
    value: "probleme_logistique",
    label: "Problème logistique (transport, hébergement, covoiturage, etc.)",
  },
  {
    value: "erreur_inscription",
    label: "Erreur d’inscription (format, doublon, etc.)",
  },
  {
    value: "changement_objectif_sportif",
    label: "Changement d’objectif sportif",
  },
  {
    value: "meteo_defavorable",
    label: "Prévision météo défavorable",
  },
  {
    value: "autre_raison_personnelle",
    label: "Autre raison personnelle (détails ci-dessous)",
  },
];

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

  // Annulation équipe
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonText, setCancelReasonText] = useState("");
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
        // 1) Groupe + format + course
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
                image_url,
                departement
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

        // 2) Membres
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
          .or(`groupe_id.eq.${groupeId},member_of_group_id.eq.${groupeId}`);

        if (mErr) {
          console.error("MEMBERS_FETCH_ERROR", mErr);
        }

        setMembers(membs || []);

        // 3) Paiement
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

        // 4) Options (toutes les options de tous les membres de ce groupe)
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

    if (paiement.total_amount_cents != null) {
      return Number(paiement.total_amount_cents) || 0;
    }
    if (paiement.amount_total != null) {
      return Math.round(Number(paiement.amount_total) * 100) || 0;
    }
    if (paiement.montant_total != null) {
      return Math.round(Number(paiement.montant_total) * 100) || 0;
    }
    return null;
  }, [paiement]);

  const totalPaidEur = useMemo(() => {
    if (totalPaidCents == null) return "—";
    return euros(totalPaidCents / 100);
  }, [totalPaidCents]);

  // Total options
  const optionsTotalCents = useMemo(() => {
    if (!options || options.length === 0) return 0;
    return options.reduce((acc, o) => {
      const q = Number(o.quantity ?? 0);
      const pu = Number(o.prix_unitaire_cents ?? 0);
      return acc + q * pu;
    }, 0);
  }, [options]);

  const optionsTotalEur = useMemo(
    () => euros(optionsTotalCents / 100),
    [optionsTotalCents]
  );

  // Couleur du statut global de l'équipe (header)
  const teamStatusColor = useMemo(() => {
    const s = (group?.statut || "").toLowerCase();
    if (s.includes("valid") || s.includes("paye") || s.includes("payé"))
      return "green";
    if (s.includes("attente") || s.includes("wait")) return "orange";
    if (s.includes("annul")) return "red";
    return "neutral";
  }, [group?.statut]);

  // Interprétation statut paiement Stripe
  let stripeStatusColor = "neutral";
  const rawStripeStatus = (paiement?.status || "").toLowerCase();
  if (
    rawStripeStatus.includes("paye") ||
    rawStripeStatus.includes("payé") ||
    rawStripeStatus === "succeeded" ||
    rawStripeStatus === "paid"
  ) {
    stripeStatusColor = "green";
  } else if (
    rawStripeStatus.includes("rembours") ||
    rawStripeStatus.includes("refund")
  ) {
    stripeStatusColor = "blue";
  } else if (rawStripeStatus.includes("pend") || rawStripeStatus === "open") {
    stripeStatusColor = "orange";
  } else if (rawStripeStatus) {
    stripeStatusColor = "red";
  }

  const isAlreadyCancelled = group?.statut === "annule";

  /* --------------------------- Simulation remboursement --------------------------- */

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

  /* --------------------------- Demande de remboursement --------------------------- */

  async function handleRequestTeamRefund() {
    if (!groupeId) return;

    setCancelError(null);
    setCancelSuccess(null);

    if (!cancelReason) {
      setCancelError("Merci de sélectionner un motif d’annulation.");
      return;
    }

    const confirmed = window.confirm(
      "Confirmer l’annulation de cette inscription d’équipe ? Cette opération est définitive une fois le remboursement effectué."
    );
    if (!confirmed) return;

    setCancelLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "request-team-refund",
        {
          body: {
            groupe_id: groupeId,
            reason_code: cancelReason,
            reason_text: cancelReasonText || null,
          },
        }
      );

      if (error) {
        console.error("REQUEST_TEAM_REFUND_ERROR", error);
        setCancelError(
          error.message ||
            "Erreur lors de la demande de remboursement de l’équipe."
        );
        return;
      }

      if (!data || !data.ok) {
        console.error("REQUEST_TEAM_REFUND_DATA_ERROR", data);
        setCancelError(
          data?.message ||
            "Impossible de créer la demande de remboursement pour ce groupe."
        );
        return;
      }

      setCancelSuccess(
        `Demande de remboursement envoyée. Montant estimé : ${(data.refund_cents / 100).toFixed(
          2
        )} € (politique ${data.policy_tier} – ${data.percent}%).`
      );

      // Mettre le statut localement en "annule"
      setGroup((g) => (g ? { ...g, statut: "annule" } : g));
      setMembers((prev) =>
        (prev || []).map((m) => ({ ...m, statut: "annulé" }))
      );
    } catch (e) {
      console.error("REQUEST_TEAM_REFUND_FATAL", e);
      setCancelError(
        e instanceof Error
          ? e.message
          : "Erreur inconnue lors de la demande de remboursement."
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
          URL invalide : aucun identifiant de groupe n’a été fourni dans l’URL.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 p-8">
        Chargement de votre inscription d’équipe…
      </div>
    );
  }

  if (!group || !format || !course) {
    return (
      <div className="min-h-screen bg-neutral-50 p-8">
        <Card title="Mon inscription d’équipe">
          <p className="text-sm text-neutral-700 mb-3">
            Aucune inscription d’équipe trouvée pour cet identifiant.
          </p>
          <ul className="list-disc pl-5 text-sm text-neutral-600 space-y-1">
            <li>Vous n’êtes peut-être pas connecté avec le bon compte.</li>
            <li>
              Les règles de sécurité (RLS) empêchent l’accès à ce groupe pour ce
              compte.
            </li>
            <li>
              L’URL a été modifiée ou ne correspond pas à un groupe valide.
            </li>
          </ul>
          <div className="mt-5 flex gap-2">
            <Link
              to="/mesinscriptions"
              className="inline-flex items-center rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              ← Retour à mes inscriptions
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const stripeReceiptUrl = paiement?.receipt_url || null;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header harmonisé avec MonInscription */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 py-10 flex flex-col items-center text-center gap-3">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Mon inscription{" "}
            <span className="font-black">
              <span className="text-orange-600">Tick</span>Race
            </span>
            <span className="block text-base sm:text-lg mt-1 text-neutral-600">
              Équipe / relais
            </span>
          </h1>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Pill color={teamStatusColor}>
              {isAlreadyCancelled ? "Équipe annulée" : group.statut || "—"}
            </Pill>

            {group.is_waitlist && <Pill color="blue">Liste d’attente</Pill>}

            <Pill color="orange">
              Participants {participantsCount} / {group.team_size}
            </Pill>

            {teamCategoryLabel && (
              <Pill color="green">{teamCategoryLabel}</Pill>
            )}
          </div>
        </div>
      </section>

      {/* Body */}
      <div className="mx-auto max-w-5xl px-4 py-8 grid gap-8">
        {/* Épreuve / équipe */}
        <Card
          title={course?.nom || "Épreuve"}
          subtitle={
            course
              ? `${course.lieu || "—"}${
                  course.departement ? ` • ${course.departement}` : ""
                }`
              : "—"
          }
          right={
            course?.id && (
              <Link
                to={`/courses/${course.id}`}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 text-center"
              >
                Voir la page épreuve
              </Link>
            )
          }
        >
          <div className="rounded-xl ring-1 ring-neutral-200 p-4 bg-neutral-50">
            <div className="text-sm font-semibold text-neutral-700 mb-2">
              Détails du format & de l’équipe
            </div>
            <Row label="Format">
              {format?.nom || "—"} • {format?.distance_km ?? "—"} km /{" "}
              {format?.denivele_dplus ?? "—"} m D+
            </Row>
            <Row label="Type">
              {format?.type_format || "—"}{" "}
              {group?.team_size
                ? `• ${group.team_size} participant(s) prévu(s)`
                : ""}
            </Row>
            <Row label="Date de l’épreuve">
              {format?.date ? formatDate(format.date) : "—"}
            </Row>
            <Row label="Nom d’équipe">
              {group.team_name || group.nom_groupe || "—"}
            </Row>
            <Row label="Catégorie">
              {teamCategoryLabel || "—"}
            </Row>
            <Row label="Participants">
              {participantsCount} / {group.team_size}
            </Row>
            <Row label="Statut global">
              <Pill color={teamStatusColor}>
                {isAlreadyCancelled ? "Équipe annulée" : group.statut || "—"}
              </Pill>
            </Row>
            <Row label="Créée le">
              {group.created_at ? formatDateTime(group.created_at) : "—"}
            </Row>
            <Row label="Dernière mise à jour">
              {group.updated_at ? formatDateTime(group.updated_at) : "—"}
            </Row>
            <Row label="Identifiant d’équipe (URL)">
              <span className="font-mono text-[13px] break-all">
                {group.id}
              </span>
            </Row>
          </div>
        </Card>

        {/* Membres */}
        <Card title="Membres de l’équipe" subtitle="Liste des coureurs rattachés à cette équipe.">
          {members.length === 0 ? (
            <div className="text-sm text-neutral-600">
              Aucun membre visible pour ce groupe. Les règles RLS peuvent
              limiter l’accès à certains coureurs.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl ring-1 ring-neutral-200">
              <table className="min-w-full text-sm bg-white">
                <thead className="bg-neutral-50">
                  <tr className="text-left text-neutral-600 border-b">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Nom</th>
                    <th className="py-2 px-3">Prénom</th>
                    <th className="py-2 px-3">Sexe</th>
                    <th className="py-2 px-3">Date de naissance</th>
                    <th className="py-2 px-3">N° licence / PPS</th>
                    <th className="py-2 px-3">Email</th>
                    <th className="py-2 px-3">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, idx) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-2 px-3">{idx + 1}</td>
                      <td className="py-2 px-3">{m.nom || "—"}</td>
                      <td className="py-2 px-3">{m.prenom || "—"}</td>
                      <td className="py-2 px-3">{m.genre || "—"}</td>
                      <td className="py-2 px-3">
                        {m.date_naissance
                          ? formatDate(m.date_naissance)
                          : "—"}
                      </td>
                      <td className="py-2 px-3">
                        {m.numero_licence || "—"}
                      </td>
                      <td className="py-2 px-3">{m.email || "—"}</td>
                      <td className="py-2 px-3">
                        <Pill
                          color={
                            m.statut === "paye" || m.statut === "validé"
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
            </div>
          )}
        </Card>

        {/* Financier & paiement */}
        <Card
          title="Récapitulatif financier & paiement"
          right={
            stripeReceiptUrl && (
              <a
                href={stripeReceiptUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
              >
                Télécharger le reçu Stripe
              </a>
            )
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Récap équipe */}
            <div className="rounded-xl ring-1 ring-neutral-200 p-4 bg-neutral-50">
              <div className="text-sm font-semibold text-neutral-700 mb-2">
                Récapitulatif Tickrace
              </div>
              <Row label="Prix total payé">{totalPaidEur}</Row>
              <Row label="Total options (équipe)">{optionsTotalEur}</Row>
              <Row label="Nombre de participants">
                {participantsCount}
              </Row>
              {participantsCount > 0 && totalPaidCents != null && (
                <Row label="Prix moyen par participant (approx.)">
                  {euros((totalPaidCents / participantsCount) / 100)}
                </Row>
              )}
            </div>

            {/* Stripe */}
            <div className="rounded-xl ring-1 ring-neutral-200 p-4 bg-neutral-50">
              <div className="text-sm font-semibold text-neutral-700 mb-2">
                Transaction Stripe de l’équipe
              </div>
              {paiement ? (
                <>
                  <Row label="Payment Intent ID">
                    {paiement.stripe_payment_intent_id || "—"}
                  </Row>
                  <Row label="Session Stripe">
                    {paiement.stripe_session_id || paiement.trace_id || "—"}
                  </Row>
                  <Row label="Montant (Stripe)">
                    {totalPaidCents != null
                      ? euros(totalPaidCents / 100)
                      : "—"}
                  </Row>
                  <Row label="Statut Stripe">
                    <Pill color={stripeStatusColor}>
                      {paiement.status || "—"}
                    </Pill>
                  </Row>
                  <Row label="Reçu Stripe">
                    {stripeReceiptUrl ? (
                      <a
                        href={stripeReceiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-orange-600 hover:underline"
                      >
                        Ouvrir le reçu
                      </a>
                    ) : (
                      "—"
                    )}
                  </Row>
                </>
              ) : (
                <div className="text-sm text-neutral-500">
                  Aucun paiement Stripe rattaché à ce groupe.
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Remboursement & annulation équipe */}
        <Card title="Remboursement & annulation de l’équipe">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Simulation */}
            <div className="rounded-xl ring-1 ring-neutral-200 p-4 bg-neutral-50">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-neutral-700">
                  Simulation de remboursement (indicatif)
                </div>
                <button
                  type="button"
                  onClick={handleSimulateRefund}
                  disabled={simLoading}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold text-white ${
                    simLoading
                      ? "bg-neutral-400 cursor-not-allowed"
                      : "bg-neutral-900 hover:bg-black"
                  }`}
                >
                  {simLoading ? "Simulation…" : "Simuler"}
                </button>
              </div>

              <div className="text-sm space-y-3">
                {simError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                    {simError}
                  </div>
                )}

                {!simulation && !simError && (
                  <p className="text-neutral-600">
                    Aucune simulation encore effectuée. Cliquez sur{" "}
                    <b>“Simuler”</b> pour voir une estimation basée sur la date
                    de la course et la politique d’annulation.
                  </p>
                )}

                {simulation && (
                  <>
                    <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-neutral-600">
                          Montant total considéré
                        </span>
                        <span className="font-semibold">
                          {euros(simulation.amounts.base_cents / 100)}
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
                          {euros(
                            simulation.amounts.refund_cents / 100
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-600">
                          Part non remboursable
                        </span>
                        <span className="font-semibold">
                          {euros(
                            simulation.amounts.non_refundable_cents / 100
                          )}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-neutral-500">
                      Politique appliquée :{" "}
                      <b>
                        {simulation.policy.policy_tier} (
                        {simulation.policy.percent}%)
                      </b>
                      . Il s’agit d’une <b>simulation</b> : le remboursement
                      réel pourra être ajusté par l’organisateur.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Annulation équipe */}
            <div className="rounded-xl ring-1 ring-neutral-200 p-4 bg-neutral-50">
              <div className="text-sm font-semibold text-neutral-700 mb-2">
                Annuler l’inscription de l’équipe
              </div>
              <p className="text-xs text-neutral-600 mb-2">
                La demande de remboursement sera effectuée sur le moyen de
                paiement utilisé lors de l’inscription, selon la politique
                d’annulation en vigueur.
              </p>

              <label className="text-xs font-medium text-neutral-700">
                Motif d’annulation
              </label>
              <select
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                disabled={cancelLoading || isAlreadyCancelled}
              >
                <option value="">Sélectionner un motif…</option>
                {TEAM_CANCEL_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>

              <label className="mt-3 text-xs font-medium text-neutral-700">
                Détails (optionnel)
              </label>
              <textarea
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm resize-y min-h-[70px]"
                placeholder="Précisez votre situation (facultatif, visible par l’organisation et l’admin Tickrace)…"
                value={cancelReasonText}
                onChange={(e) => setCancelReasonText(e.target.value)}
                disabled={cancelLoading || isAlreadyCancelled}
              />

              {cancelError && (
                <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {cancelError}
                </div>
              )}
              {cancelSuccess && (
                <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {cancelSuccess}
                </div>
              )}

              <button
                type="button"
                onClick={handleRequestTeamRefund}
                disabled={
                  cancelLoading ||
                  !cancelReason ||
                  isAlreadyCancelled ||
                  !paiement
                }
                className={`mt-3 w-full inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold ${
                  cancelLoading ||
                  !cancelReason ||
                  isAlreadyCancelled ||
                  !paiement
                    ? "bg-neutral-300 text-neutral-600 cursor-not-allowed"
                    : "bg-rose-600 text-white hover:bg-rose-700"
                }`}
              >
                {isAlreadyCancelled
                  ? "Équipe déjà annulée"
                  : cancelLoading
                  ? "Annulation en cours…"
                  : "Demander le remboursement de l’équipe"}
              </button>

              <p className="mt-3 text-[11px] text-neutral-500">
                Rappel de la politique d’annulation :
                <br />
                • <b>J-30+</b> : 90% &nbsp;• <b>J-15–29</b> : 70% &nbsp;•{" "}
                <b>J-7–14</b> : 50% &nbsp;• <b>J-3–6</b> : 30% &nbsp;•{" "}
                <b>J-0–2</b> : 0%
              </p>
            </div>
          </div>
        </Card>

        {/* Actions bas de page */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            ← Retour
          </button>
          <Link
            to="/mesinscriptions"
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:brightness-110"
          >
            Voir toutes mes inscriptions
          </Link>
        </div>
      </div>
    </div>
  );
}

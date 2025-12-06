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
  const { groupeId } = useParams(); // ⚠️ route: /mon-inscription-equipe/:groupeId
  const navigate = useNavigate();
  const { session } = useUser();

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState(null); // groupe "principal" (celui de l’URL)
  const [groupsList, setGroupsList] = useState([]); // toutes les équipes liées au même paiement
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

  // Édition d’un membre (ligne du tableau)
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [memberDraft, setMemberDraft] = useState(null);
  const [savingMember, setSavingMember] = useState(false);
  const [memberMessage, setMemberMessage] = useState("");

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
        // 1) Charger le groupe demandé (avec format + course)
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
          setGroupsList([]);
          setFormat(null);
          setCourse(null);
          setMembers([]);
          setPaiement(null);
          setOptions([]);
          setLoading(false);
          return;
        }

        // 2) Charger toutes les équipes rattachées au même paiement (si paiement_id présent)
        let allGroups = [grp];
        if (grp.paiement_id) {
          const { data: siblings, error: sErr } = await supabase
            .from("inscriptions_groupes")
            .select("*")
            .eq("paiement_id", grp.paiement_id)
            .order("created_at", { ascending: true });

          if (sErr) {
            console.error("GROUP_SIBLINGS_FETCH_ERROR", sErr);
          } else if (siblings && siblings.length > 0) {
            allGroups = siblings;
          }
        }

        setGroupsList(allGroups);

        // groupe "principal" = celui de l’URL si présent, sinon le premier
        const mainGroup =
          allGroups.find((g) => g.id === groupeId) || allGroups[0];

        setGroup(mainGroup);
        setFormat(grp.format || null);
        setCourse(grp.format?.course || null);

        // 3) Charger les membres pour TOUTES les équipes de ce paiement
        const groupIdsForMembers = allGroups.map((g) => g.id);

        let membs = [];
        if (groupIdsForMembers.length > 0) {
          const { data: membData, error: mErr } = await supabase
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
            .in("member_of_group_id", groupIdsForMembers);

          if (mErr) {
            console.error("MEMBERS_FETCH_ERROR", mErr);
          } else {
            membs = membData || [];
          }
        }

        setMembers(membs);

        // 4) Paiement (commun à toutes les équipes)
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

        // 5) Options pour tous les membres (toutes équipes confondues)
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
        setGroupsList([]);
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

  // Somme des tailles d’équipes
  const totalTeamSize = useMemo(() => {
    if (!groupsList || groupsList.length === 0) return null;
    return groupsList.reduce(
      (acc, g) => acc + (Number(g.team_size || 0) || 0),
      0
    );
  }, [groupsList]);

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
    return (totalPaidCents / 100).toFixed(2) + " €";
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
    () => (optionsTotalCents / 100).toFixed(2) + " €",
    [optionsTotalCents]
  );

  // Couleur du statut global de l'équipe (pour le header)
  const teamStatusColor = useMemo(() => {
    const s = (group?.statut || "").toLowerCase();
    if (s.includes("valid") || s.includes("paye") || s.includes("payé"))
      return "green";
    if (s.includes("attente") || s.includes("wait")) return "orange";
    if (s.includes("annul")) return "red";
    return "neutral";
  }, [group?.statut]);

  /* --------- Édition d’un membre --------- */

  function startEditMember(m) {
    setEditingMemberId(m.id);
    setMemberDraft({
      nom: m.nom || "",
      prenom: m.prenom || "",
      genre: m.genre || "",
      date_naissance: m.date_naissance || "",
      numero_licence: m.numero_licence || "",
      email: m.email || "",
    });
    setMemberMessage("");
  }

  function cancelEditMember() {
    setEditingMemberId(null);
    setMemberDraft(null);
    setSavingMember(false);
    setMemberMessage("");
  }

  function handleMemberFieldChange(field, value) {
    setMemberDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function saveMember() {
    if (!editingMemberId || !memberDraft) return;
    setSavingMember(true);
    setMemberMessage("");

    try {
      const payload = {
        nom: memberDraft.nom?.trim() || null,
        prenom: memberDraft.prenom?.trim() || null,
        genre: memberDraft.genre || null,
        date_naissance: memberDraft.date_naissance || null,
        numero_licence: memberDraft.numero_licence || null,
        email: memberDraft.email?.trim() || null,
      };

      const { data, error } = await supabase
        .from("inscriptions")
        .update(payload)
        .eq("id", editingMemberId)
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
        .maybeSingle();

      if (error) {
        console.error("UPDATE_MEMBER_ERROR", error);
        setMemberMessage(error.message || "Impossible de mettre à jour ce membre.");
      } else if (data) {
        setMembers((prev) =>
          (prev || []).map((m) => (m.id === editingMemberId ? { ...m, ...data } : m))
        );
        setMemberMessage("Infos mises à jour pour ce membre.");
        setEditingMemberId(null);
        setMemberDraft(null);
      }
    } catch (e) {
      console.error("UPDATE_MEMBER_FATAL", e);
      setMemberMessage(
        e instanceof Error ? e.message : "Erreur inconnue lors de la mise à jour."
      );
    } finally {
      setSavingMember(false);
    }
  }

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

  const isAlreadyCancelled = group.statut === "annule";

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
              Participants {participantsCount}
              {totalTeamSize ? ` / ${totalTeamSize}` : ""}
            </Pill>

            {teamCategoryLabel && (
              <Pill color="green">{teamCategoryLabel}</Pill>
            )}

            {groupsList.length > 1 && (
              <Pill color="neutral">
                {groupsList.length} équipe
                {groupsList.length > 1 ? "s" : ""} dans ce paiement
              </Pill>
            )}
          </div>
        </div>
      </section>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-4 flex items-center justify-between">
          <Link
            to="/mesinscriptions"
            className="inline-flex items-center text-sm text-neutral-600 hover:text-neutral-900"
          >
            ← Retour à mes inscriptions
          </Link>
        </div>

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
                  {format.nom} · {format.distance_km} km /{" "}
                  {format.denivele_dplus} m D+
                </p>
                {groupsList.length > 1 && (
                  <p className="text-xs text-neutral-500 mt-1">
                    Cette réservation contient{" "}
                    <b>{groupsList.length} équipes</b> (affichage des membres
                    de toutes les équipes ci-dessous).
                  </p>
                )}
              </div>

              <div className="p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Pill color="blue">
                    Inscription équipe / relais • {formatDate(format.date)}
                  </Pill>
                  <Pill color="neutral">
                    Équipe principale{" "}
                    <b className="ml-1">{group.team_name}</b>
                  </Pill>
                  {teamCategoryLabel && (
                    <Pill color="green">{teamCategoryLabel}</Pill>
                  )}
                  <Pill color="orange">
                    Participants {participantsCount}
                    {totalTeamSize ? ` / ${totalTeamSize}` : ""}
                  </Pill>
                  {isAlreadyCancelled && (
                    <Pill color="red">Équipe annulée</Pill>
                  )}
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-neutral-500">ID (URL)</dt>
                    <dd className="font-mono text-[13px] break-all">
                      {group.id}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Nom d’équipe principale</dt>
                    <dd className="font-medium">{group.team_name}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">
                      Nombre d’équipes dans ce paiement
                    </dt>
                    <dd className="font-medium">{groupsList.length}</dd>
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

                {group.capitaine_user_id && (
                  <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 inline-block mt-1">
                    Vous êtes le capitaine de cette équipe.
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
                    Montant total payé et options associées au groupe (toutes
                    les équipes de ce paiement).
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
                    Nombre de participants (toutes équipes)
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
                    achetées par l’ensemble des équipes de ce paiement (repas,
                    T-shirt, etc.).
                  </p>
                )}
              </div>
            </section>

            {/* Tableau des membres (toutes équipes) */}
            <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="p-5 border-b border-neutral-100">
                <h2 className="text-lg font-semibold">Détail des membres</h2>
                <p className="text-sm text-neutral-500">
                  Liste des coureurs rattachés à toutes les équipes de cette
                  inscription. La colonne "Équipe" indique l’équipe de chaque
                  coureur. Vous pouvez modifier certaines informations pour
                  chaque inscription.
                </p>
                {memberMessage && (
                  <p className="mt-2 text-xs text-neutral-600">
                    {memberMessage}
                  </p>
                )}
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
                        <th className="py-2 pr-3">Équipe</th>
                        <th className="py-2 pr-3">Nom</th>
                        <th className="py-2 pr-3">Prénom</th>
                        <th className="py-2 pr-3">Sexe</th>
                        <th className="py-2 pr-3">Date de naissance</th>
                        <th className="py-2 pr-3">N° licence / PPS</th>
                        <th className="py-2 pr-3">Email</th>
                        <th className="py-2 pr-3">Statut</th>
                        <th className="py-2 pr-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m, idx) => {
                        const isEditing = editingMemberId === m.id;
                        return (
                          <tr key={m.id} className="border-b last:border-0">
                            <td className="py-2 pr-3">{idx + 1}</td>
                            <td className="py-2 pr-3">
                              {m.team_name || "—"}
                            </td>
                            {/* Nom */}
                            <td className="py-2 pr-3">
                              {isEditing ? (
                                <input
                                  type="text"
                                  className="w-full rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                                  value={memberDraft?.nom ?? ""}
                                  onChange={(e) =>
                                    handleMemberFieldChange(
                                      "nom",
                                      e.target.value
                                    )
                                  }
                                />
                              ) : (
                                m.nom
                              )}
                            </td>
                            {/* Prénom */}
                            <td className="py-2 pr-3">
                              {isEditing ? (
                                <input
                                  type="text"
                                  className="w-full rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                                  value={memberDraft?.prenom ?? ""}
                                  onChange={(e) =>
                                    handleMemberFieldChange(
                                      "prenom",
                                      e.target.value
                                    )
                                  }
                                />
                              ) : (
                                m.prenom
                              )}
                            </td>
                            {/* Genre */}
                            <td className="py-2 pr-3">
                              {isEditing ? (
                                <input
                                  type="text"
                                  className="w-full rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                                  value={memberDraft?.genre ?? ""}
                                  onChange={(e) =>
                                    handleMemberFieldChange(
                                      "genre",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Homme, Femme…"
                                />
                              ) : (
                                m.genre
                              )}
                            </td>
                            {/* Date de naissance */}
                            <td className="py-2 pr-3">
                              {isEditing ? (
                                <input
                                  type="date"
                                  className="w-full rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                                  value={
                                    memberDraft?.date_naissance
                                      ? memberDraft.date_naissance.slice(0, 10)
                                      : ""
                                  }
                                  onChange={(e) =>
                                    handleMemberFieldChange(
                                      "date_naissance",
                                      e.target.value || null
                                    )
                                  }
                                />
                              ) : m.date_naissance ? (
                                formatDate(m.date_naissance)
                              ) : (
                                "—"
                              )}
                            </td>
                            {/* Licence */}
                            <td className="py-2 pr-3">
                              {isEditing ? (
                                <input
                                  type="text"
                                  className="w-full rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                                  value={memberDraft?.numero_licence ?? ""}
                                  onChange={(e) =>
                                    handleMemberFieldChange(
                                      "numero_licence",
                                      e.target.value
                                    )
                                  }
                                />
                              ) : (
                                m.numero_licence || "—"
                              )}
                            </td>
                            {/* Email */}
                            <td className="py-2 pr-3">
                              {isEditing ? (
                                <input
                                  type="email"
                                  className="w-full rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                                  value={memberDraft?.email ?? ""}
                                  onChange={(e) =>
                                    handleMemberFieldChange(
                                      "email",
                                      e.target.value
                                    )
                                  }
                                />
                              ) : (
                                m.email || "—"
                              )}
                            </td>
                            {/* Statut */}
                            <td className="py-2 pr-3">
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
                            {/* Actions */}
                            <td className="py-2 pr-3">
                              {isEditing ? (
                                <div className="flex flex-col gap-1">
                                  <button
                                    type="button"
                                    onClick={saveMember}
                                    disabled={savingMember}
                                    className="rounded-lg bg-neutral-900 text-white px-3 py-1 text-xs font-semibold hover:bg-black disabled:opacity-60"
                                  >
                                    {savingMember
                                      ? "Enregistrement…"
                                      : "Enregistrer"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditMember}
                                    className="rounded-lg border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50"
                                  >
                                    Annuler
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEditMember(m)}
                                  className="rounded-lg border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50"
                                >
                                  Modifier
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            {/* SIMULATEUR REMBOURSEMENT */}
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
                          {(
                            simulation.amounts.refund_cents / 100
                          ).toFixed(2)}{" "}
                          €
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
                        {simulation.policy.percent}%)
                      </b>
                      . Il s’agit d’une <b>simulation</b> : le remboursement
                      réel pourra être ajusté par l’organisateur.
                    </p>
                  </>
                )}
              </div>
            </section>
          </div>

          {/* Colonne latérale */}
          <aside className="lg:col-span-1 space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="p-5 border-b border-neutral-100">
                <h3 className="text-lg font-semibold">Actions</h3>
                <p className="text-sm text-neutral-500">
                  Accédez rapidement à la page de la course ou annulez
                  l’équipe.
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

                <div className="h-px bg-neutral-200 my-2" />

                {/* Bloc annulation équipe */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">
                    Annuler l’inscription équipe
                  </h4>
                  <p className="text-xs text-neutral-600">
                    La demande de remboursement sera effectuée sur le moyen de
                    paiement utilisé lors de l’inscription, selon la politique
                    d’annulation en vigueur.
                  </p>

                  <label className="text-xs font-medium text-neutral-700">
                    Motif d’annulation
                  </label>
                  <select
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
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

                  <label className="text-xs font-medium text-neutral-700">
                    Détails (optionnel)
                  </label>
                  <textarea
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm resize-y min-h-[70px]"
                    placeholder="Précisez votre situation (facultatif, visible par l’organisation et l’admin Tickrace)…"
                    value={cancelReasonText}
                    onChange={(e) => setCancelReasonText(e.target.value)}
                    disabled={cancelLoading || isAlreadyCancelled}
                  />

                  {cancelError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      {cancelError}
                    </div>
                  )}
                  {cancelSuccess && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
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
                    className={`w-full inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold ${
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

                  <p className="text-[11px] text-neutral-500">
                    Rappel de la politique d’annulation :
                    <br />
                    • <b>J-30+</b> : 90% &nbsp;• <b>J-15–29</b> : 70% &nbsp;•
                    <b> J-7–14</b> : 50% &nbsp;• <b>J-3–6</b> : 30% &nbsp;•
                    <b> J-0–2</b> : 0%
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

// src/pages/MonInscription.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import CalculCreditAnnulation from "../components/CalculCreditAnnulation";

/* ---------- UI helpers ---------- */
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

const km = (x) => (x == null ? "—" : `${Number(x).toFixed(1)} km`);
const meters = (x) => (x == null ? "—" : `${parseInt(x, 10)} m`);

/* ---------- Raisons d’annulation individuelles ---------- */
const CANCEL_REASONS = [
  { value: "blessure_coureur", label: "Blessure ou problème de santé" },
  { value: "indisponibilite_professionnelle", label: "Indisponibilité professionnelle" },
  { value: "indisponibilite_familiale", label: "Indisponibilité familiale / personnelle" },
  {
    value: "probleme_logistique",
    label: "Problème logistique (transport, hébergement, covoiturage, etc.)",
  },
  { value: "erreur_inscription", label: "Erreur d’inscription (format, doublon, etc.)" },
  { value: "changement_objectif_sportif", label: "Changement d’objectif sportif" },
  { value: "meteo_defavorable", label: "Prévision météo défavorable" },
  {
    value: "autre_raison_personnelle",
    label: "Autre raison personnelle (détails ci-dessous)",
  },
];

/* ---------- Page ---------- */
export default function MonInscription() {
  const { id } = useParams(); // id de l'inscription (UUID)
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [insc, setInsc] = useState(null);
  const [course, setCourse] = useState(null);
  const [format, setFormat] = useState(null);
  const [optionsA, setOptionsA] = useState([]); // inscription_options + format_options
  const [optionsB, setOptionsB] = useState([]); // inscriptions_options + options_catalogue
  const [payInfos, setPayInfos] = useState({ paiements: [], receipt: null });
  const [refund, setRefund] = useState(null);
  const [annulating, setAnnulating] = useState(false);
  const [error, setError] = useState("");

  // Annulation
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonText, setCancelReasonText] = useState("");
  const [cancelError, setCancelError] = useState("");

  // Édition du profil pour cette inscription
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  const statutColor = useMemo(() => {
    const s = (insc?.statut || "").toLowerCase();
    if (s.includes("valid") || s.includes("paye") || s.includes("payé"))
      return "green";
    if (s.includes("attente") || s.includes("wait")) return "orange";
    if (s.includes("annul")) return "red";
    return "neutral";
  }, [insc?.statut]);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      // 1) Inscription
      const { data: ins, error: insErr } = await supabase
        .from("inscriptions")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (insErr) throw insErr;
      if (!ins) throw new Error("Inscription introuvable.");

      setInsc(ins);

      // Préparer le brouillon de profil
      setProfileDraft({
        nom: ins.nom || "",
        prenom: ins.prenom || "",
        genre: ins.genre || "",
        date_naissance: ins.date_naissance || "",
        nationalite: ins.nationalite || "",
        email: ins.email || "",
        telephone: ins.telephone || "",
        adresse: ins.adresse || "",
        adresse_complement: ins.adresse_complement || "",
        code_postal: ins.code_postal || "",
        ville: ins.ville || "",
        pays: ins.pays || "",
        club: ins.club || "",
        justificatif_type: ins.justificatif_type || "",
        numero_licence: ins.numero_licence || "",
        contact_urgence_nom: ins.contact_urgence_nom || "",
        contact_urgence_telephone: ins.contact_urgence_telephone || "",
        apparaitre_resultats:
          ins.apparaitre_resultats === null ||
          ins.apparaitre_resultats === undefined
            ? true
            : !!ins.apparaitre_resultats,
      });

      // 2) Course & format
      const [courseRes, formatRes] = await Promise.all([
        ins.course_id
          ? supabase
              .from("courses")
              .select("id, nom, lieu, departement, image_url")
              .eq("id", ins.course_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        ins.format_id
          ? supabase
              .from("formats")
              .select(
                "id, nom, date, heure_depart, distance_km, denivele_dplus, denivele_dmoins, type_epreuve, type_format, prix, prix_repas, prix_equipe, fuseau_horaire"
              )
              .eq("id", ins.format_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (courseRes.error) console.error("COURSE_LOAD_ERROR", courseRes.error);
      if (formatRes.error) console.error("FORMAT_LOAD_ERROR", formatRes.error);

      setCourse(courseRes.data || null);
      setFormat(formatRes.data || null);

      // 3) Options
      const [a, b] = await Promise.all([
        supabase
          .from("inscription_options")
          .select(
            `
            id, quantity, unit_price_cents, total_cents, scope, team_label, created_at,
            format_option:format_option_id(id, titre, type, prix_cents)
          `
          )
          .eq("inscription_id", id),
        supabase
          .from("inscriptions_options")
          .select(
            `
            id, quantity, prix_unitaire_cents, status, created_at,
            option:option_id(id, label, price_cents, description, image_url)
          `
          )
          .eq("inscription_id", id),
      ]);

      if (a.error) console.error("OPTIONS_A_LOAD_ERROR", a.error);
      if (b.error) console.error("OPTIONS_B_LOAD_ERROR", b.error);

      setOptionsA(a.data || []);
      setOptionsB(b.data || []);

      // 4) Paiements : inscription_id direct + inscription_ids (uuid[])
      const [directRes, groupRes] = await Promise.all([
        supabase
          .from("paiements")
          .select("*")
          .eq("inscription_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("paiements")
          .select("*")
          .contains("inscription_ids", [id])
          .order("created_at", { ascending: false }),
      ]);

      if (directRes.error)
        console.error("PAIEMENTS_DIRECT_ERROR", directRes.error);
      if (groupRes.error)
        console.error("PAIEMENTS_GROUP_ERROR", groupRes.error);

      const paiements = [
        ...(directRes.data || []),
        ...(groupRes.data || []),
      ];

      const receipt =
        (paiements || []).find((p) => !!p.receipt_url)?.receipt_url || null;

      setPayInfos({ paiements, receipt });

      // 5) Dernier remboursement
      const { data: remb, error: rembErr } = await supabase
        .from("remboursements")
        .select("*")
        .eq("inscription_id", id)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (rembErr) console.error("REMBOURSEMENT_LOAD_ERROR", rembErr);
      setRefund(remb || null);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // --- Annulation + remboursement via Edge Function ---
  const onAnnuler = async () => {
    if (!insc || annulating) return;

    setCancelError("");

    if (!cancelReason) {
      setCancelError("Merci de sélectionner un motif d’annulation.");
      return;
    }

    const ok = window.confirm(
      "Confirmer l’annulation de votre inscription ?\n\nNous allons calculer automatiquement votre crédit d’annulation et, si possible, rembourser le paiement associé."
    );
    if (!ok) return;

    setAnnulating(true);
    setError("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "refund-inscription",
        {
          body: {
            inscription_id: id,
            reason_code: cancelReason,
            reason_text: cancelReasonText || null,
          },
        }
      );

      if (error) {
        console.error("refund-inscription error:", error);
        alert(
          "Impossible d’annuler cette inscription : " +
            (error.message || "erreur inconnue")
        );
        setError(error.message || "Échec de l’annulation.");
        return;
      }

      await loadAll();

      setCancelReason("");
      setCancelReasonText("");

      if (data?.refund_cents > 0) {
        const montant = (data.refund_cents / 100).toFixed(2);
        alert(
          `Annulation enregistrée.\nUn remboursement de ${montant} € a été déclenché.`
        );
      } else {
        alert(
          "Annulation enregistrée.\nAucun remboursement n’était dû selon la politique en vigueur."
        );
      }
    } catch (e) {
      console.error(e);
      setError(e?.message || "Échec de l’annulation.");
      alert("Impossible d’annuler : " + (e?.message ?? "erreur inconnue"));
    } finally {
      setAnnulating(false);
    }
  };

  // --- Édition profil ---
  const handleProfileChange = (field, value) => {
    setProfileDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const onSaveProfile = async () => {
    if (!profileDraft) return;
    setSavingProfile(true);
    setProfileMessage("");

    try {
      const payload = {
        nom: profileDraft.nom?.trim() || null,
        prenom: profileDraft.prenom?.trim() || null,
        genre: profileDraft.genre || null,
        date_naissance: profileDraft.date_naissance || null,
        nationalite: profileDraft.nationalite || null,
        email: profileDraft.email?.trim() || null,
        telephone: profileDraft.telephone || null,
        adresse: profileDraft.adresse || null,
        adresse_complement: profileDraft.adresse_complement || null,
        code_postal: profileDraft.code_postal || null,
        ville: profileDraft.ville || null,
        pays: profileDraft.pays || null,
        club: profileDraft.club || null,
        justificatif_type: profileDraft.justificatif_type || null,
        numero_licence: profileDraft.numero_licence || null,
        contact_urgence_nom: profileDraft.contact_urgence_nom || null,
        contact_urgence_telephone: profileDraft.contact_urgence_telephone || null,
        apparaitre_resultats: !!profileDraft.apparaitre_resultats,
      };

      const { data, error } = await supabase
        .from("inscriptions")
        .update(payload)
        .eq("id", id)
        .select("*")
        .maybeSingle();

      if (error) throw error;

      setInsc(data);
      setEditingProfile(false);
      setProfileMessage("Profil mis à jour pour cette inscription.");
    } catch (e) {
      console.error("PROFILE_UPDATE_ERROR", e);
      setProfileMessage(
        e?.message || "Impossible de mettre à jour votre profil."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  // --- Options bloc ---
  const OptionsBloc = () => {
    const hasA = (optionsA || []).length > 0;
    const hasB = (optionsB || []).length > 0;
    if (!hasA && !hasB)
      return (
        <div className="text-sm text-neutral-500">
          Aucune option sélectionnée.
        </div>
      );

    return (
      <div className="grid gap-3">
        {hasA && (
          <div>
            <div className="text-sm font-semibold text-neutral-700 mb-2">
              Options (catalogue “format_options”)
            </div>
            <div className="rounded-xl ring-1 ring-neutral-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr className="text-left">
                    <th className="px-3 py-2">Option</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Quantité</th>
                    <th className="px-3 py-2">Prix unitaire</th>
                    <th className="px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {optionsA.map((o) => {
                    const label = o?.format_option?.titre || "Option";
                    const type = o?.format_option?.type || "—";
                    const unit =
                      o?.unit_price_cents != null
                        ? o.unit_price_cents / 100
                        : (o?.format_option?.prix_cents ?? 0) / 100;
                    const q = o?.quantity ?? 1;
                    const total =
                      o?.total_cents != null
                        ? o.total_cents / 100
                        : unit * q;
                    return (
                      <tr
                        key={`A-${o.id}`}
                        className="border-t border-neutral-200"
                      >
                        <td className="px-3 py-2">{label}</td>
                        <td className="px-3 py-2">{type}</td>
                        <td className="px-3 py-2">{q}</td>
                        <td className="px-3 py-2">{euros(unit)}</td>
                        <td className="px-3 py-2">{euros(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {hasB && (
          <div>
            <div className="text-sm font-semibold text-neutral-700 mb-2">
              Options (catalogue “options_catalogue”)
            </div>
            <div className="rounded-xl ring-1 ring-neutral-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr className="text-left">
                    <th className="px-3 py-2">Option</th>
                    <th className="px-3 py-2">Quantité</th>
                    <th className="px-3 py-2">Prix unitaire</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {optionsB.map((o) => {
                    const label = o?.option?.label || "Option";
                    const unit =
                      (o?.prix_unitaire_cents ??
                        o?.option?.price_cents ??
                        0) / 100;
                    const q = o?.quantity ?? 1;
                    const total = unit * q;
                    const status = (o?.status || "pending").toLowerCase();
                    const pillColor =
                      status === "confirmed"
                        ? "green"
                        : status === "canceled" || status === "cancelled"
                        ? "red"
                        : "orange";
                    return (
                      <tr
                        key={`B-${o.id}`}
                        className="border-t border-neutral-200"
                      >
                        <td className="px-3 py-2">{label}</td>
                        <td className="px-3 py-2">{q}</td>
                        <td className="px-3 py-2">{euros(unit)}</td>
                        <td className="px-3 py-2">{euros(total)}</td>
                        <td className="px-3 py-2">
                          <Pill color={pillColor}>
                            {o?.status || "pending"}
                          </Pill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading)
    return <div className="min-h-screen bg-neutral-50 p-8">Chargement…</div>;

  if (error)
    return (
      <div className="min-h-screen bg-neutral-50 p-8">
        <Card title="Erreur">
          <div className="text-sm text-rose-700">{error}</div>
          <div className="mt-4">
            <button
              onClick={() => loadAll()}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              Réessayer
            </button>
          </div>
        </Card>
      </div>
    );

  if (!insc)
    return (
      <div className="min-h-screen bg-neutral-50 p-8">
        Inscription introuvable.
      </div>
    );

  const tz = format?.fuseau_horaire || "Europe/Paris";
  const isCanceled =
    !!insc.cancelled_at ||
    (insc.statut || "").toLowerCase().includes("annul");
  const canCancel = !isCanceled;

  // Totaux
  const totalCoureur = Number(insc.prix_total_coureur || 0);
  const totalOptionsA = optionsA.reduce((acc, o) => {
    const unit =
      o?.unit_price_cents != null
        ? o.unit_price_cents / 100
        : (o?.format_option?.prix_cents ?? 0) / 100;
    const q = o?.quantity ?? 1;
    const total =
      o?.total_cents != null ? o.total_cents / 100 : unit * q;
    return acc + total;
  }, 0);
  const totalOptionsB = optionsB.reduce((acc, o) => {
    const unit =
      (o?.prix_unitaire_cents ?? o?.option?.price_cents ?? 0) / 100;
    const q = o?.quantity ?? 1;
    return acc + unit * q;
  }, 0);
  const totalOptions = totalOptionsA + totalOptionsB;
  const totalTheo = totalCoureur + totalOptions;

  // Paiement principal Stripe
  const mainPayment = payInfos?.paiements?.length
    ? payInfos.paiements[0]
    : null;

  let stripeAmountDisplay = "—";
  if (mainPayment) {
    if (mainPayment.amount_total != null) {
      stripeAmountDisplay = euros(mainPayment.amount_total / 100);
    } else if (mainPayment.total_amount_cents != null) {
      stripeAmountDisplay = euros(mainPayment.total_amount_cents / 100);
    } else if (mainPayment.montant_total != null) {
      stripeAmountDisplay = euros(mainPayment.montant_total);
    }
  }

  let stripeStatusColor = "neutral";
  const rawStatus = (mainPayment?.status || "").toLowerCase();
  if (
    rawStatus.includes("paye") ||
    rawStatus.includes("payé") ||
    rawStatus === "succeeded" ||
    rawStatus === "paid"
  ) {
    stripeStatusColor = "green";
  } else if (
    rawStatus.includes("rembours") ||
    rawStatus.includes("refund")
  ) {
    stripeStatusColor = "blue";
  } else if (rawStatus.includes("pend") || rawStatus === "open") {
    stripeStatusColor = "orange";
  } else if (rawStatus) {
    stripeStatusColor = "red";
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 py-10 flex flex-col items-center text-center gap-3">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Mon inscription{" "}
            <span className="font-black">
              <span className="text-orange-600">Tick</span>Race
            </span>
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Pill color={statutColor}>
              {isCanceled ? "Annulée" : insc.statut || "—"}
            </Pill>
            {insc.is_waitlist && <Pill color="blue">Liste d’attente</Pill>}
          </div>
        </div>
      </section>

      {/* Body */}
      <div className="mx-auto max-w-5xl px-4 py-8 grid gap-8">
        {/* Épreuve / Format */}
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
            insc.course_id && (
              <Link
                to={`/courses/${insc.course_id}`}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 text-center"
              >
                Voir la page épreuve
              </Link>
            )
          }
        >
          <div className="rounded-xl ring-1 ring-neutral-200 p-4 bg-neutral-50">
            <div className="text-sm font-semibold text-neutral-700 mb-2">
              Détails du format
            </div>
            <Row label="Format">{format?.nom || "—"}</Row>
            <Row label="Type">
              {format?.type_epreuve || "—"}{" "}
              {format?.type_format ? `• ${format.type_format}` : ""}
            </Row>
            <Row label="Date / Heure">
              {format?.date
                ? `${formatDate(format.date)} • ${
                    format?.heure_depart
                      ? format?.heure_depart.slice(0, 5)
                      : "—"
                  }`
                : "—"}
              {format?.fuseau_horaire ? ` (${format.fuseau_horaire})` : ""}
            </Row>
            <Row label="Distance">{km(format?.distance_km)}</Row>
            <Row label="D+ / D-">
              {meters(format?.denivele_dplus)} /{" "}
              {meters(format?.denivele_dmoins)}
            </Row>
            {insc.dossard != null && (
              <Row label="Dossard">#{insc.dossard}</Row>
            )}
            {insc.team_name && <Row label="Équipe">{insc.team_name}</Row>}
          </div>
        </Card>

        {/* Mon profil – complet et éditable */}
        <Card title="Mon profil pour cette inscription">
          {!profileDraft ? (
            <div className="text-sm text-neutral-500">Chargement…</div>
          ) : (
            <>
              <div className="rounded-xl ring-1 ring-neutral-200 p-4 bg-neutral-50">
                {!editingProfile ? (
                  <>
                    <Row label="Nom / Prénom">
                      {(insc.nom || "—") + " " + (insc.prenom || "")}
                    </Row>
                    <Row label="Genre">{insc.genre || "—"}</Row>
                    <Row label="Date de naissance">
                      {insc.date_naissance
                        ? formatDate(insc.date_naissance)
                        : "—"}
                    </Row>
                    <Row label="Nationalité">
                      {insc.nationalite || "—"}
                    </Row>
                    <Row label="Email">{insc.email || "—"}</Row>
                    <Row label="Téléphone">{insc.telephone || "—"}</Row>
                    <Row label="Adresse">
                      {insc.adresse || "—"}
                      {insc.adresse_complement
                        ? `, ${insc.adresse_complement}`
                        : ""}
                    </Row>
                    <Row label="Code postal / Ville">
                      {(insc.code_postal || "—") +
                        " " +
                        (insc.ville || "")}
                    </Row>
                    <Row label="Pays">{insc.pays || "—"}</Row>
                    <Row label="Club">{insc.club || "—"}</Row>
                    <Row label="Type de justificatif">
                      {insc.justificatif_type || "—"}
                    </Row>
                    <Row label="Licence">
                      {insc.numero_licence || "—"}
                    </Row>
                    {insc.pps_identifier && (
                      <Row label="PPS">
                        {insc.pps_identifier}{" "}
                        {insc.pps_expiry_date
                          ? `(valide jusqu’au ${formatDate(
                              insc.pps_expiry_date
                            )})`
                          : ""}
                      </Row>
                    )}
                    <Row label="Apparaître dans les résultats">
                      {insc.apparaitre_resultats ? "Oui" : "Non"}
                    </Row>
                    {insc.contact_urgence_nom && (
                      <Row label="Contact urgence">
                        {insc.contact_urgence_nom} •{" "}
                        {insc.contact_urgence_telephone || "—"}
                      </Row>
                    )}
                    {insc.cancelled_at && (
                      <Row label="Annulée le">
                        {formatDateTime(insc.cancelled_at, tz)}
                      </Row>
                    )}
                  </>
                ) : (
                  <>
                    <Row label="Nom">
                      <input
                        type="text"
                        className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                        value={profileDraft.nom}
                        onChange={(e) =>
                          handleProfileChange("nom", e.target.value)
                        }
                      />
                    </Row>
                    <Row label="Prénom">
                      <input
                        type="text"
                        className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                        value={profileDraft.prenom}
                        onChange={(e) =>
                          handleProfileChange("prenom", e.target.value)
                        }
                      />
                    </Row>
                    <Row label="Genre">
                      <input
                        type="text"
                        className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                        value={profileDraft.genre}
                        onChange={(e) =>
                          handleProfileChange("genre", e.target.value)
                        }
                        placeholder="Homme, Femme, Non-binaire…"
                      />
                    </Row>
                    <Row label="Date de naissance">
                      <input
                        type="date"
                        className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                        value={
                          profileDraft.date_naissance
                            ? profileDraft.date_naissance.slice(0, 10)
                            : ""
                        }
                        onChange={(e) =>
                          handleProfileChange(
                            "date_naissance",
                            e.target.value || null
                          )
                        }
                      />
                    </Row>
                    <Row label="Nationalité">
                      <input
                        type="text"
                        className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                        value={profileDraft.nationalite}
                        onChange={(e) =>
                          handleProfileChange(
                            "nationalite",
                            e.target.value
                          )
                        }
                      />
                    </Row>
                    <Row label="Email">
                      <input
                        type="email"
                        className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                        value={profileDraft.email}
                        onChange={(e) =>
                          handleProfileChange("email", e.target.value)
                        }
                      />
                    </Row>
                    <Row label="Téléphone">
                      <input
                        type="tel"
                        className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                        value={profileDraft.telephone}
                        onChange={(e) =>
                          handleProfileChange("telephone", e.target.value)
                        }
                      />
                    </Row>
                    <Row label="Adresse">
                      <input
                        type="text"
                        className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                        value={profileDraft.adresse}
                        onChange={(e) =>
                          handleProfileChange("adresse", e.target.value)
                        }
                      />
                    </Row>
                    <Row label="Complément d’adresse">
                      <input
                        type="text"
                        className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                        value={profileDraft.adresse_complement}
                        onChange={(e) =>
                          handleProfileChange(
                            "adresse_complement",
                            e.target.value
                          )
                        }
                      />
                    </Row>
                    <Row label="Code postal">
                      <input
                        type="text"
                        className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                        value={profileDraft.code_postal}
                        onChange={(e) =>
                          handleProfileChange(
                            "code_postal",
                            e.target.value
                          )
                        }
                      />
                    </Row>
                    <Row label="Ville">
                      <input
                        type="text"
                        className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                        value={profileDraft.ville}
                        onChange={(e) =>
                          handleProfileChange("ville", e.target.value)
                        }
                      />
                    </Row>
                    <Row label="Pays">
                      <input
                        type="text"
                        className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                        value={profileDraft.pays}
                        onChange={(e) =>
                          handleProfileChange("pays", e.target.value)
                        }
                      />
                    </Row>
                    <Row label="Club">
                      <input
                        type="text"
                        className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                        value={profileDraft.club}
                        onChange={(e) =>
                          handleProfileChange("club", e.target.value)
                        }
                      />
                    </Row>
                    <Row label="Type de justificatif">
                      <input
                        type="text"
                        className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                        value={profileDraft.justificatif_type}
                        onChange={(e) =>
                          handleProfileChange(
                            "justificatif_type",
                            e.target.value
                          )
                        }
                      />
                    </Row>
                    <Row label="Numéro de licence">
                      <input
                        type="text"
                        className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                        value={profileDraft.numero_licence}
                        onChange={(e) =>
                          handleProfileChange(
                            "numero_licence",
                            e.target.value
                          )
                        }
                      />
                    </Row>
                    <Row label="Apparaître dans les résultats">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="rounded border-neutral-300"
                          checked={!!profileDraft.apparaitre_resultats}
                          onChange={(e) =>
                            handleProfileChange(
                              "apparaitre_resultats",
                              e.target.checked
                            )
                          }
                        />
                        <span>
                          Oui, je souhaite apparaître dans les résultats
                        </span>
                      </label>
                    </Row>
                    <Row label="Contact urgence">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                          placeholder="Nom"
                          value={profileDraft.contact_urgence_nom}
                          onChange={(e) =>
                            handleProfileChange(
                              "contact_urgence_nom",
                              e.target.value
                            )
                          }
                        />
                        <input
                          type="tel"
                          className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                          placeholder="Téléphone"
                          value={profileDraft.contact_urgence_telephone}
                          onChange={(e) =>
                            handleProfileChange(
                              "contact_urgence_telephone",
                              e.target.value
                            )
                          }
                        />
                      </div>
                    </Row>
                  </>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 items-center">
                {!editingProfile ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProfile(true);
                      setProfileMessage("");
                    }}
                    className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                  >
                    Modifier mes infos pour cette inscription
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDraft({
                          nom: insc.nom || "",
                          prenom: insc.prenom || "",
                          genre: insc.genre || "",
                          date_naissance: insc.date_naissance || "",
                          nationalite: insc.nationalite || "",
                          email: insc.email || "",
                          telephone: insc.telephone || "",
                          adresse: insc.adresse || "",
                          adresse_complement: insc.adresse_complement || "",
                          code_postal: insc.code_postal || "",
                          ville: insc.ville || "",
                          pays: insc.pays || "",
                          club: insc.club || "",
                          justificatif_type: insc.justificatif_type || "",
                          numero_licence: insc.numero_licence || "",
                          contact_urgence_nom: insc.contact_urgence_nom || "",
                          contact_urgence_telephone:
                            insc.contact_urgence_telephone || "",
                          apparaitre_resultats:
                            insc.apparaitre_resultats === null ||
                            insc.apparaitre_resultats === undefined
                              ? true
                              : !!insc.apparaitre_resultats,
                        });
                        setEditingProfile(false);
                        setProfileMessage("");
                      }}
                      className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={onSaveProfile}
                      disabled={savingProfile}
                      className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
                    >
                      {savingProfile ? "Enregistrement…" : "Enregistrer"}
                    </button>
                  </>
                )}

                {profileMessage && (
                  <span className="text-xs text-neutral-600">
                    {profileMessage}
                  </span>
                )}
              </div>
            </>
          )}
        </Card>

        {/* Options */}
        <Card title="Options">
          <OptionsBloc />
        </Card>

        {/* Paiement */}
        <Card
          title="Paiement"
          right={
            payInfos.receipt && (
              <a
                href={payInfos.receipt}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
              >
                Télécharger mon reçu Stripe
              </a>
            )
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Récap Tickrace */}
            <div className="rounded-xl ring-1 ring-neutral-200 p-4 bg-neutral-50">
              <div className="text-sm font-semibold text-neutral-700 mb-2">
                Récapitulatif Tickrace
              </div>
              <Row label="Montant inscription (base)">
                {euros(totalCoureur)}
              </Row>
              <Row label="Total options (estimé)">
                {euros(totalOptions)}
              </Row>
              <Row label="Total théorique">{euros(totalTheo)}</Row>
              <Row label="Statut">{insc.statut || "—"}</Row>
              <Row label="Référence Tickrace">
                {insc.paiement_trace_id || "—"}
              </Row>
            </div>

            {/* Stripe simplifié */}
            <div className="rounded-xl ring-1 ring-neutral-200 p-4 bg-neutral-50">
              <div className="text-sm font-semibold text-neutral-700 mb-2">
                Transactions Stripe
              </div>
              {mainPayment ? (
                <>
                  <Row label="Payment Intent ID">
                    {mainPayment.stripe_payment_intent_id || "—"}
                  </Row>
                  <Row label="Session Stripe">
                    {mainPayment.stripe_session_id ||
                      mainPayment.trace_id ||
                      "—"}
                  </Row>
                  <Row label="Montant (Stripe)">
                    {stripeAmountDisplay}
                  </Row>
                  <Row label="Statut Stripe">
                    <Pill color={stripeStatusColor}>
                      {mainPayment.status || "—"}
                    </Pill>
                  </Row>
                  <Row label="Reçu Stripe">
                    {mainPayment.receipt_url ? (
                      <a
                        href={mainPayment.receipt_url}
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
                  Aucune transaction Stripe accessible pour cette inscription.
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Remboursement & annulation */}
        <Card title="Remboursement & annulation">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Simulation */}
            <div className="rounded-xl ring-1 ring-neutral-200 p-4 bg-neutral-50">
              <div className="text-sm font-semibold text-neutral-700 mb-2">
                Simulation de remboursement (indicatif)
              </div>
              <CalculCreditAnnulation
                inscription={insc}
                format={format}
                paiements={payInfos.paiements}
                totalTheo={totalTheo}
              />
            </div>

            {/* Annulation */}
            <div className="rounded-xl ring-1 ring-neutral-200 p-4 bg-neutral-50">
              <div className="text-sm font-semibold text-neutral-700 mb-2">
                Annuler mon inscription
              </div>
              {canCancel ? (
                <>
                  <p className="text-xs text-neutral-600 mb-2">
                    Vous pouvez annuler votre inscription. La politique
                    d’annulation sera appliquée automatiquement.
                  </p>

                  <label className="text-xs font-medium text-neutral-700">
                    Motif d’annulation
                  </label>
                  <select
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    disabled={annulating || isCanceled}
                  >
                    <option value="">Sélectionner un motif…</option>
                    {CANCEL_REASONS.map((r) => (
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
                    disabled={annulating || isCanceled}
                  />

                  {cancelError && (
                    <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      {cancelError}
                    </div>
                  )}

                  <button
                    onClick={onAnnuler}
                    disabled={annulating || isCanceled}
                    className="mt-3 w-full rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-70"
                  >
                    {annulating
                      ? "Annulation…"
                      : isCanceled
                      ? "Inscription déjà annulée"
                      : "Annuler mon inscription"}
                  </button>

                  <p className="mt-3 text-[11px] text-neutral-500">
                    Rappel de la politique d’annulation :
                    <br />
                    • <b>J-30+</b> : 90% &nbsp;• <b>J-15–29</b> : 70% &nbsp;•
                    <b> J-7–14</b> : 50% &nbsp;• <b>J-3–6</b> : 30% &nbsp;•
                    <b> J-0–2</b> : 0%
                  </p>
                </>
              ) : (
                <p className="text-sm text-neutral-500">
                  Cette inscription est déjà annulée ou n’est plus annulable en
                  ligne.
                </p>
              )}
            </div>
          </div>

          {/* Historique remboursement */}
          <div className="mt-6 rounded-xl ring-1 ring-neutral-200 p-4 bg-neutral-50">
            <div className="text-sm font-semibold text-neutral-700 mb-2">
              Historique de remboursement
            </div>
            {refund ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <Row label="Demandé le">
                    {formatDateTime(refund.requested_at)}
                  </Row>
                  <Row label="Traitée le">
                    {refund.processed_at
                      ? formatDateTime(refund.processed_at)
                      : "—"}
                  </Row>
                  <Row label="Politique appliquée">
                    {refund.policy_tier || "—"}{" "}
                    {refund.percent != null ? `(${refund.percent} %)` : ""}
                  </Row>
                  <Row label="Statut">{refund.status || "—"}</Row>
                  {refund.reason && (
                    <Row label="Raison">{refund.reason}</Row>
                  )}
                </div>
                <div>
                  <Row label="Montant total (paiement)">
                    {euros((refund.amount_total_cents || 0) / 100)}
                  </Row>
                  <Row label="Base remboursable">
                    {euros((refund.base_cents || 0) / 100)}
                  </Row>
                  <Row label="Part non remboursable">
                    {euros((refund.non_refundable_cents || 0) / 100)}
                  </Row>
                  <Row label="Montant remboursé">
                    {euros((refund.refund_cents || 0) / 100)}
                  </Row>
                </div>
              </div>
            ) : (
              <div className="text-sm text-neutral-500">
                Aucun remboursement enregistré pour cette inscription.
              </div>
            )}
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
        </div>
      </div>
    </div>
  );
}

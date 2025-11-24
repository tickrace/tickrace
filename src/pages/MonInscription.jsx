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
        <div className="p-5 border-b border-neutral-200 flex items-center justify-between gap-4">
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
      // 1) Inscription brute
      const { data: ins, error: insErr } = await supabase
        .from("inscriptions")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (insErr) throw insErr;
      if (!ins) throw new Error("Inscription introuvable.");

      setInsc(ins);

      // 2) Course & format (requêtes séparées pour éviter les soucis de FK)
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

      // 3) Options – double compat :
      // (A) inscription_options + format_options
      // (B) inscriptions_options + options_catalogue
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

      // 4) Paiements potentiels (individuels + groupés)
      const [{ data: paysDirect }, { data: paysGroup }] = await Promise.all([
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

      const paiements = [...(paysDirect || []), ...(paysGroup || [])];
      const receipt =
        paiements.find((p) => !!p.receipt_url)?.receipt_url || null;
      setPayInfos({ paiements, receipt });

      // 5) Dernier remboursement (si existant)
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

    const ok = window.confirm(
      "Confirmer l’annulation ?\n\nNous allons calculer automatiquement votre crédit d’annulation et, si possible, rembourser le paiement associé."
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
            reason: "Annulation par le coureur depuis MonInscription",
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
                      (o?.prix_unitaire_cents ?? o?.option?.price_cents ?? 0) /
                      100;
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
  const canCancel = !isCanceled; // tu peux ajouter des règles de délai ici

  // Totaux côté "logique Tickrace"
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
          {/* Image de course supprimée à ta demande */}
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
            <div className="flex flex-wrap gap-2 justify-end">
              {insc.course_id && (
                <Link
                  to={`/courses/${insc.course_id}`}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                >
                  Voir la page épreuve
                </Link>
              )}
              {canCancel && (
                <button
                  onClick={onAnnuler}
                  disabled={annulating}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-70"
                >
                  {annulating ? "Annulation…" : "Annuler mon inscription"}
                </button>
              )}
            </div>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              {insc.team_name && (
                <Row label="Équipe">{insc.team_name}</Row>
              )}
            </div>

            <div className="rounded-xl ring-1 ring-neutral-200 p-4 bg-neutral-50">
              <div className="text-sm font-semibold text-neutral-700 mb-2">
                Mon profil
              </div>
              <Row label="Nom / Prénom">
                {insc.nom || "—"} {insc.prenom || ""}
              </Row>
              <Row label="Email">{insc.email || "—"}</Row>
              <Row label="Téléphone">{insc.telephone || "—"}</Row>
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
              <div className="mt-3 flex gap-2">
                <Link
                  to={`/inscription/${id}/modifier`}
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-neutral-50"
                >
                  Mettre à jour mes infos
                </Link>
              </div>
            </div>
          </div>
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
              <Row label="Total théorique">
                {euros(totalTheo)}
              </Row>
              <Row label="Statut">{insc.statut || "—"}</Row>
            </div>
            <div className="rounded-xl ring-1 ring-neutral-200 p-4 bg-neutral-50">
              <div className="text-sm font-semibold text-neutral-700 mb-2">
                Transactions Stripe
              </div>
              {payInfos.paiements?.length ? (
                <div className="rounded-xl ring-1 ring-neutral-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50">
                      <tr className="text-left">
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Montant</th>
                        <th className="px-3 py-2">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payInfos.paiements.map((p) => {
                        const status = (p.status || "").toLowerCase();

                        let color = "neutral";
                        if (
                          status.includes("paye") ||
                          status.includes("payé") ||
                          status === "succeeded" ||
                          status === "paid"
                        ) {
                          color = "green";
                        } else if (
                          status.includes("rembours") ||
                          status.includes("refund")
                        ) {
                          color = "blue";
                        } else if (
                          status.includes("pend") ||
                          status === "open"
                        ) {
                          color = "orange";
                        } else if (status) {
                          color = "red";
                        }

                        const amount =
                          p.amount_total != null
                            ? euros(p.amount_total / 100)
                            : p.total_amount_cents != null
                            ? euros(p.total_amount_cents / 100)
                            : p.montant_total != null
                            ? euros(p.montant_total)
                            : "—";

                        return (
                          <tr
                            key={p.id}
                            className="border-t border-neutral-200"
                          >
                            <td className="px-3 py-2">
                              {formatDateTime(p.created_at)}
                            </td>
                            <td className="px-3 py-2">{amount}</td>
                            <td className="px-3 py-2">
                              <Pill color={color}>{p.status || "—"}</Pill>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-neutral-500">
                  Aucune transaction affichée.
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Simulation de remboursement AVANT annulation */}
        <CalculCreditAnnulation
          inscriptionId={id}
          isCanceled={isCanceled}
        />

        {/* Remboursement (table remboursements) */}
        <Card title="Remboursement / annulation">
          {refund ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl ring-1 ring-neutral-200 p-4 bg-neutral-50">
                <div className="text-sm font-semibold text-neutral-700 mb-2">
                  Détails de la demande
                </div>
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
              <div className="rounded-xl ring-1 ring-neutral-200 p-4 bg-neutral-50">
                <div className="text-sm font-semibold text-neutral-700 mb-2">
                  Montants
                </div>
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
              {!isCanceled && (
                <>
                  {" "}
                  Vous pouvez utiliser le bouton{" "}
                  <strong>“Annuler mon inscription”</strong> ci-dessus.
                </>
              )}
            </div>
          )}
        </Card>

        {/* Actions bas de page */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            ← Retour
          </button>
          {canCancel && (
            <button
              onClick={onAnnuler}
              disabled={annulating}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-70"
            >
              {annulating ? "Annulation…" : "Annuler mon inscription"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

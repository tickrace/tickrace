// src/pages/MonInscription.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

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
  const [payInfos, setPayInfos] = useState({ paiements: [], receipt: null });
  const [refunds, setRefunds] = useState([]);
  const [annulating, setAnnulating] = useState(false);
  const [error, setError] = useState("");

  // Simulation de remboursement (avant clic sur "Annuler")
  const [refundPreview, setRefundPreview] = useState(null);
  const [refundPreviewLoading, setRefundPreviewLoading] = useState(false);
  const [refundPreviewError, setRefundPreviewError] = useState("");

  const statutColor = useMemo(() => {
    const s = (insc?.statut || "").toLowerCase();
    if (s.includes("valid") || s.includes("pay")) return "green";
    if (s.includes("attente") || s.includes("wait")) return "orange";
    if (s.includes("annul")) return "red";
    return "neutral";
  }, [insc?.statut]);

  const isCanceled = useMemo(() => {
    return (
      !!insc?.cancelled_at ||
      (insc?.statut || "").toLowerCase().includes("annul")
    );
  }, [insc]);

  async function fetchRefundPreview(inscriptionId) {
    if (!inscriptionId) return;
    setRefundPreviewLoading(true);
    setRefundPreviewError("");
    try {
      const { data, error } = await supabase.rpc(
        "calculer_credit_annulation",
        { inscription_id: inscriptionId }
      );
      if (error) throw error;
      setRefundPreview(data);
    } catch (e) {
      console.error("REFUND_PREVIEW_ERROR", e);
      setRefundPreviewError(
        e?.message || "Impossible de calculer le remboursement estimé."
      );
      setRefundPreview(null);
    } finally {
      setRefundPreviewLoading(false);
    }
  }

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      // 1) Inscription + relations
      const { data: ins, error: insErr } = await supabase
        .from("inscriptions")
        .select(
          `
          *,
          course:courses!inscriptions_course_id_fkey(
            id, nom, lieu, departement, image_url
          ),
          format:formats!inscriptions_format_id_fkey(
            id, nom, date, heure_depart, distance_km, denivele_dplus, denivele_dmoins,
            type_epreuve, type_format, prix, prix_repas, prix_equipe, fuseau_horaire
          )
        `
        )
        .eq("id", id)
        .single();
      if (insErr) throw insErr;

      // 2) Options payantes (nouveau modèle : inscriptions_options + options_catalogue)
      const { data: options, error: optErr } = await supabase
        .from("inscriptions_options")
        .select(
          `
          id, quantity, prix_unitaire_cents, status, created_at,
          option:option_id(
            id, label, price_cents, description, image_url
          )
        `
        )
        .eq("inscription_id", id);

      if (optErr) {
        console.error("OPTIONS_LOAD_ERROR", optErr);
      }

      // 3) Paiements liés à cette inscription
      const { data: paysDirect } = await supabase
        .from("paiements")
        .select("*")
        .eq("inscription_id", id)
        .order("created_at", { ascending: false });

      const { data: paysGroup } = await supabase
        .from("paiements")
        .select("*")
        .contains("inscription_ids", [id])
        .order("created_at", { ascending: false });

      const paiements = [...(paysDirect || []), ...(paysGroup || [])];
      const receipt =
        paiements.find((p) => !!p.receipt_url)?.receipt_url || null;

      // 4) Remboursements déjà effectués / demandés
      const { data: refundsRows, error: refundsErr } = await supabase
        .from("remboursements")
        .select("*")
        .eq("inscription_id", id)
        .order("requested_at", { ascending: false });

      if (refundsErr) {
        console.error("REFUNDS_LOAD_ERROR", refundsErr);
      }

      setInsc({
        ...ins,
        options: options || [],
      });
      setPayInfos({ paiements, receipt });
      setRefunds(refundsRows || []);

      // 5) Simulation de remboursement (si inscription non annulée)
      const cancelled =
        !!ins.cancelled_at ||
        (ins.statut || "").toLowerCase().includes("annul");
      if (!cancelled) {
        await fetchRefundPreview(id);
      } else {
        setRefundPreview(null);
      }
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

  const onAnnuler = async () => {
    if (!insc || annulating) return;

    const ok = window.confirm(
      "Confirmer l’annulation ?\n\nLe remboursement sera calculé automatiquement selon la politique d’annulation en vigueur et déclenché sur votre moyen de paiement."
    );
    if (!ok) return;

    setAnnulating(true);
    setError("");

    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      const userId = sessionRes?.session?.user?.id ?? null;

      const { data, error: fnError } = await supabase.functions.invoke(
        "refund-inscription",
        {
          body: {
            inscription_id: id,
            user_id: userId,
          },
        }
      );

      if (fnError) {
        console.error("REFUND_FN_ERROR", fnError);
        alert(
          "Impossible d’annuler l’inscription : " +
            (fnError.message || "erreur inconnue")
        );
        return;
      }

      if (data?.error) {
        console.error("REFUND_FN_DATA_ERROR", data);
        alert(
          "Impossible d’annuler l’inscription : " +
            (data.message || data.error || "erreur inconnue")
        );
        return;
      }

      // Rechargement des infos (statut inscription, paiements, remboursements)
      await loadAll();

      alert(
        "Votre inscription a été annulée et le remboursement a été demandé sur votre carte."
      );
    } catch (e) {
      console.error("REFUND_CALL_FATAL", e);
      alert(
        "Impossible d’annuler l’inscription : " +
          (e?.message || "erreur inconnue")
      );
    } finally {
      setAnnulating(false);
    }
  };

  const OptionsBloc = () => {
    const opts = insc?.options || [];
    if (!opts.length)
      return (
        <div className="text-sm text-neutral-500">Aucune option sélectionnée.</div>
      );

    return (
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
            {opts.map((o) => {
              const label = o?.option?.label || "Option";
              const unit =
                (o?.prix_unitaire_cents ?? o?.option?.price_cents ?? 0) / 100;
              const q = o?.quantity ?? 1;
              const total = unit * q;
              const status = (o?.status || "pending").toLowerCase();
              let color = "orange";
              if (status === "confirmed" || status === "succeeded") color = "green";
              if (status === "canceled" || status === "refunded") color = "red";

              return (
                <tr key={o.id} className="border-t border-neutral-200">
                  <td className="px-3 py-2">{label}</td>
                  <td className="px-3 py-2">{q}</td>
                  <td className="px-3 py-2">{euros(unit)}</td>
                  <td className="px-3 py-2">{euros(total)}</td>
                  <td className="px-3 py-2">
                    <Pill color={color}>{o.status || "pending"}</Pill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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

  const course = insc.course;
  const format = insc.format;
  const tz = format?.fuseau_horaire || "Europe/Paris";

  // Total théorique payé (inscription + options) en € si disponible
  const baseInscription = format?.prix != null ? Number(format.prix) : 0;
  const totalOptionsPaid = (insc.options || []).reduce((acc, o) => {
    const unit =
      (o?.prix_unitaire_cents ?? o?.option?.price_cents ?? 0) / 100;
    const q = o?.quantity ?? 1;
    return acc + unit * q;
  }, 0);
  const totalTheo = baseInscription + totalOptionsPaid;

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
            <Pill color={statutColor}>{insc.statut || "—"}</Pill>
            {isCanceled && <Pill color="red">Annulée</Pill>}
            {insc.is_waitlist && <Pill color="blue">Liste d’attente</Pill>}
            {refunds.length > 0 && (
              <Pill color="blue">
                {refunds[0].status === "succeeded"
                  ? "Remboursement effectué"
                  : "Remboursement en cours"}
              </Pill>
            )}
          </div>
          {course?.image_url && (
            <img
              src={course.image_url}
              alt={course?.nom || "Épreuve"}
              className="w-full max-w-3xl rounded-2xl ring-1 ring-neutral-200 object-cover"
            />
          )}
        </div>
      </section>

      {/* Body */}
      <div className="mx-auto max-w-5xl px-4 py-8 grid gap-8">
        {/* Épreuve / Format */}
        <Card
          title={course?.nom || "Épreuve"}
          subtitle={
            course
              ? `${course.lieu || "—"} ${
                  course.departement ? `• ${course.departement}` : ""
                }`
              : "—"
          }
          right={
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/courses/${insc.course_id}`}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              >
                Voir la page épreuve
              </Link>
              {!isCanceled && (
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
              <Row label="Licence">{insc.numero_licence || "—"}</Row>
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
        <Card title="Options payantes">
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
                Télécharger mon reçu
              </a>
            )
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl ring-1 ring-neutral-200 p-4 bg-neutral-50">
              <div className="text-sm font-semibold text-neutral-700 mb-2">
                Récapitulatif
              </div>
              <Row label="Sous-total inscription">
                {euros(baseInscription)}
              </Row>
              <Row label="Options payantes">
                {euros(totalOptionsPaid)}
              </Row>
              <Row label="Total estimé payé">
                {euros(totalTheo)}
              </Row>
              <Row label="Statut">{insc.statut || "—"}</Row>
            </div>
            <div className="rounded-xl ring-1 ring-neutral-200 p-4 bg-neutral-50">
              <div className="text-sm font-semibold text-neutral-700 mb-2">
                Transactions
              </div>
              {payInfos.paiements?.length ? (
                <div className="rounded-xl ring-1 ring-neutral-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50">
                      <tr className="text-left">
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Total</th>
                        <th className="px-3 py-2">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payInfos.paiements.map((p) => {
                        const status = (p.status || "").toLowerCase();
                        let color = "orange";
                        if (status === "paye" || status === "succeeded" || status === "paid") {
                          color = "green";
                        } else if (
                          status === "failed" ||
                          status === "canceled" ||
                          status === "refunded"
                        ) {
                          color = "red";
                        }
                        const amount =
                          p.amount_total != null
                            ? p.amount_total / 100
                            : p.total_amount_cents != null
                            ? p.total_amount_cents / 100
                            : p.montant_total != null
                            ? Number(p.montant_total)
                            : null;

                        return (
                          <tr key={p.id} className="border-t border-neutral-200">
                            <td className="px-3 py-2">
                              {formatDateTime(p.created_at)}
                            </td>
                            <td className="px-3 py-2">{euros(amount)}</td>
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
        <Card title="Simulation de remboursement (indicatif)">
          {isCanceled ? (
            <div className="text-sm text-neutral-600">
              Cette inscription est déjà annulée. Le remboursement a été calculé
              lors de l’annulation.
            </div>
          ) : refundPreviewLoading ? (
            <div className="text-sm text-neutral-500">
              Calcul du remboursement estimé…
            </div>
          ) : refundPreviewError ? (
            <div className="text-sm text-rose-700">
              {refundPreviewError}
            </div>
          ) : !refundPreview ? (
            <div className="text-sm text-neutral-500">
              Aucun remboursement n’est prévu pour cette inscription selon la
              politique actuelle.
            </div>
          ) : (() => {
              const baseCents = Number(
                refundPreview.base_cents ??
                  refundPreview.amount_total_cents ??
                  0
              );
              const refundCents = Number(refundPreview.refund_cents ?? 0);
              const nonRefCents = Number(
                refundPreview.non_refundable_cents ??
                  baseCents - refundCents
              );
              const percent = Number(refundPreview.percent ?? 0);
              const policyTier = refundPreview.policy_tier || "—";
              const joursAvant =
                refundPreview.jours_avant_course ?? null;

              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="rounded-xl ring-1 ring-neutral-200 p-4 bg-neutral-50">
                    <div className="text-sm font-semibold text-neutral-700 mb-2">
                      Politique appliquée
                    </div>
                    {joursAvant != null && (
                      <Row label="Jours avant la course">
                        {joursAvant}
                      </Row>
                    )}
                    <Row label="Palier">
                      {policyTier} ({percent}% remboursé)
                    </Row>
                    <Row label="Montant payé (base)">
                      {euros(baseCents / 100)}
                    </Row>
                  </div>
                  <div className="rounded-xl ring-1 ring-neutral-200 p-4 bg-neutral-50">
                    <div className="text-sm font-semibold text-neutral-700 mb-2">
                      Détail du remboursement estimé
                    </div>
                    <Row label="Part remboursée">
                      {euros(refundCents / 100)}
                    </Row>
                    <Row label="Part non remboursable">
                      {euros(nonRefCents / 100)}
                    </Row>
                    <Row label="Taux appliqué">
                      {percent} %
                    </Row>
                  </div>
                  <div className="sm:col-span-2 text-xs text-neutral-500">
                    Ce calcul est indicatif et basé sur la date actuelle et la
                    politique d’annulation configurée par l’organisation. Le
                    remboursement sera effectivement déclenché{" "}
                    <strong>uniquement</strong> si vous cliquez sur
                    “Annuler mon inscription”.
                  </div>
                </div>
              );
            })()}
        </Card>

        {/* Actions bas de page */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            ← Retour
          </button>
          {!isCanceled && (
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

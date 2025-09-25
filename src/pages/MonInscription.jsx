// src/pages/MonInscription.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";
import RefundModal from "../components/RefundModal";

function eur(cents) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

// Seuls ces champs seront mis à jour côté DB
const MODIFIABLE_FIELDS = [
  "nom","prenom","genre","date_naissance","nationalite","email","telephone","adresse",
  "adresse_complement","code_postal","ville","pays","club","justificatif_type",
  "numero_licence","contact_urgence_nom","contact_urgence_telephone","pps_identifier",
  "apparaitre_resultats",
];

export default function MonInscription() {
  const { id } = useParams();
  const [inscription, setInscription] = useState(null);
  const [group, setGroup] = useState(null);
  const [teammates, setTeammates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  const [openCancelModal, setOpenCancelModal] = useState(false);

  // Bandeau de confirmation après annulation
  const [cancelMsg, setCancelMsg] = useState(null);

  // Devis pour le libellé dynamique
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quote, setQuote] = useState(null);
  const [quoteErr, setQuoteErr] = useState(null);

  // 1) Charger l'inscription + équipe
  useEffect(() => {
    let abort = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("inscriptions")
        .select("*, groupe:inscriptions_groupes(id, nom_groupe, team_size, statut)")
        .eq("id", id)
        .single();

      if (!abort) {
        if (!error && data) {
          setInscription(data);

          if (data.groupe_id) {
            const [{ data: grp }, { data: mates }] = await Promise.all([
              supabase
                .from("inscriptions_groupes")
                .select("id, nom_groupe, team_size, statut")
                .eq("id", data.groupe_id)
                .maybeSingle(),
              supabase
                .from("inscriptions")
                .select("id, nom, prenom, email, statut")
                .eq("groupe_id", data.groupe_id)
                .order("created_at", { ascending: true }),
            ]);
            setGroup(grp || null);
            setTeammates(Array.isArray(mates) ? mates : []);
          } else {
            setGroup(null);
            setTeammates([]);
          }
        }
        setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [id]);

  // 2) Quote pour le bouton
  useEffect(() => {
    let abort = false;
    if (!id) return;
    (async () => {
      setQuoteLoading(true);
      setQuoteErr(null);
      try {
        const { data, error } = await supabase.functions.invoke("refunds", {
          body: { inscription_id: id, action: "quote" },
        });
        if (!abort) {
          if (error) throw error;
          setQuote(data?.quote ?? null);
        }
      } catch (e) {
        if (!abort) setQuoteErr(e?.message ?? String(e));
      } finally {
        if (!abort) setQuoteLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [id]);

  // 3) Édition
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setInscription((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSave = async () => {
    if (!inscription) return;
    try {
      setSaving(true);
      setSaveMsg(null);
      const payload = {};
      for (const key of MODIFIABLE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(inscription, key)) payload[key] = inscription[key];
      }
      const { error } = await supabase.from("inscriptions").update(payload).eq("id", id);
      if (error) throw error;
      setSaveMsg({ type: "success", text: "Modifications enregistrées ✅" });
    } catch (e) {
      setSaveMsg({ type: "error", text: e?.message ?? String(e) });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 4000);
    }
  };

  // 4) États d'annulation/ remboursements
  const statut = inscription?.statut || "";
  const isAlreadyCancelled = useMemo(() => {
    const done = new Set(["annulé","annulée","remboursé","remboursée_partiellement","remboursée_totalement"]);
    return done.has(statut);
  }, [statut]);

  const canCancel = inscription && !isAlreadyCancelled;
  const isLocked = isAlreadyCancelled;

  // Libellé dynamique du bouton d’annulation
  const cancelLabel = useMemo(() => {
    if (quoteLoading) return "Calcul du remboursement…";
    if (quoteErr) return "Annuler mon inscription";
    if (!quote) return "Annuler mon inscription";
    if (quote.percent === 0 || quote.refund_cents <= 0) return "Annuler — aucun remboursement (barème)";
    return `Annuler — recevoir ~${eur(quote.refund_cents)}`;
  }, [quoteLoading, quoteErr, quote]);

  // Badge statut
  const statusBadge = useMemo(() => {
    const base = "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold";
    switch (statut) {
      case "remboursée_totalement": return <span className={`${base} bg-emerald-100 text-emerald-800`}>Remboursée totalement</span>;
      case "remboursée_partiellement": return <span className={`${base} bg-amber-100 text-amber-800`}>Remboursée partiellement</span>;
      case "annulée":
      case "annulé":
      case "remboursé": return <span className={`${base} bg-rose-100 text-rose-800`}>Annulée</span>;
      default: return <span className={`${base} bg-neutral-200 text-neutral-900`}>Active</span>;
    }
  }, [statut]);

  // Handler appelé par le modal après succès → affiche bandeau + met à jour le statut localement
  function handleRefundSuccess(data) {
    // data peut contenir: { ok:true, refund:{refund_cents, percent, ...}, new_status, paiement_id, ... }
    const refundCents = data?.refund?.refund_cents ?? data?.quote?.refund_cents ?? 0;
    const newStatus = data?.new_status || "annulé";
    setCancelMsg({
      text: `Votre inscription a été annulée. Un remboursement estimé de ${eur(refundCents)} sera traité sous peu.`,
    });
    setInscription((prev) => prev ? { ...prev, statut: newStatus, cancelled_at: new Date().toISOString() } : prev);
  }

  if (loading || !inscription) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-neutral-600">Chargement…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* HERO */}
      <header className="px-4 sm:px-6 md:px-8 pt-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-neutral-900 text-white ring-1 ring-black/10 px-3 py-1 text-xs">
          • Espace coureur
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">
          Mon <span className="text-orange-500">inscription</span>
        </h1>
        <p className="mt-2 text-neutral-600 max-w-2xl">
          Mettez à jour vos informations, choisissez votre visibilité résultats et gérez une éventuelle annulation —{" "}
          <span className="font-semibold">simple et transparent</span>.
        </p>
      </header>

      <div className="px-4 sm:px-6 md:px-8 pb-10">
        {/* Bandeau confirmation annulation */}
        {cancelMsg && (
          <div className="mt-6 mb-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 p-3 text-sm">
            {cancelMsg.text}
          </div>
        )}

        {/* Message de sauvegarde */}
        {saveMsg && (
          <div
            className={`mt-6 mb-4 rounded-xl border p-3 text-sm ${
              saveMsg.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {saveMsg.text}
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white shadow-sm">
          {/* En-tête statut */}
          <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-4 sm:px-6 py-4">
            <div className="text-sm text-neutral-600">Statut de l’inscription</div>
            {statusBadge}
          </div>

          {/* Contexte équipe */}
          {inscription.groupe_id && (
            <div className="px-4 sm:px-6 py-4 border-b border-neutral-200">
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-neutral-600">Inscription d’équipe</div>
                    <div className="text-base font-semibold">
                      {group?.nom_groupe || inscription?.groupe?.nom_groupe || "Équipe"}
                    </div>
                  </div>
                  <div className="text-xs px-2 py-1 rounded-full bg-neutral-200">
                    {group?.team_size || inscription?.groupe?.team_size || teammates.length} membres
                  </div>
                </div>
                {teammates?.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-neutral-600 mb-1">Membres</div>
                    <ul className="grid sm:grid-cols-2 gap-2">
                      {teammates.map((m) => (
                        <li
                          key={m.id}
                          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium">
                              {m.nom} {m.prenom}
                            </div>
                            <div className="text-neutral-500 text-xs">{m.email || "—"}</div>
                          </div>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200">
                            {m.statut}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Formulaire */}
          <div className="px-4 sm:px-6 py-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { name: "nom", label: "Nom" },
                { name: "prenom", label: "Prénom" },
                { name: "genre", label: "Genre" },
                { name: "date_naissance", label: "Date de naissance", type: "date" },
                { name: "nationalite", label: "Nationalité" },
                { name: "email", label: "Email", type: "email" },
                { name: "telephone", label: "Téléphone" },
                { name: "adresse", label: "Adresse", full: true },
                { name: "adresse_complement", label: "Complément d'adresse", full: true },
                { name: "code_postal", label: "Code postal" },
                { name: "ville", label: "Ville" },
                { name: "pays", label: "Pays" },
                { name: "club", label: "Club (facultatif)", full: true },
                { name: "justificatif_type", label: "Justificatif (licence / pps)" },
                { name: "numero_licence", label: "N° de licence" },
                { name: "contact_urgence_nom", label: "Contact d'urgence - Nom", full: true },
                { name: "contact_urgence_telephone", label: "Contact d'urgence - Téléphone" },
                { name: "pps_identifier", label: "Identifiant PPS" },
              ].map((f) => (
                <label key={f.name} className={`flex flex-col ${f.full ? "sm:col-span-2" : ""}`}>
                  <span className="text-xs font-semibold text-neutral-600">{f.label}</span>
                  <input
                    type={f.type || "text"}
                    name={f.name}
                    value={inscription[f.name] || ""}
                    onChange={handleChange}
                    disabled={isLocked}
                    className="mt-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 disabled:bg-neutral-50"
                    placeholder={f.label}
                  />
                </label>
              ))}

              {/* Visibilité résultats */}
              <div className="sm:col-span-2">
                <label className="inline-flex items-center gap-2 text-sm select-none">
                  <input
                    type="checkbox"
                    name="apparaitre_resultats"
                    checked={!!inscription.apparaitre_resultats}
                    onChange={handleChange}
                    disabled={isLocked}
                    className="h-4 w-4 rounded border-neutral-300 accent-orange-500"
                  />
                  <span className="text-neutral-800">J’accepte d’apparaître dans les résultats officiels</span>
                </label>
                <p className="mt-1 text-xs text-neutral-500">
                  Conformément à la réglementation FFA, vous pouvez choisir d’apparaître ou non.
                </p>
              </div>
            </div>

            {/* Barème de remboursement */}
            <div className="mt-6 rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-700">
              <b>Barème de remboursement :</b> &gt;30j : 90% • 15–29j : 50% • 7–14j : 25% • &lt;7j : 0%
              <br />
              Calculé sur le montant payé, <i>déduction faite des frais non remboursables</i> (Stripe + TickRace).
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center">
              <button
                onClick={handleSave}
                className={`inline-flex justify-center items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                  isLocked ? "bg-neutral-400 cursor-not-allowed" : "bg-orange-500 hover:brightness-110"
                }`}
                disabled={isLocked || saving}
              >
                {saving ? "Enregistrement…" : "Enregistrer les modifications"}
              </button>

              {inscription && !isAlreadyCancelled ? (
                <button
                  onClick={() => setOpenCancelModal(true)}
                  className={`inline-flex justify-center items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-neutral-900 border ${
                    quote && (quote.percent === 0 || quote.refund_cents <= 0)
                      ? "bg-neutral-100 border-neutral-200 cursor-not-allowed"
                      : "bg-white border-neutral-300 hover:bg-neutral-50"
                  }`}
                  disabled={quoteLoading || (quote && (quote.percent === 0 || quote.refund_cents <= 0))}
                  title={quote && quote.percent === 0 ? "Aucun remboursement à ce stade" : ""}
                >
                  {quoteLoading
                    ? "Calcul du remboursement…"
                    : quote
                    ? quote.percent === 0 || quote.refund_cents <= 0
                      ? "Annuler — aucun remboursement (barème)"
                      : `Annuler — recevoir ~${eur(quote.refund_cents)}`
                    : "Annuler mon inscription"}
                </button>
              ) : (
                <p className="text-rose-700 font-medium">Cette inscription est déjà {statut}.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      <RefundModal
        inscriptionId={id}
        open={openCancelModal}
        onClose={() => setOpenCancelModal(false)}
        onSuccess={handleRefundSuccess}
      />
    </div>
  );
}

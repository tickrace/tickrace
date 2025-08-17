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
  "nom",
  "prenom",
  "genre",
  "date_naissance",
  "nationalite",
  "email",
  "telephone",
  "adresse",
  "adresse_complement",
  "code_postal",
  "ville",
  "pays",
  "club",
  "justificatif_type",
  "numero_licence",
  "contact_urgence_nom",
  "contact_urgence_telephone",
  "pps_identifier",
  "apparaitre_resultats",
  "nombre_repas",
];

export default function MonInscription() {
  const { id } = useParams();
  const [inscription, setInscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  const [openCancelModal, setOpenCancelModal] = useState(false);

  // Devis (quote) pour le bouton dynamique
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quote, setQuote] = useState(null);
  const [quoteErr, setQuoteErr] = useState(null);

  // 1) Charger l'inscription
  useEffect(() => {
    let abort = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("inscriptions")
        .select("*")
        .eq("id", id)
        .single();
      if (!abort) {
        if (!error && data) setInscription(data);
        setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [id]);

  // 2) Récupérer un devis (quote) pour afficher le montant estimé sur le bouton
  useEffect(() => {
    let abort = false;
    if (!id) return;
    (async () => {
      setQuoteLoading(true);
      setQuoteErr(null);
      try {
        const { data, error } = await supabase.functions.invoke("refunds", {
          body: { inscription_id: id, action: "quote" }
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

  // 3) Édition des champs
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setInscription((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSave = async () => {
    if (!inscription) return;
    try {
      setSaving(true);
      setSaveMsg(null);
      // Payload sécurisé: uniquement les champs autorisés
      const payload = {};
      for (const key of MODIFIABLE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(inscription, key)) {
          payload[key] = inscription[key];
        }
      }
      const { error } = await supabase
        .from("inscriptions")
        .update(payload)
        .eq("id", id);
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
    // Couvre anciens et nouveaux statuts
    const doneStatuses = new Set([
      "annulé",
      "remboursé",
      "annulée",
      "remboursée_partiellement",
      "remboursée_totalement",
    ]);
    return doneStatuses.has(statut);
  }, [statut]);

  const canCancel = inscription && !isAlreadyCancelled;
  const isLocked = isAlreadyCancelled; // verrou inputs si annulée/remboursée

  // Libellé dynamique du bouton d’annulation
  const cancelLabel = useMemo(() => {
    if (quoteLoading) return "Calcul du remboursement…";
    if (quoteErr) return "Annuler mon inscription";
    if (!quote) return "Annuler mon inscription";

    if (quote.percent === 0 || quote.refund_cents <= 0) {
      return "Annuler — aucun remboursement (barème)";
    }
    return `Annuler — recevoir ~${eur(quote.refund_cents)}`;
  }, [quoteLoading, quoteErr, quote]);

  // Badge statut
  const statusBadge = useMemo(() => {
    const base = "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold";
    switch (statut) {
      case "remboursée_totalement":
        return <span className={`${base} bg-green-100 text-green-800`}>Remboursée totalement</span>;
      case "remboursée_partiellement":
        return <span className={`${base} bg-amber-100 text-amber-800`}>Remboursée partiellement</span>;
      case "annulée":
      case "annulé":
      case "remboursé":
        return <span className={`${base} bg-red-100 text-red-800`}>Annulée</span>;
      default:
        return <span className={`${base} bg-emerald-100 text-emerald-800`}>Active</span>;
    }
  }, [statut]);

  if (loading || !inscription) return <p className="p-6">Chargement...</p>;

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-md rounded">
      <h1 className="text-3xl font-bold mb-2 text-center text-gray-800">
        Mon inscription
      </h1>

      <div className="text-center mb-6">
        {statusBadge}
      </div>

      {/* Message de sauvegarde */}
      {saveMsg && (
        <div
          className={`mb-4 rounded border p-3 text-sm ${
            saveMsg.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {saveMsg.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {[
          "nom",
          "prenom",
          "genre",
          "date_naissance",
          "nationalite",
          "email",
          "telephone",
          "adresse",
          "adresse_complement",
          "code_postal",
          "ville",
          "pays",
          "club",
          "justificatif_type",
          "numero_licence",
          "contact_urgence_nom",
          "contact_urgence_telephone",
          "pps_identifier",
        ].map((field) => (
          <input
            key={field}
            type="text"
            name={field}
            value={inscription[field] || ""}
            onChange={handleChange}
            placeholder={field.replace(/_/g, " ").toUpperCase()}
            className="w-full p-3 border border-gray-300 rounded disabled:bg-gray-50"
            disabled={isLocked}
          />
        ))}

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            name="apparaitre_resultats"
            checked={!!inscription.apparaitre_resultats}
            onChange={handleChange}
            disabled={isLocked}
          />
          <label>Apparaître dans les résultats</label>
        </div>

        <input
          type="number"
          name="nombre_repas"
          value={inscription.nombre_repas || 0}
          onChange={handleChange}
          placeholder="Nombre de repas"
          className="w-full p-3 border border-gray-300 rounded disabled:bg-gray-50"
          disabled={isLocked}
        />
      </div>

      {/* Encadré barème (pédagogique) */}
      <div className="mt-4 text-sm text-gray-600">
        <b>Barème de remboursement :</b> &gt;30j : 90% • 15–29j : 50% • 7–14j : 25% • &lt;7j : 0%<br />
        Le remboursement s’applique sur le montant payé <i>déduction faite des frais non remboursables</i> (Stripe + Tickrace).
      </div>

      <div className="flex justify-center gap-3 mt-6">
        <button
          onClick={handleSave}
          className={`${
            isLocked
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          } text-white font-semibold px-6 py-3 rounded`}
          disabled={isLocked || saving}
        >
          {saving ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>

        {canCancel ? (
          <button
            onClick={() => setOpenCancelModal(true)}
            className={`${
              quote && (quote.percent === 0 || quote.refund_cents <= 0)
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-purple-600 hover:bg-purple-700"
            } text-white font-semibold px-6 py-3 rounded`}
            disabled={quoteLoading || (quote && (quote.percent === 0 || quote.refund_cents <= 0))}
            title={quote && quote.percent === 0 ? "Aucun remboursement à ce stade" : ""}
          >
            {cancelLabel}
          </button>
        ) : (
          <p className="text-red-600 font-semibold self-center">
            Cette inscription est déjà {statut}.
          </p>
        )}
      </div>

      {/* Modal Annulation + Remboursement */}
      <RefundModal
        inscriptionId={id}
        open={openCancelModal}
        onClose={() => setOpenCancelModal(false)}
        onSuccess={() => window.location.reload()}
      />
    </div>
  );
}

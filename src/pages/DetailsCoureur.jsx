// src/pages/DetailsCoureur.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  const map = {
    paye: "bg-emerald-100 text-emerald-800",
    "payé": "bg-emerald-100 text-emerald-800",
    en_attente: "bg-amber-100 text-amber-800",
    "en attente": "bg-amber-100 text-amber-800",
    annule: "bg-rose-100 text-rose-800",
    "annulé": "bg-rose-100 text-rose-800",
  };
  const txt = ["paye", "payé"].includes(s)
    ? "Payé"
    : ["annule", "annulé"].includes(s)
    ? "Annulé"
    : "En attente";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        map[s] || "bg-neutral-100 text-neutral-800"
      }`}
    >
      {txt}
    </span>
  );
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DetailsCoureur() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inscription, setInscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  useEffect(() => {
    const fetchInscription = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("inscriptions")
        .select("*")
        .eq("id", id)
        .single();

      if (!error && data) {
        setInscription(data);
      }
      setLoading(false);
    };

    if (id) fetchInscription();
  }, [id]);

  const handleChange = async (field, value) => {
    if (!inscription) return;
    const previous = inscription[field];

    setInscription((prev) => ({ ...prev, [field]: value }));
    setSavingField(field);

    const { error } = await supabase
      .from("inscriptions")
      .update({ [field]: value })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Erreur lors de la sauvegarde.");
      setInscription((prev) => ({ ...prev, [field]: previous }));
    }

    setSavingField(null);
  };

  const handleGetReceipt = async () => {
    if (!inscription?.paiement_trace_id) {
      alert("Aucun paiement_trace_id disponible pour cette inscription.");
      return;
    }
    setLoadingReceipt(true);
    setReceiptUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "get-receipt-url",
        {
          body: { trace_id: inscription.paiement_trace_id },
        }
      );
      if (error) {
        console.error("Erreur Edge Function :", error);
        alert("Impossible de récupérer le reçu.");
      } else if (data?.receipt_url) {
        setReceiptUrl(data.receipt_url);
      } else {
        alert("Aucun reçu trouvé.");
      }
    } catch (err) {
      console.error("Erreur :", err);
      alert("Erreur lors de la récupération du reçu.");
    } finally {
      setLoadingReceipt(false);
    }
  };

  if (loading || !inscription) {
    return <div className="p-6">Chargement...</div>;
  }

  // Champs à afficher (hors meta pure)
  const champsIdentite = [
    "nom",
    "prenom",
    "genre",
    "date_naissance",
    "nationalite",
    "email",
    "telephone",
    "club",
    "numero_licence",
  ];

  const champsAdresse = [
    "adresse",
    "adresse_complement",
    "code_postal",
    "ville",
    "pays",
  ];

  const champsUrgence = [
    "contact_urgence_nom",
    "contact_urgence_telephone",
    "justificatif_type",
    "apparaitre_resultats",
  ];

  const champsFederation = [
    "federation_code",
    "categorie_age_code",
    "categorie_age_label",
  ];

  const champsPaiement = [
    "statut",
    "dossard",
    "prix_total_coureur",
    "paiement_trace_id",
  ];

  const champsMeta = [
    "id",
    "course_id",
    "format_id",
    "created_at",
    "updated_at",
    "groupe_id",
    "member_of_group_id",
    "team_name",
  ];

  const renderInput = (champ, labelOverride) => {
    const value = inscription[champ];

    // bool
    if (champ === "apparaitre_resultats") {
      return (
        <div key={champ} className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-neutral-700">
            {labelOverride || champ.replace(/_/g, " ")}
          </span>
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => handleChange(champ, e.target.checked)}
          />
        </div>
      );
    }

    // statut (select)
    if (champ === "statut") {
      const v =
        (value || "").toLowerCase() === "en attente"
          ? "en_attente"
          : (value || "");
      return (
        <div key={champ} className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-neutral-700">
              Statut
            </span>
            <StatusBadge status={value} />
          </div>
          <select
            value={v}
            onChange={(e) => handleChange(champ, e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="en_attente">En attente</option>
            <option value="paye">Payé</option>
            <option value="annule">Annulé</option>
          </select>
        </div>
      );
    }

    // dates système en lecture seule
    if (champ === "created_at" || champ === "updated_at") {
      return (
        <div key={champ} className="space-y-1">
          <span className="text-sm font-medium text-neutral-700">
            {labelOverride || champ.replace(/_/g, " ")}
          </span>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
            {formatDateTime(value)}
          </div>
        </div>
      );
    }

    // dossard en number
    if (champ === "dossard") {
      return (
        <div key={champ} className="space-y-1">
          <span className="text-sm font-medium text-neutral-700">Dossard</span>
          <input
            type="number"
            value={value ?? ""}
            onChange={(e) => handleChange(champ, e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
            placeholder="—"
          />
        </div>
      );
    }

    // prix_total_coureur
    if (champ === "prix_total_coureur") {
      return (
        <div key={champ} className="space-y-1">
          <span className="text-sm font-medium text-neutral-700">
            Prix total coureur (€)
          </span>
          <input
            type="number"
            step="0.01"
            value={value ?? ""}
            onChange={(e) => handleChange(champ, e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      );
    }

    // champs fédération
    if (
      champ === "federation_code" ||
      champ === "categorie_age_code" ||
      champ === "categorie_age_label"
    ) {
      const labels = {
        federation_code: "Fédération",
        categorie_age_code: "Code catégorie",
        categorie_age_label: "Libellé catégorie",
      };
      return (
        <div key={champ} className="space-y-1">
          <span className="text-sm font-medium text-neutral-700">
            {labels[champ] || champ.replace(/_/g, " ")}
          </span>
          <input
            type="text"
            value={value || ""}
            onChange={(e) => handleChange(champ, e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      );
    }

    // champs meta en lecture seule (id, course_id, format_id, etc.)
    if (
      champ === "id" ||
      champ === "course_id" ||
      champ === "format_id" ||
      champ === "groupe_id" ||
      champ === "member_of_group_id"
    ) {
      return (
        <div key={champ} className="space-y-1">
          <span className="text-xs font-medium text-neutral-600 uppercase tracking-wide">
            {champ}
          </span>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-mono break-all">
            {value || "—"}
          </div>
        </div>
      );
    }

    // team_name en editable classique
    if (champ === "team_name") {
      return (
        <div key={champ} className="space-y-1">
          <span className="text-sm font-medium text-neutral-700">
            Nom d’équipe
          </span>
          <input
            type="text"
            value={value || ""}
            onChange={(e) => handleChange(champ, e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      );
    }

    // todo / default : input texte / date
    const isDateField = champ.includes("date");
    return (
      <div key={champ} className="space-y-1">
        <span className="text-sm font-medium text-neutral-700">
          {labelOverride || champ.replace(/_/g, " ")}
        </span>
        <input
          type={isDateField ? "date" : "text"}
          value={value || ""}
          onChange={(e) => handleChange(champ, e.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center rounded-xl border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
      >
        ← Retour
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {inscription.prenom} {inscription.nom}
          </h1>
          <p className="text-neutral-600 text-sm mt-1">
            ID inscription :{" "}
            <span className="font-mono text-xs">
              {inscription.id?.slice(0, 8)}…
            </span>
          </p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2">
          <StatusBadge status={inscription.statut} />
          {savingField && (
            <div className="text-xs text-neutral-500">
              Sauvegarde du champ <b>{savingField}</b>…
            </div>
          )}
        </div>
      </div>

      {/* Reçu Stripe */}
      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white px-4 py-3 flex flex-wrap items-center gap-4">
        <div className="text-sm text-neutral-700">
          Reçu Stripe lié au paiement (si disponible).
        </div>
        <button
          onClick={handleGetReceipt}
          disabled={loadingReceipt}
          className="inline-flex items-center rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
        >
          {loadingReceipt ? "Chargement..." : "Récupérer le reçu"}
        </button>
        {receiptUrl && (
          <a
            href={receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-600 underline"
          >
            Voir le reçu
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne 1 : Identité */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-800 mb-3">
              Identité
            </h2>
            <div className="space-y-3">
              {champsIdentite.map((c) => renderInput(c))}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-800 mb-3">
              Fédération / Catégorie
            </h2>
            <div className="space-y-3">
              {champsFederation.map((c) => renderInput(c))}
            </div>
          </div>
        </div>

        {/* Colonne 2 : Adresse + Urgence */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-800 mb-3">
              Coordonnées
            </h2>
            <div className="space-y-3">
              {champsAdresse.map((c) => renderInput(c))}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-800 mb-3">
              Urgence & résultats
            </h2>
            <div className="space-y-3">
              {champsUrgence.map((c) => renderInput(c))}
            </div>
          </div>
        </div>

        {/* Colonne 3 : Paiement + Meta */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-800 mb-3">
              Paiement & statut
            </h2>
            <div className="space-y-3">
              {champsPaiement.map((c) => renderInput(c))}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-800 mb-3">
              Métadonnées
            </h2>
            <div className="space-y-3">
              {champsMeta.map((c) => renderInput(c))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

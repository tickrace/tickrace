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
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState(null);

  const [receiptUrl, setReceiptUrl] = useState(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // 1) Inscription
        const { data: insc, error: iErr } = await supabase
          .from("inscriptions")
          .select("*")
          .eq("id", id)
          .single();

        if (iErr) {
          console.error("Erreur fetch inscription:", iErr);
          setLoading(false);
          return;
        }
        setInscription(insc);

        // 2) Paiement lié (si possible)
        // 2a. d'abord par inscription_id (cas simple)
        let pay = null;
        const { data: payBySingle, error: pErr1 } = await supabase
          .from("paiements")
          .select("*")
          .eq("inscription_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pErr1) {
          console.warn("Erreur fetch paiements (inscription_id):", pErr1);
        }

        if (payBySingle) {
          pay = payBySingle;
        } else {
          // 2b. si rien, on tente sur inscription_ids (tableau)
          const { data: payByArray, error: pErr2 } = await supabase
            .from("paiements")
            .select("*")
            .contains("inscription_ids", [id])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (pErr2) {
            console.warn("Erreur fetch paiements (inscription_ids):", pErr2);
          }

          if (payByArray) {
            pay = payByArray;
          }
        }

        if (pay) {
          setPayment(pay);
        }
      } catch (e) {
        console.error("Erreur fetch DetailsCoureur:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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

  // Essaye de déduire le meilleur trace_id possible pour la Edge Function
  const resolveTraceId = () => {
    if (!inscription && !payment) return null;

    // 1) priorité : ce qui est stocké côté inscription
    if (inscription?.paiement_trace_id) return inscription.paiement_trace_id;

    // 2) sinon, tente des champs classiques côté table paiements
    if (!payment) return null;

    return (
      payment.paiement_trace_id ||
      payment.trace_id ||
      payment.stripe_session_id ||
      payment.stripe_payment_intent_id ||
      null
    );
  };

  const handleGetReceipt = async () => {
    const traceId = resolveTraceId();

    if (!traceId) {
      alert(
        "Aucun identifiant de paiement (trace_id / session Stripe) n’est disponible pour cette inscription."
      );
      return;
    }

    setLoadingReceipt(true);
    setReceiptUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "get-receipt-url",
        {
          body: { trace_id: traceId },
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

    if (champ === "apparaitre_resultats") {
      return (
        <div key={champ} className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-neutral-700">
            {labelOverride || "Apparaître dans les résultats"}
          </span>
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => handleChange(champ, e.target.checked)}
          />
        </div>
      );
    }

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

  const traceIdPreview = resolveTraceId();

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

      {/* Bloc Reçu Stripe */}
      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white px-4 py-3 flex flex-wrap items-center gap-4">
        <div className="text-sm text-neutral-700">
          Reçu Stripe lié au paiement (si disponible).
          {traceIdPreview && (
            <div className="mt-1 text-xs text-neutral-500">
              Trace détectée :{" "}
              <span className="font-mono">
                {String(traceIdPreview).slice(0, 20)}…
              </span>
            </div>
          )}
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
        {/* Colonne 1 : Identité + Fédération */}
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
            {payment && (
              <div className="mt-4 border-t border-neutral-200 pt-3 text-xs text-neutral-600 space-y-1">
                <div>
                  <span className="font-semibold">Paiement trouvé :</span>{" "}
                  {payment.status || payment.stripe_status || "—"}
                </div>
                {payment.amount && (
                  <div>
                    Montant : {payment.amount / 100}{" "}
                    {payment.currency || "EUR"}
                  </div>
                )}
              </div>
            )}
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

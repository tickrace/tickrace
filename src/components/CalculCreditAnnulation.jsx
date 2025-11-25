// src/components/CalculCreditAnnulation.jsx
import React, { useState } from "react";
import { supabase } from "../supabase";

/**
 * Composant de calcul / déclenchement du crédit d'annulation
 *
 * Props:
 * - inscriptionId (string, requis) : uuid de l'inscription
 * - onCancelled?: (creditRow) => void  (optionnel, callback après succès)
 */
export default function CalculCreditAnnulation({ inscriptionId, onCancelled }) {
  const [loading, setLoading] = useState(false);
  const [credit, setCredit] = useState(null);   // résultat de la fonction SQL
  const [error, setError] = useState(null);

  /**
   * Appel de la fonction Postgres:
   *   calculer_credit_annulation(inscription_id uuid)
   *
   * La fonction côté BDD:
   * - calcule le % de remboursement en fonction du nombre de jours avant la course
   * - calcule le remboursement sur l'inscription + les options payantes
   * - calcule les frais d'annulation
   * - calcule le montant total du crédit
   * - insère une ligne dans credits_annulation
   * - met à jour l'inscription (statut = 'annulé')
   */
  async function handleAnnulation() {
    if (!inscriptionId) {
      setError("Identifiant d'inscription manquant.");
      return;
    }

    // Double confirmation, car l'action est définitive
    const ok1 = window.confirm(
      "Confirmer l'annulation de cette inscription ? Cette action est définitive."
    );
    if (!ok1) return;

    const ok2 = window.confirm(
      "Dernière confirmation : l'inscription sera annulée et un crédit sera généré selon les règles de remboursement. Continuer ?"
    );
    if (!ok2) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "calculer_credit_annulation",
        { inscription_id: inscriptionId }
      );

      if (rpcError) {
        console.error("❌ calculer_credit_annulation error:", rpcError);
        setError(
          rpcError.message ||
            "Erreur lors du calcul du crédit d'annulation. Réessaie plus tard."
        );
        setLoading(false);
        return;
      }

      // Selon la définition de ta fonction, `data` peut être un objet ou un tableau
      const row = Array.isArray(data) ? data[0] : data;
      setCredit(row || null);

      if (onCancelled && row) onCancelled(row);
    } catch (e) {
      console.error(e);
      setError("Erreur inattendue lors de l'annulation.");
    } finally {
      setLoading(false);
    }
  }

  // Helpers d'affichage (on défend contre les noms de colonnes manquants)
  const pourcentage =
    credit?.pourcentage_remboursement ??
    credit?.pourcentage ??
    null;

  const remboursementInscription =
    credit?.remboursement_inscription ??
    credit?.montant_rembourse_inscription ??
    null;

  const remboursementOptions =
    credit?.remboursement_options ??
    credit?.montant_rembourse_options ??
    null;

  const fraisAnnulation =
    credit?.frais_annulation ??
    credit?.montant_frais_annulation ??
    null;

  const montantTotal =
    credit?.montant_total ??
    credit?.montant_total_credit ??
    null;

  const joursAvantCourse =
    credit?.jours_avant_course ??
    credit?.nb_jours_avant_course ??
    null;

  const hasSummary =
    remboursementInscription !== null ||
    remboursementOptions !== null ||
    fraisAnnulation !== null ||
    montantTotal !== null ||
    pourcentage !== null;

  return (
    <section className="mt-6 rounded-2xl border border-red-200 bg-red-50/60 shadow-sm">
      <div className="p-5 border-b border-red-100 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-red-800">
            Annuler mon inscription
          </h2>
          <p className="text-sm text-red-700">
            Cette opération est définitive. Un crédit d&apos;annulation sera
            calculé automatiquement en fonction de la date de la course et des
            montants payés (inscription + options payantes).
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-300 bg-red-100 px-3 py-2 text-sm text-red-900">
            {error}
          </div>
        )}

        {!credit && (
          <button
            type="button"
            onClick={handleAnnulation}
            disabled={loading || !inscriptionId}
            className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition
              ${
                loading || !inscriptionId
                  ? "bg-red-300 cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-700"
              }`}
          >
            {loading
              ? "Calcul du crédit et annulation…"
              : "Annuler mon inscription et générer un crédit"}
          </button>
        )}

        {credit && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <p className="font-semibold">
                Inscription annulée et crédit généré.
              </p>
              <p>
                Tu peux retrouver ce crédit dans ton espace Tickrace (solde
                d&apos;annulation / avoir), selon ce que tu as prévu côté
                interface.
              </p>
            </div>

            {hasSummary && (
              <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm space-y-2">
                {joursAvantCourse !== null && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600">
                      Jours avant la course
                    </span>
                    <span className="font-medium">
                      {joursAvantCourse} jour
                      {joursAvantCourse > 1 ? "s" : ""}
                    </span>
                  </div>
                )}

                {pourcentage !== null && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600">
                      Pourcentage remboursé
                    </span>
                    <span className="font-medium">{pourcentage} %</span>
                  </div>
                )}

                {remboursementInscription !== null && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600">
                      Remboursement inscription
                    </span>
                    <span className="font-medium">
                      {Number(remboursementInscription).toFixed(2)} €
                    </span>
                  </div>
                )}

                {remboursementOptions !== null && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600">
                      Remboursement options payantes
                    </span>
                    <span className="font-medium">
                      {Number(remboursementOptions).toFixed(2)} €
                    </span>
                  </div>
                )}

                {fraisAnnulation !== null && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Frais d&apos;annulation</span>
                    <span className="font-medium">
                      -{Number(fraisAnnulation).toFixed(2)} €
                    </span>
                  </div>
                )}

                <div className="h-px bg-neutral-200 my-1" />

                {montantTotal !== null && (
                  <div className="flex justify-between text-base">
                    <span className="font-semibold">Crédit total</span>
                    <span className="font-bold">
                      {Number(montantTotal).toFixed(2)} €
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Bloc debug pour t'aider à ajuster les noms de colonnes si besoin */}
            <details className="text-xs text-neutral-500">
              <summary className="cursor-pointer select-none">
                Détails techniques (JSON brut retourné par la fonction)
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-neutral-900 p-3 text-[11px] text-neutral-100">
                {JSON.stringify(credit, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </section>
  );
}

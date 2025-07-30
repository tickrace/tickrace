// src/components/CalculCreditAnnulation.jsx
import React from "react";

export default function CalculCreditAnnulation({ simulation }) {
  if (!simulation) return null;

  const {
    jours_avant_course,
    pourcentage_remboursement,
    frais,
    remboursement_inscription,
    remboursement_repas,
    montant_total,
  } = simulation;

  const formatEuro = (montant) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(montant);

  let typePeriode = "";
  if (jours_avant_course > 30) {
    typePeriode = "Plus de 30 jours";
  } else if (jours_avant_course > 14) {
    typePeriode = "Entre 15 et 30 jours";
  } else if (jours_avant_course > 7) {
    typePeriode = "Entre 8 et 14 jours";
  } else {
    typePeriode = "Moins de 8 jours";
  }

  const fraisRetenus = remboursement_inscription * frais;

  return (
    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 mt-4 rounded-xl shadow-sm">
      <p className="font-semibold mb-2">Simulation de crédit en cas d’annulation</p>
      <ul className="space-y-1 text-sm">
        <li><strong>Type de période :</strong> {typePeriode}</li>
        <li><strong>Jours avant la course :</strong> {jours_avant_course} jours</li>
        <li><strong>Remboursement sur inscription :</strong> {formatEuro(remboursement_inscription)}</li>
        <li><strong>Remboursement repas :</strong> {formatEuro(remboursement_repas)}</li>
        <li><strong>Frais retenus :</strong> {formatEuro(fraisRetenus)}</li>
        <li><strong>Crédit total :</strong> {formatEuro(montant_total)}</li>
      </ul>
    </div>
  );
}

// src/components/CalculCreditAnnulation.jsx
import React, { useMemo } from "react";
import dayjs from "dayjs";

export default function CalculCreditAnnulation({ prixInscription, prixRepas, dateCourse, dateAnnulation }) {
  const {
    creditTotal,
    creditInscription,
    creditRepas,
    fraisTotal,
    pourcentageRemboursement,
    type,
    joursRestants,
  } = useMemo(() => {
    const dateCourseObj = dayjs(dateCourse);
    const dateAnnulationObj = dayjs(dateAnnulation);
    const joursRestants = dateCourseObj.diff(dateAnnulationObj, "day");

    let pourcentage = 0;
    let type = "";

    if (joursRestants > 14) {
      pourcentage = 1.0;
      type = "Plus de 14 jours";
    } else if (joursRestants >= 4) {
      pourcentage = 0.5;
      type = "Entre 4 et 14 jours";
    } else {
      pourcentage = 0.0;
      type = "Moins de 4 jours";
    }

    const frais = prixInscription * 0.05 + prixInscription * (1 - pourcentage) * 0.95;
    const creditInscription = Math.round(Math.max(prixInscription * pourcentage * 0.95, 0) * 100) / 100;
    const creditRepas = Math.round(Math.max(prixRepas, 0) * 100) / 100;
    const fraisTotal = Math.round(frais * 100) / 100;
    const creditTotal = Math.round((creditInscription + creditRepas) * 100) / 100;

    return {
      creditTotal,
      creditInscription,
      creditRepas,
      fraisTotal,
      pourcentageRemboursement: pourcentage * 100,
      type,
      joursRestants,
    };
  }, [prixInscription, prixRepas, dateCourse, dateAnnulation]);

  return (
    <div className="p-4 mt-6 rounded border border-yellow-400 bg-yellow-50 text-yellow-900">
      <h2 className="text-lg font-semibold mb-2">Simulation de crédit en cas d’annulation</h2>
      <ul className="list-disc list-inside text-sm space-y-1">
        <li><strong>Type de période :</strong> {type}</li>
        <li><strong>Jours avant la course :</strong> {joursRestants} jours</li>
        <li><strong>Montant inscription :</strong> {prixInscription.toFixed(2)} €</li>
        <li><strong>Montant repas :</strong> {prixRepas.toFixed(2)} €</li>
        <li><strong>Remboursement sur inscription :</strong> {creditInscription.toFixed(2)} € ({pourcentageRemboursement}% - frais 5%)</li>
        <li><strong>Remboursement repas :</strong> {creditRepas.toFixed(2)} €</li>
        <li><strong>Frais retenus :</strong> {fraisTotal.toFixed(2)} €</li>
        <li><strong>Crédit total :</strong> {creditTotal.toFixed(2)} €</li>
      </ul>
    </div>
  );
}

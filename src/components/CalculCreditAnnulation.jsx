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
    const joursRestants = dateCourseObj.startOf("day").diff(dateAnnulationObj.startOf("day"), "day");


   let pourcentage = 0;
let type = "";

if (joursRestants > 60) {
  pourcentage = 0.95; // Remboursement de 95 %, on conserve 5 %
  type = "Plus de 60 jours";
} else if (joursRestants >= 4) {
  // Remboursement progressif entre 4 et 60 jours
  const progression = (joursRestants - 3) / (60 - 3); // Valeur entre 0 et 1
  pourcentage = Math.round(progression * 95) / 100; // De 0.05 à 0.95
  type = `Annulation ${joursRestants} jours avant`;
} else {
  pourcentage = 0; // Aucun remboursement à moins de 4 jours
  type = "Moins de 4 jours";
}


    const montantInscription = Math.abs(prixInscription); // toujours positif
    const montantRepas = Math.abs(prixRepas);

    const creditInscription = Math.round(montantInscription * pourcentage * 0.95 * 100) / 100;
    const creditRepas = montantRepas;
    const fraisTotal = Math.round((montantInscription * 0.05 + montantInscription * (1 - pourcentage) * 0.95) * 100) / 100;
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
        <li><strong>Montant inscription :</strong> {Math.abs(prixInscription).toFixed(2)} €</li>
        <li><strong>Montant repas :</strong> {Math.abs(prixRepas).toFixed(2)} €</li>
        <li>
          <strong>Remboursement sur inscription :</strong>{" "}
          {creditInscription.toFixed(2)} € ({pourcentageRemboursement}% - frais 5%)
        </li>
        <li><strong>Remboursement repas :</strong> {creditRepas.toFixed(2)} €</li>
        <li><strong>Frais retenus :</strong> {fraisTotal.toFixed(2)} €</li>
        <li><strong>Crédit total :</strong> {creditTotal.toFixed(2)} €</li>
      </ul>
    </div>
  );
}

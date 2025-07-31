// src/components/CalculCreditAnnulation.jsx
import React, { useMemo } from "react";
import dayjs from "dayjs";

export default function CalculCreditAnnulation({ prixInscription, prixRepas, dateCourse, dateAnnulation }) {
  const {
    creditTotal,
    creditInscription,
    creditRepas,
    fraisTotal,
    pourcentageConserve,
    type,
    joursRestants,
  } = useMemo(() => {
    const dateCourseObj = dayjs(dateCourse).startOf("day");
    const dateAnnulationObj = dayjs(dateAnnulation).startOf("day");
    const joursRestants = dateCourseObj.diff(dateAnnulationObj, "day");

    let pourcentageConserve = 0;
    let type = "";

    if (joursRestants > 60) {
      pourcentageConserve = 0.05;
      type = "Plus de 60 jours";
    } else if (joursRestants >= 4) {
      const progression = (joursRestants - 3) / (60 - 3); // entre 0 et 1
      pourcentageConserve = Math.round((1 - progression * 0.95) * 100) / 100;
      type = `Annulation ${joursRestants} jours avant`;
    } else {
      pourcentageConserve = 1.0;
      type = "Moins de 4 jours";
    }

    const montantInscription = Math.abs(prixInscription);
    const montantRepas = Math.abs(prixRepas);

    const remboursementInscription = Math.round(montantInscription * (1 - pourcentageConserve) * 100) / 100;
    const remboursementRepas = montantRepas;
    const frais = Math.round(montantInscription * pourcentageConserve * 100) / 100;
    const total = Math.round((remboursementInscription + remboursementRepas) * 100) / 100;

    return {
      creditTotal: total,
      creditInscription: remboursementInscription,
      creditRepas: remboursementRepas,
      fraisTotal: frais,
      pourcentageConserve: pourcentageConserve * 100,
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
          {creditInscription.toFixed(2)} € ({(100 - pourcentageConserve).toFixed(2)}% remboursé)
        </li>
        <li><strong>Remboursement repas :</strong> {creditRepas.toFixed(2)} €</li>
        <li><strong>Frais retenus :</strong> {fraisTotal.toFixed(2)} €</li>
        <li><strong>Crédit total :</strong> {creditTotal.toFixed(2)} €</li>
      </ul>
    </div>
  );
}

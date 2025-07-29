import React from "react";
import dayjs from "dayjs";

export default function CalculCreditAnnulation({ dateCourse, prixInscription = 0, prixRepas = 0 }) {
  if (!dateCourse) return null;

  const now = dayjs();
  const courseDate = dayjs(dateCourse);
  const joursRestants = courseDate.diff(now, "day");

  const fraisFixes = prixInscription * 0.05;
  let remboursementInscription = 0;

  if (joursRestants > 14) {
    remboursementInscription = prixInscription - fraisFixes;
  } else if (joursRestants >= 4) {
    remboursementInscription = (prixInscription * 0.5) - fraisFixes;
  } else {
    remboursementInscription = 0;
  }

  if (remboursementInscription < 0) remboursementInscription = 0;

  const remboursementTotal = remboursementInscription + prixRepas;

  return (
    <div className="bg-yellow-100 text-yellow-900 border border-yellow-300 rounded p-4 mt-6">
      <h2 className="font-bold mb-2">Simulation de crédit en cas d'annulation</h2>
      <p>Date de la course : <strong>{courseDate.format("DD/MM/YYYY")}</strong></p>
      <p>Jours restants avant la course : <strong>{joursRestants}</strong></p>
      <ul className="list-disc list-inside my-2">
        <li>Prix de l’inscription (hors repas) : {prixInscription.toFixed(2)} €</li>
        <li>Frais de traitement (5 %) : -{fraisFixes.toFixed(2)} €</li>
        <li>Prix des repas : +{prixRepas.toFixed(2)} €</li>
      </ul>
      <p>
        <strong>Crédit estimé :</strong> {remboursementTotal.toFixed(2)} €
      </p>
      <p className="text-sm mt-2">Ce crédit sera automatiquement ajouté à votre solde en cas d'annulation.</p>
    </div>
  );
}

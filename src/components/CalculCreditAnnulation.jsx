// src/components/CalculCreditAnnulation.jsx
import React, { useEffect, useState } from "react";
import dayjs from "dayjs";

export default function CalculCreditAnnulation({
  prixInscription = 0,
  prixRepas = 0,
  dateCourse,
  dateAnnulation = new Date(),
}) {
  const [credit, setCredit] = useState(null);

  useEffect(() => {
    if (!dateCourse) return;

    const courseDate = dayjs(dateCourse);
    const annulationDate = dayjs(dateAnnulation);
    const joursRestants = courseDate.diff(annulationDate, "day");

    const fraisInitiaux = prixInscription * 0.05;
    let remboursementInscription = 0;
    let pourcentage = 0;

    if (joursRestants > 14) {
      pourcentage = 1;
      remboursementInscription = prixInscription - fraisInitiaux;
    } else if (joursRestants >= 4) {
      pourcentage = 0.5;
      remboursementInscription = (prixInscription - fraisInitiaux) * 0.5;
    } else {
      pourcentage = 0;
      remboursementInscription = 0;
    }

    const fraisSupplémentaires = remboursementInscription * 0.05;
    const montantFinalInscription = remboursementInscription - fraisSupplémentaires;

    const creditTotal = montantFinalInscription + prixRepas;

    setCredit({
      joursRestants,
      fraisInitiaux,
      pourcentage,
      remboursementInscription,
      fraisSupplémentaires,
      montantFinalInscription,
      prixRepas,
      creditTotal,
    });
  }, [prixInscription, prixRepas, dateCourse, dateAnnulation]);

  if (!credit) return null;

  return (
    <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 p-4 rounded mt-4">
      <h2 className="font-semibold mb-2">💡 Simulation de crédit en cas d’annulation</h2>
      <ul className="space-y-1 text-sm">
        <li>🗓 Jours restants avant la course : <strong>{credit.joursRestants}</strong></li>
        <li>💶 Prix de l’inscription : {prixInscription.toFixed(2)} €</li>
        <li>❌ Frais initiaux retenus (5%) : {credit.fraisInitiaux.toFixed(2)} €</li>
        <li>✅ Pourcentage remboursé : {(credit.pourcentage * 100).toFixed(0)}%</li>
        <li>💸 Frais sur le remboursement : {credit.fraisSupplémentaires.toFixed(2)} €</li>
        <li>🔁 Montant remboursé sur l’inscription : {credit.montantFinalInscription.toFixed(2)} €</li>
        <li>🍽 Remboursement des repas : {credit.prixRepas.toFixed(2)} €</li>
        <li className="font-bold mt-2">🎯 Crédit total : {credit.creditTotal.toFixed(2)} €</li>
      </ul>
    </div>
  );
}

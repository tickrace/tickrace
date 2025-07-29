// src/components/CalculCreditAnnulation.jsx

import React, { useEffect, useState } from "react";
import dayjs from "dayjs";

export default function CalculCreditAnnulation({ formatDate, prixInscription = 0, prixRepas = 0 }) {
  const [credit, setCredit] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!formatDate) return;

    const now = dayjs();
    const courseDate = dayjs(formatDate);
    const joursAvantCourse = courseDate.diff(now, "day");

    // Frais de départ (5% sur prix d'inscription uniquement)
    const fraisFixes = prixInscription * 0.05;
    const montantRemboursable = prixInscription - fraisFixes;

    let remboursementInscription = 0;

    if (joursAvantCourse > 14) {
      remboursementInscription = montantRemboursable * 0.95;
      setMessage(`Annulation +14 jours : remboursement 95 % du montant restant après frais fixes (5 %)`);
    } else if (joursAvantCourse >= 4) {
      remboursementInscription = montantRemboursable * 0.50;
      setMessage(`Annulation entre 4 et 14 jours : remboursement 50 % du montant restant après frais fixes (5 %)`);
    } else {
      remboursementInscription = 0;
      setMessage(`Annulation -4 jours : aucun remboursement sur l'inscription`);
    }

    // Repas toujours remboursés à 100 %
    const remboursementRepas = prixRepas;

    setCredit({
      repas: remboursementRepas.toFixed(2),
      inscription: remboursementInscription.toFixed(2),
      total: (remboursementRepas + remboursementInscription).toFixed(2),
      joursAvantCourse,
    });
  }, [formatDate, prixInscription, prixRepas]);

  if (!credit) return null;

  return (
    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 my-4 rounded">
      <h3 className="font-bold mb-2">Simulation de crédit en cas d'annulation</h3>
      <p className="mb-1">{message}</p>
      <ul className="list-disc list-inside text-sm">
        <li>Remboursement inscription : {credit.inscription} €</li>
        <li>Remboursement repas : {credit.repas} €</li>
        <li className="font-semibold">Crédit total : {credit.total} €</li>
        <li>Jours avant la course : {credit.joursAvantCourse} jours</li>
      </ul>
    </div>
  );
}

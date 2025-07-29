// src/components/CalculCreditAnnulation.jsx
import React from "react";
import dayjs from "dayjs";

export default function CalculCreditAnnulation({ format, prixInscription, prixRepas }) {
  if (!format || !format.date) return null;

  const dateCourse = dayjs(format.date);
  const aujourdHui = dayjs();
  const joursRestant = dateCourse.diff(aujourdHui, "day");

  const fraisFixes = Math.round(prixInscription * 0.05 * 100) / 100;
  const remboursementRepas = prixRepas;

  let remboursementInscription = 0;
  if (joursRestant > 14) {
    remboursementInscription = Math.round((prixInscription - fraisFixes) * 0.95 * 100) / 100;
  } else if (joursRestant >= 4) {
    remboursementInscription = Math.round((prixInscription - fraisFixes) * 0.5 * 0.95 * 100) / 100;
  }

  const creditTotal = Math.round((remboursementInscription + remboursementRepas) * 100) / 100;

  return (
    <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 p-4 rounded mt-4">
      <h3 className="font-bold mb-2">Simulation de crédit en cas d'annulation</h3>
      <p>Jours avant la course : <strong>{joursRestant} jours</strong></p>
      <p>Frais fixes conservés : <strong>{fraisFixes.toFixed(2)} €</strong></p>
      <p>Remboursement inscription : <strong>{remboursementInscription.toFixed(2)} €</strong></p>
      <p>Remboursement repas : <strong>{remboursementRepas.toFixed(2)} €</strong></p>
      <p className="mt-2 font-semibold text-lg">Crédit total : <strong>{creditTotal.toFixed(2)} €</strong></p>
    </div>
  );
}

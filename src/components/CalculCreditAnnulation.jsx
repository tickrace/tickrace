// src/components/CalculCreditAnnulation.jsx

import React from "react";
import dayjs from "dayjs";

export default function CalculCreditAnnulation({ prixInscription = 0, prixRepas = 0, dateCourse, dateAnnulation = new Date() }) {
  const dateCourseObj = dayjs(dateCourse);
  const dateAnnulationObj = dayjs(dateAnnulation);
  const joursAvantCourse = dateCourseObj.diff(dateAnnulationObj, "day");

  // Frais initiaux conservés
  const fraisBase = prixInscription * 0.05;
  let remboursementInscription = 0;

  if (joursAvantCourse > 14) {
    remboursementInscription = prixInscription - fraisBase;
  } else if (joursAvantCourse >= 4) {
    remboursementInscription = (prixInscription * 0.5) * 0.95;
  } else {
    remboursementInscription = 0;
  }

  const remboursementRepas = prixRepas;
  const totalCredit = remboursementInscription + remboursementRepas;

  return (
    <div className="bg-yellow-50 p-4 rounded border border-yellow-300 mt-4">
      <h2 className="text-lg font-semibold mb-2">Simulation du crédit</h2>
      <p className="text-sm text-gray-700">
        Date de la course : <strong>{dateCourseObj.format("DD/MM/YYYY")}</strong><br />
        Date d'annulation : <strong>{dateAnnulationObj.format("DD/MM/YYYY")}</strong><br />
        Nombre de jours avant la course : <strong>{joursAvantCourse}</strong>
      </p>
      <hr className="my-2" />
      <p className="text-sm">
        Montant initial de l'inscription : {prixInscription.toFixed(2)} €<br />
        Montant des repas : {prixRepas.toFixed(2)} €<br />
        <strong>Crédit total accordé :</strong> <span className="text-green-700 font-semibold">{totalCredit.toFixed(2)} €</span>
      </p>
    </div>
  );
}

// src/components/CalculCreditAnnulation.jsx
import React, { useEffect, useState } from "react";
import dayjs from "dayjs";

export default function CalculCreditAnnulation({ prixInscription = 0, prixRepas = 0, dateCourse, dateAnnulation = new Date() }) {
  const [credit, setCredit] = useState(0);
  const [explication, setExplication] = useState("");

  useEffect(() => {
    if (!dateCourse) return;

    const dateCourseObj = dayjs(dateCourse);
    const dateAnnulationObj = dayjs(dateAnnulation);
    const diffDays = dateCourseObj.diff(dateAnnulationObj, "day");

    let pourcentage = 0;
    if (diffDays > 14) {
      pourcentage = 0.95;
      setExplication("Annulation +14 jours : remboursement 95% de l'inscription + 100% des repas.");
    } else if (diffDays >= 4) {
      pourcentage = 0.5 * 0.95;
      setExplication("Annulation entre 4 et 14 jours : remboursement 50% de l'inscription (moins 5%) + 100% des repas.");
    } else {
      pourcentage = 0;
      setExplication("Annulation < 4 jours : aucun remboursement sur l'inscription. Seuls les repas sont remboursés.");
    }

    const remboursementInscription = prixInscription * pourcentage;
    const remboursementRepas = prixRepas;
    const total = remboursementInscription + remboursementRepas;

    setCredit(total.toFixed(2));
  }, [prixInscription, prixRepas, dateCourse, dateAnnulation]);

  return (
    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 mt-4 rounded">
      <p className="font-semibold mb-1">Simulation de crédit en cas d'annulation :</p>
      <p>{explication}</p>
      <p className="mt-2 font-bold">Crédit estimé : {credit} €</p>
    </div>
  );
}

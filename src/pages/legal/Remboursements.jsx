import React from "react";

export default function Remboursements() {
  return (
    <div className="max-w-3xl mx-auto p-5 leading-relaxed">
      <h1 className="text-2xl font-semibold mb-2">Politique de remboursement</h1>
      <p className="text-sm text-gray-600 mb-6">Dernière mise à jour : 17/08/2025</p>

      <h2 className="text-lg font-semibold mt-6 mb-2">1. Principe général</h2>
      <p>Tickrace est une plateforme d’encaissement et de billetterie. Les conditions de remboursement sont définies par l’organisateur et présentées au moment de l’achat.</p>

      <h2 className="text-lg font-semibold mt-6 mb-2">2. Cas d’école</h2>
      <ul className="list-disc ml-6 space-y-1">
        <li><b>Annulation par l’organisateur</b> : remboursement selon la politique publiée par l’organisateur (intégral/partiel/report).</li>
        <li><b>Report / modification</b> : l’organisateur précise les options (maintien, avoir, remboursement).</li>
        <li><b>Demande du participant</b> : se référer aux règles de l’organisateur (ex. délais, justificatifs médicaux, frais de dossier).</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6 mb-2">3. Procédure</h2>
      <ol className="list-decimal ml-6 space-y-1">
        <li>Le participant contacte l’organisateur via l’email fourni sur la page de l’événement ou son espace.</li>
        <li>L’organisateur instruit la demande et, le cas échéant, initie le remboursement depuis son interface Stripe/administration.</li>
        <li>Tickrace peut assister techniquement mais ne décide pas à la place de l’organisateur.</li>
      </ol>

      <h2 className="text-lg font-semibold mt-6 mb-2">4. Litiges & rétrofacturations</h2>
      <p>En cas de litige bancaire (chargeback), le montant contesté peut être bloqué/déduit des reversements en attendant l’issue du dossier.</p>

      <div className="mt-6 text-sm text-gray-600">
        <b>Note :</b> certaines lois peuvent limiter le droit de rétractation pour des services de loisirs à date déterminée.
        Adaptez cette politique avec votre conseil juridique et indiquez clairement vos règles sur chaque événement.
      </div>
    </div>
  );
}

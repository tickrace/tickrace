import React from "react";

export default function CharteOrganisateur() {
  return (
    <div className="max-w-3xl mx-auto p-5 leading-relaxed">
      <h1 className="text-2xl font-semibold mb-2">Charte organisateur & anti-fraude</h1>
      <p className="text-sm text-gray-600 mb-6">Dernière mise à jour : 17/08/2025</p>

      <h2 className="text-lg font-semibold mt-6 mb-2">1. Identité & autorisations</h2>
      <ul className="list-disc ml-6 space-y-1">
        <li>Fournir une identité exacte et à jour (personne morale/physique).</li>
        <li>Détenir les autorisations nécessaires (collectivités, propriétaires, préfecture si requis).</li>
        <li>Être couvert par une assurance responsabilité civile organisateur.</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6 mb-2">2. Transparence de l’événement</h2>
      <ul className="list-disc ml-6 space-y-1">
        <li>Informations exactes : date, lieu, distances, dénivelé, nombre de dossards, règlement, certificats médicaux, etc.</li>
        <li>Communication claire en cas de changement (mail + mise à jour de la fiche course).</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6 mb-2">3. Lutte anti-fraude</h2>
      <ul className="list-disc ml-6 space-y-1">
        <li>Interdiction d’usurper l’identité d’un autre organisateur ou d’une course existante.</li>
        <li>Tickrace peut exiger des justificatifs et <b>geler les fonds</b> en cas de suspicion.</li>
        <li>En cas de fraude, Tickrace peut annuler des ventes, rembourser les participants, résilier l’accès et signaler aux autorités.</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6 mb-2">4. Paiements</h2>
      <ul className="list-disc ml-6 space-y-1">
        <li>Activation et maintien d’un compte Stripe Express valide.</li>
        <li>Respect des procédures de remboursement et des délais de réponse (≤ 72h).</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6 mb-2">5. Données & conformité</h2>
      <ul className="list-disc ml-6 space-y-1">
        <li>Respect du RGPD (usage des données des coureurs limité à l’organisation de l’événement).</li>
        <li>Respect des obligations fiscales et sociales applicables.</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6 mb-2">6. Sanctions</h2>
      <p>Tout manquement grave à cette charte peut entraîner gel des fonds, suppression d’événement, résiliation d’accès, et actions légales.</p>

      <div className="mt-6 text-sm text-gray-600">
        <b>Note :</b> cette charte complète les CGV. Elle peut évoluer ; la poursuite d’utilisation vaut acceptation.
      </div>
    </div>
  );
}

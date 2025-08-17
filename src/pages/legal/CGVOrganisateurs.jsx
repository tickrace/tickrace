import React from "react";

export default function CGVOrganisateurs() {
  return (
    <div className="max-w-3xl mx-auto p-5 leading-relaxed">
      <h1 className="text-2xl font-semibold mb-2">CGV — Organisateurs</h1>
      <p className="text-sm text-gray-600 mb-6">Dernière mise à jour : 17/08/2025</p>

      <h2 className="text-lg font-semibold mt-6 mb-2">1. Objet</h2>
      <p>Ces conditions encadrent l’utilisation de Tickrace par les organisateurs pour vendre des inscriptions à des événements sportifs.</p>

      <h2 className="text-lg font-semibold mt-6 mb-2">2. Rôles & responsabilités</h2>
      <ul className="list-disc ml-6 space-y-1">
        <li><b>Organisateur</b> : édite l’événement, fixe les prix, délivre la prestation, gère la relation participants.</li>
        <li><b>Tickrace</b> : plateforme intermédiaire de mise en relation et d’encaissement via Stripe Connect.</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6 mb-2">3. Paiements & reversements</h2>
      <ul className="list-disc ml-6 space-y-1">
        <li><b>Encaissement</b> : effectué via Stripe Connect. L’activation d’un compte Stripe Express est indispensable.</li>
        <li><b>Commission Tickrace</b> : un pourcentage du montant TTC (affiché dans l’admin). Déduit avant reversement.</li>
        <li><b>Frais Stripe</b> : prélevés par Stripe selon leur grille en vigueur.</li>
        <li><b>Reversements</b> : automatiques ou manuels depuis l’espace admin. Tickrace peut retenir tout ou partie en cas de litige/risque.</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6 mb-2">4. Obligations de l’organisateur</h2>
      <ul className="list-disc ml-6 space-y-1">
        <li>Publier des informations exactes (date, lieu, distances, quotas, règlement, certificats médicaux, etc.).</li>
        <li>Disposer des <b>droits et autorisations</b> pour organiser l’événement.</li>
        <li>Respecter la législation (sécurité, assurances, RGPD, fiscalité, TVA le cas échéant).</li>
        <li>Mettre en place une procédure de <b>SAV</b> et répondre aux participants sous 72h.</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6 mb-2">5. Lutte anti-fraude</h2>
      <ul className="list-disc ml-6 space-y-1">
        <li>Tickrace peut demander des justificatifs (autorisation mairie/préf., assurance RC, identité).</li>
        <li>En cas de suspicion (usurpation, faux événement), Tickrace peut <b>geler les fonds</b>, annuler la vente, informer les autorités.</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6 mb-2">6. Annulations / modifications</h2>
      <ul className="list-disc ml-6 space-y-1">
        <li>Vous devez définir et publier vos règles (report, remboursement partiel, etc.).</li>
        <li>En cas d’annulation, vous assumez les remboursements selon votre politique et le droit applicable.</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6 mb-2">7. Litiges & rétrofacturations</h2>
      <ul className="list-disc ml-6 space-y-1">
        <li>Vous coopérez avec Tickrace pour fournir les preuves (règlement, preuve d’inscription, communications).</li>
        <li>Les <b>chargebacks</b> peuvent être déduits des reversements présents et futurs.</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6 mb-2">8. Résiliation</h2>
      <p>Tickrace peut suspendre/résilier l’accès en cas de non-respect des CGV ou risque avéré.</p>

      <h2 className="text-lg font-semibold mt-6 mb-2">9. Divers</h2>
      <ul className="list-disc ml-6 space-y-1">
        <li>Tickrace peut mettre à jour les CGV. La poursuite d’utilisation vaut acceptation.</li>
        <li>Compétence juridictionnelle et loi applicables : à préciser selon votre siège (ex. droit français, tribunaux de …).</li>
      </ul>

      <div className="mt-6 text-sm text-gray-600">
        <b>Note :</b> ce modèle est fourni à titre informatif. Faites valider ces CGV par votre conseil juridique.
      </div>
    </div>
  );
}

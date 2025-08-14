import React from "react";
import { useSearchParams, Link } from "react-router-dom";

export default function PaiementAnnule() {
  const [sp] = useSearchParams();
  const sessionId = sp.get("session_id");

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Paiement annulé</h1>
      <p className="mb-4">
        Votre paiement a été annulé. Vous pouvez réessayer quand vous voulez.
      </p>
      {sessionId && (
        <p className="text-sm text-gray-600 mb-6">
          ID de session Stripe : <code>{sessionId}</code>
        </p>
      )}
      <Link to="/" className="underline">Retour à l’accueil</Link>
    </div>
  );
}

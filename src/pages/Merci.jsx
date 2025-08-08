// src/pages/Merci.jsx
import React, { useEffect, useState } from "react";

export default function Merci() {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get("session_id");

      if (!sessionId) {
        setState({ loading: false, error: "Session de paiement introuvable.", data: null });
        return;
      }

      try {
        const res = await fetch(
          `https://pecotcxpcqfkwvyylvjv.functions.supabase.co/verify-checkout-session?session_id=${encodeURIComponent(sessionId)}`,
          { method: "GET" }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Erreur de vérification");

        setState({ loading: false, error: null, data: json });
      } catch (e) {
        setState({ loading: false, error: e.message, data: null });
      }
    };
    run();
  }, []);

  if (state.loading) return <div className="p-6">Vérification du paiement…</div>;
  if (state.error) return (
    <div className="p-6 text-red-600">
      ❌ {state.error}
    </div>
  );

  const { payment_status, status, amount_total, currency } = state.data || {};
  const isPaid = payment_status === "paid" || status === "complete";

  return (
    <div className="p-6">
      {isPaid ? (
        <>
          <h1 className="text-2xl font-bold text-green-700">🎉 Paiement confirmé</h1>
          <p className="mt-2">
            Merci ! Votre inscription est validée.
          </p>
          <p className="mt-2 text-gray-700">
            Montant : {(amount_total / 100).toFixed(2)} {currency?.toUpperCase()}
          </p>
          <a href="/mes-inscriptions" className="inline-block mt-4 bg-green-600 text-white px-4 py-2 rounded">
            Voir mes inscriptions
          </a>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-red-700">❌ Paiement non finalisé</h1>
          <p className="mt-2">
            Votre paiement ne semble pas confirmé (statut: {payment_status ?? status ?? "inconnu"}).
          </p>
          <a href="/courses" className="inline-block mt-4 bg-indigo-600 text-white px-4 py-2 rounded">
            Voir les courses
          </a>
        </>
      )}
    </div>
  );
}

// src/pages/PaiementAnnule.jsx
import React, { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../supabase";

export default function PaiementAnnule() {
  const [sp] = useSearchParams();
  const sessionId = sp.get("session_id");
  const inscriptionId = sp.get("inscription_id");
  const [retryLoading, setRetryLoading] = useState(false);
  const [retryErr, setRetryErr] = useState(null);

  async function retryPayment() {
    if (!inscriptionId) return;
    try {
      setRetryLoading(true);
      setRetryErr(null);
      // ⚠️ adapte le nom de la function si besoin :
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { inscription_id: inscriptionId },
      });
      if (error) throw new Error(error.message || "Impossible de relancer le paiement.");
      if (data?.url) {
        window.location.href = data.url; // redirection vers Stripe
      } else {
        throw new Error("URL de redirection manquante.");
      }
    } catch (e) {
      setRetryErr(e?.message ?? String(e));
    } finally {
      setRetryLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Bandeau / hero compact */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-rose-600 text-white px-3 py-1 text-[11px] ring-1 ring-rose-800/10">
          Paiement annulé
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900">
          Transaction interrompue ❌
        </h1>
        <p className="mt-2 text-neutral-600">
          Pas de panique —{" "}
          <span className="font-semibold text-orange-600">
            vous pouvez réessayer quand vous le souhaitez
          </span>
          .
        </p>
      </div>

      {/* Carte */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-6">
        <p className="text-neutral-700 mb-4">
          Votre paiement n’a pas été finalisé. Aucun montant n’a été débité.
        </p>

        {sessionId && (
          <div className="mb-4 text-sm text-neutral-500">
            ID de session Stripe : <code>{sessionId}</code>
          </div>
        )}

        {retryErr && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {retryErr}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Link
            to="/courses"
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            Revoir les épreuves
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            Retour à l’accueil
          </Link>

          {inscriptionId && (
            <button
              onClick={retryPayment}
              disabled={retryLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
              title="Relancer le paiement"
            >
              {retryLoading ? "Redirection…" : "Réessayer le paiement"}
            </button>
          )}
        </div>
      </div>

      {/* Support */}
      <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
        Besoin d’aide ? Écrivez-nous :{" "}
        <a href="mailto:support@tickrace.app" className="underline">
          support@tickrace.app
        </a>
      </div>
    </div>
  );
}

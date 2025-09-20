// src/pages/Merci.jsx
import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../supabase";

export default function Merci() {
  const [sp] = useSearchParams();
  const sessionId = sp.get("session_id") || "";
  const traceId = sp.get("trace_id") || "";
  const inscriptionId = sp.get("inscription_id") || "";
  const [loading, setLoading] = useState(true);
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function run() {
      try {
        setLoading(true);
        const { data, error } = await supabase.functions.invoke("verify-checkout-session", {
          body: {
            session_id: sessionId || undefined,
            trace_id: traceId || undefined,
            inscription_id: inscriptionId || undefined,
          },
        });
        if (error) throw error;
        setRes(data);
      } catch (e) {
        console.error(e);
        setError(e?.message || "Erreur lors de la vérification du paiement.");
      } finally {
        setLoading(false);
      }
    }
    // On doit avoir au moins l’un des deux
    if (sessionId || traceId) run();
    else {
      setError("Paramètres manquants (session_id ou trace_id).");
      setLoading(false);
    }
  }, [sessionId, traceId, inscriptionId]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="h-8 w-64 bg-neutral-200 rounded animate-pulse mb-4" />
        <div className="h-40 w-full bg-neutral-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold mb-2">Paiement</h1>
        <p className="text-red-600">{error}</p>
        <Link to="/" className="inline-block mt-6 text-sm text-neutral-600 underline">Retour à l’accueil</Link>
      </div>
    );
  }

  const mode = res?.mode || "individuel";
  const total = (res?.amount_total_cents ?? 0) / 100;
  const inscriptions = Array.isArray(res?.inscriptions) ? res.inscriptions : [];
  const isTeam = mode === "groupe" || mode === "relais";

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="p-6 border-b border-neutral-100">
          <h1 className="text-2xl font-bold">Merci 🎉</h1>
          <p className="text-neutral-600 mt-1">
            Votre paiement est confirmé. Un email de confirmation a été envoyé.
          </p>
        </div>

        <div className="p-6 space-y-5">
          <div className="rounded-xl bg-neutral-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-neutral-600">Montant total</div>
                <div className="text-xl font-bold">{total.toFixed(2)} €</div>
              </div>
              {res?.receipt_url && (
                <a href={res.receipt_url} target="_blank" rel="noreferrer"
                   className="text-sm font-semibold underline">
                  Reçu Stripe
                </a>
              )}
            </div>
            <div className="mt-3 text-xs text-neutral-500">
              Référence paiement : {res?.payment_intent_id || "—"}<br/>
              Trace ID : {res?.trace_id || "—"}
            </div>
          </div>

          {!isTeam ? (
            <div className="rounded-xl border border-neutral-200 p-4">
              <div className="font-semibold mb-2">Votre inscription</div>
              {inscriptions.length === 0 ? (
                <div className="text-sm text-neutral-600">Détails indisponibles.</div>
              ) : (
                <div className="text-sm text-neutral-800">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span><span className="text-neutral-500">Nom :</span> {inscriptions[0].nom} {inscriptions[0].prenom}</span>
                    <span><span className="text-neutral-500">Email :</span> {inscriptions[0].email || "—"}</span>
                    <span><span className="text-neutral-500">Statut :</span> {inscriptions[0].statut}</span>
                  </div>
                  <Link
                    to={`/mon-inscription/${inscriptions[0].id}`}
                    className="inline-block mt-3 text-sm font-semibold underline"
                  >
                    Voir mon inscription
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200 p-4">
              <div className="font-semibold mb-2">Équipe(s) confirmée(s)</div>
              {inscriptions.length === 0 ? (
                <div className="text-sm text-neutral-600">Aucun membre retrouvé.</div>
              ) : (
                <div className="space-y-2">
                  {inscriptions.map((m) => (
                    <div key={m.id} className="text-sm flex items-center justify-between border-b border-neutral-100 pb-2">
                      <div>
                        <div className="font-medium">{m.nom} {m.prenom}</div>
                        <div className="text-neutral-500">{m.email || "—"}</div>
                      </div>
                      <Link to={`/mon-inscription/${m.id}`} className="text-xs underline">
                        Détail
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="pt-2">
            <Link to="/" className="text-sm text-neutral-600 underline">Retour à l’accueil</Link>
          </div>
        </div>
      </div>
    </div>
  );
  
}

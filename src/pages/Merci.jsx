// src/pages/Merci.jsx
import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../supabase";

export default function Merci() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");
  const [details, setDetails] = useState(null); // { amount_total, currency, receipt_url, payment_status, status }

  useEffect(() => {
    const verifySession = async () => {
      if (!sessionId) {
        setStatus("error");
        setMessage("❌ Session de paiement introuvable.");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("verify-checkout-session", {
          body: { sessionId }, // ✅ POST, headers gérés par le SDK
        });

        if (error) {
          console.error(error);
          throw new Error(error.message || "Erreur invocation fonction");
        }

        if (data?.paid) {
          setStatus("success");
          setMessage("✅ Paiement validé. Votre inscription est confirmée !");
        } else {
          setStatus("error");
          setMessage(`❌ Paiement non validé (${data?.payment_status ?? "inconnu"}).`);
        }
        setDetails(data || null);
      } catch (err) {
        console.error("Erreur vérification paiement :", err);
        setStatus("error");
        setMessage("❌ Une erreur est survenue lors de la vérification.");
      }
    };

    verifySession();
  }, [sessionId]);

  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      {status === "loading" && (
        <p className="text-lg animate-pulse">Vérification du paiement en cours...</p>
      )}

      {status !== "loading" && (
        <>
          <h1
            className={`text-2xl font-bold mb-4 ${
              status === "success" ? "text-green-600" : "text-red-600"
            }`}
          >
            {message}
          </h1>

          {details && (
            <div className="mb-6 text-sm text-gray-700 space-y-1">
              {"amount_total" in details && details.amount_total ? (
                <p>
                  Montant : <strong>{details.amount_total}</strong>{" "}
                  {details.currency?.toUpperCase?.()}
                </p>
              ) : null}
              {details.payment_status && (
                <p>Statut Stripe : {details.payment_status}</p>
              )}
              {details.status && <p>Session : {details.status}</p>}
              {details.receipt_url && (
                <p>
                  Reçu :{" "}
                  <a
                    className="text-blue-600 underline"
                    href={details.receipt_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    voir le reçu
                  </a>
                </p>
              )}
            </div>
          )}

          {status === "success" ? (
            <Link
              to="/mes-inscriptions"
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Voir mes inscriptions
            </Link>
          ) : (
            <Link
              to="/courses"
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
            >
              Voir les courses
            </Link>
          )}
        </>
      )}
    </div>
  );
}

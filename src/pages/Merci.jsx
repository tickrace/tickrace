// src/pages/Merci.jsx
import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../supabase";

export default function Merci() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState(false);
  const [details, setDetails] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        if (!sessionId) {
          setErr("Aucun identifiant de session trouvé.");
          setLoading(false);
          return;
        }

        // Appel via supabase-js => headers d’auth auto
        const { data, error } = await supabase.functions.invoke(
          "verify-checkout-session",
          { body: { session_id: sessionId } }
        );

        if (!mounted) return;

        if (error) {
          console.error("❌ Erreur vérification paiement :", error);
          setErr("Erreur lors de la vérification du paiement.");
          setLoading(false);
          return;
        }

        setDetails(data);
        setOk(Boolean(data?.success));
        setLoading(false);
      } catch (e) {
        if (!mounted) return;
        console.error("💥 Exception côté client :", e);
        setErr("Erreur inattendue lors de la vérification.");
        setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center">
        <h1 className="text-2xl font-semibold mb-2">Vérification du paiement…</h1>
        <p className="text-gray-600">Merci de patienter quelques secondes.</p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center">
        <h1 className="text-2xl font-semibold mb-2">❌ Paiement non confirmé</h1>
        <p className="text-gray-700 mb-4">{err}</p>
        <div className="flex gap-3 justify-center">
          <Link to="/" className="bg-gray-200 px-3 py-2 rounded">Accueil</Link>
          <Link to="/inscription" className="bg-purple-600 text-white px-3 py-2 rounded">
            Revenir à l’inscription
          </Link>
        </div>
      </div>
    );
  }

  return ok ? (
    <div className="p-6 max-w-xl mx-auto text-center">
      <h1 className="text-2xl font-semibold mb-2">🎉 Paiement confirmé</h1>
      <p className="text-gray-700">
        Merci ! Votre inscription a bien été validée.
      </p>

      {/* Informations utiles */}
      <div className="mt-4 text-left bg-gray-50 border rounded p-4">
        <p><strong>Montant :</strong> {(details?.amount_total ?? 0) / 100} {details?.currency?.toUpperCase()}</p>
        {details?.customer_email && <p><strong>Email :</strong> {details.customer_email}</p>}
        <p><strong>Statut Stripe :</strong> {details?.payment_status} / {details?.checkout_status}</p>
      </div>

      <div className="mt-6 flex gap-3 justify-center">
        <Link to="/mesinscriptions" className="bg-green-600 text-white px-3 py-2 rounded">
          Voir mes inscriptions
        </Link>
        <Link to="/" className="bg-gray-200 px-3 py-2 rounded">
          Accueil
        </Link>
      </div>
    </div>
  ) : (
    <div className="p-6 max-w-xl mx-auto text-center">
      <h1 className="text-2xl font-semibold mb-2">❌ Paiement annulé</h1>
      <p className="text-gray-700">
        Votre inscription n’a pas été finalisée.
      </p>
      <div className="mt-6 flex gap-3 justify-center">
        <Link to="/inscription" className="bg-purple-600 text-white px-3 py-2 rounded">
          Réessayer le paiement
        </Link>
        <Link to="/" className="bg-gray-200 px-3 py-2 rounded">
          Accueil
        </Link>
      </div>
    </div>
  );
}

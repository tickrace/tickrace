import React, { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { supabase } from "../supabase";

export default function Merci() {
  const location = useLocation();
  const success = new URLSearchParams(location.search).get("success");
  const [inscription, setInscription] = useState(null);
  const [format, setFormat] = useState(null);
  const [course, setCourse] = useState(null);

  useEffect(() => {
    const fetchInscription = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) return;

      const { data: inscriptions } = await supabase
        .from("inscriptions")
        .select("*, formats(*, courses(*))")
        .eq("coureur_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (inscriptions && inscriptions.length > 0) {
        setInscription(inscriptions[0]);
        setFormat(inscriptions[0].formats);
        setCourse(inscriptions[0].formats?.courses);
      }
    };

    if (success === "true") fetchInscription();
  }, [success]);

  if (success !== "true") {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <h1 className="text-3xl font-bold text-red-600 mb-4">❌ Paiement annulé</h1>
        <p className="text-lg mb-6">Votre inscription n’a pas été finalisée.</p>
        <Link to="/courses" className="bg-gray-600 text-white px-4 py-2 rounded">
          Voir les courses
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 text-center">
      <h1 className="text-3xl font-bold text-green-600 mb-4">✅ Paiement confirmé</h1>
      <p className="text-lg text-gray-700 mb-6">
        Merci pour votre inscription ! Vous recevrez un email de confirmation dans les prochaines minutes.
      </p>

      {inscription && format && course ? (
        <div className="bg-white shadow-md rounded-lg p-6 text-left space-y-3 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">📝 Détails de votre inscription</h2>
          <div><strong>Course :</strong> {course.nom}</div>
          <div><strong>Format :</strong> {format.nom} ({format.distance_km} km / {format.denivele_dplus} m D+)</div>
          <div><strong>Date :</strong> {format.date}</div>
          <div><strong>Nom :</strong> {inscription.prenom} {inscription.nom}</div>
          <div><strong>Email :</strong> {inscription.email}</div>
          <div><strong>Montant payé :</strong> {(inscription.prix_total_coureur || 0).toFixed(2)} €</div>
          <div><strong>Numéro d’inscription :</strong> <code>{inscription.id}</code></div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 mt-4">Chargement de vos informations…</p>
      )}

      <div className="mt-8">
        <Link to="/" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow">
          Retour à l’accueil
        </Link>
      </div>
    </div>
  );
}

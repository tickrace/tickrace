// inscriptioncourse.jsx (version finale avec email via Edge Function Resend)

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function InscriptionCourse() {
  const { courseId, formatId } = useParams();
  const [profil, setProfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchProfil = async () => {
      const session = await supabase.auth.getSession();
      const user = session.data?.session?.user;
      if (!user) return;
      const { data } = await supabase
        .from("profils_coureurs")
        .select("*")
        .eq("id", user.id)
        .single();
      if (data) {
        setProfil(data);
      }
      setLoading(false);
    };
    fetchProfil();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProfil((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleInscription = async () => {
    setMessage("Enregistrement en cours...");

    const session = await supabase.auth.getSession();
    const user = session.data?.session?.user;
    if (!user) return;

    const inscription = {
      coureur_id: user.id,
      course_id: courseId,
      format_id: formatId,
      ...profil,
      numero_licence: profil.justificatif_type === "licence" ? profil.numero_licence : null,
    };

    // Nettoyage
    Object.keys(inscription).forEach((key) => {
      if (inscription[key] === "") inscription[key] = null;
    });

    const { error } = await supabase.from("inscriptions").insert([inscription]);

    if (error) {
      setMessage("Erreur lors de l'inscription : " + error.message);
    } else {
      setMessage("Inscription réussie ✅");

      // Appel Edge Function pour envoi email
      await fetch("/functions/v1/send-inscription-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: profil.email,
          nom: profil.nom,
          prenom: profil.prenom,
          courseId,
          formatId,
        }),
      });
    }
  };

  if (loading) return <p>Chargement...</p>;
  if (!profil) return <p>Profil coureur introuvable.</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Finaliser mon inscription</h1>
      <p className="mb-4 text-gray-600">
        Vérifie les informations ci-dessous avant de confirmer ton inscription.
      </p>

      <div className="space-y-2">
        <div><strong>Nom :</strong> {profil.nom}</div>
        <div><strong>Prénom :</strong> {profil.prenom}</div>
        <div><strong>Email :</strong> {profil.email}</div>
        <div><strong>Téléphone :</strong> {profil.telephone}</div>
        <div><strong>Date de naissance :</strong> {profil.date_naissance}</div>
        <div><strong>Nationalité :</strong> {profil.nationalite}</div>
        <div><strong>Adresse :</strong> {profil.adresse} {profil.adresse_complement}, {profil.code_postal} {profil.ville}, {profil.pays}</div>
        <div><strong>Genre :</strong> {profil.genre}</div>
        <div><strong>Club :</strong> {profil.club || "-"}</div>
        <div><strong>Apparaitre dans les résultats :</strong> {profil.apparaitre_resultats ? "Oui" : "Non"}</div>
        <div><strong>Justificatif :</strong> {profil.justificatif_type === "licence" ? `Licence FFA n° ${profil.numero_licence}` : "PPS"}</div>
        <div><strong>Contact urgence :</strong> {profil.contact_urgence_nom} - {profil.contact_urgence_telephone}</div>
      </div>

      <button
        onClick={handleInscription}
        className="mt-6 bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
      >
        Confirmer mon inscription
      </button>

      {message && <p className="mt-4 text-blue-600 font-semibold">{message}</p>}
    </div>
  );
}

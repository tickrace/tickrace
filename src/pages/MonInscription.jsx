// src/pages/MonInscription.jsx

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function MonInscription() {
  const { token } = useParams();
  const [inscription, setInscription] = useState(null);
  const [format, setFormat] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const fetchInscription = async () => {
      const { data: tokenRow } = await supabase
        .from("inscription_tokens")
        .select("*, inscriptions(*), inscriptions:format_id(formats(*))")
        .eq("token", token)
        .single();

      if (tokenRow && tokenRow.inscriptions) {
        setInscription(tokenRow.inscriptions);
        const { data: formatData } = await supabase
          .from("formats")
          .select("*")
          .eq("id", tokenRow.inscriptions.format_id)
          .single();
        setFormat(formatData);
      }
    };

    fetchInscription();
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setInscription((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from("inscriptions")
      .update(inscription)
      .eq("id", inscription.id);

    if (error) {
      console.error(error);
      setMessage("Erreur lors de la mise à jour.");
    } else {
      setMessage("Inscription mise à jour avec succès.");
    }
  };

  if (!inscription) return <div className="p-6">Chargement...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Modifier mon inscription</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="nom" placeholder="Nom" value={inscription.nom || ""} onChange={handleChange} className="w-full border p-2" />
        <input name="prenom" placeholder="Prénom" value={inscription.prenom || ""} onChange={handleChange} className="w-full border p-2" />
        <input name="email" placeholder="Email" value={inscription.email || ""} onChange={handleChange} className="w-full border p-2" />
        <input name="telephone" placeholder="Téléphone" value={inscription.telephone || ""} onChange={handleChange} className="w-full border p-2" />
        <input name="adresse" placeholder="Adresse" value={inscription.adresse || ""} onChange={handleChange} className="w-full border p-2" />
        <input name="ville" placeholder="Ville" value={inscription.ville || ""} onChange={handleChange} className="w-full border p-2" />
        <input name="code_postal" placeholder="Code postal" value={inscription.code_postal || ""} onChange={handleChange} className="w-full border p-2" />
        <input name="pays" placeholder="Pays" value={inscription.pays || ""} onChange={handleChange} className="w-full border p-2" />
        <input name="club" placeholder="Club" value={inscription.club || ""} onChange={handleChange} className="w-full border p-2" />
        <input name="contact_urgence_nom" placeholder="Contact d'urgence - nom" value={inscription.contact_urgence_nom || ""} onChange={handleChange} className="w-full border p-2" />
        <input name="contact_urgence_telephone" placeholder="Contact d'urgence - téléphone" value={inscription.contact_urgence_telephone || ""} onChange={handleChange} className="w-full border p-2" />
        <select name="justificatif_type" value={inscription.justificatif_type || ""} onChange={handleChange} className="w-full border p-2">
          <option value="">-- Justificatif --</option>
          <option value="licence">Licence</option>
          <option value="pps">PPS</option>
        </select>
        {inscription.justificatif_type === "licence" && (
          <input name="numero_licence" placeholder="Numéro de licence" value={inscription.numero_licence || ""} onChange={handleChange} className="w-full border p-2" />
        )}
        {inscription.justificatif_type === "pps" && (
          <input name="pps_identifier" placeholder="Identifiant PPS" value={inscription.pps_identifier || ""} onChange={handleChange} className="w-full border p-2" />
        )}

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
          Mettre à jour mon inscription
        </button>
        {message && <p className="text-green-700 mt-2">{message}</p>}
      </form>
    </div>
  );
}

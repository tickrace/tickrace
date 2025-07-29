// src/pages/MonInscription.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import CalculCreditAnnulation from "../components/CalculCreditAnnulation";

export default function MonInscription() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inscription, setInscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInscription = async () => {
      const { data, error } = await supabase
        .from("inscriptions")
        .select("*")
        .eq("id", id)
        .single();

      if (!error && data) {
        setInscription(data);
      }
      setLoading(false);
    };

    fetchInscription();
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setInscription({
      ...inscription,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSave = async () => {
    await supabase.from("inscriptions").update(inscription).eq("id", id);
    alert("Modifications enregistrées");
  };

  const handleCancel = async () => {
    const confirm = window.confirm(
      "Souhaitez-vous vraiment annuler votre inscription ? Le crédit sera calculé automatiquement selon les règles d'annulation."
    );
    if (!confirm) return;

    try {
      const response = await fetch(
        "https://pecotcxpcqfkwvyylvjv.functions.supabase.co/annuler_inscription",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: inscription.id }),
        }
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message);
      }

      alert("Inscription annulée. Un crédit a été généré.");
      navigate("/mes-inscriptions");
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'annulation : " + err.message);
    }
  };

  if (loading || !inscription) return <p>Chargement...</p>;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Modifier mon inscription</h1>
      <div className="space-y-2">
        {["nom","prenom","genre","date_naissance","nationalite","email","telephone","adresse","adresse_complement","code_postal","ville","pays","club","justificatif_type","numero_licence","contact_urgence_nom","contact_urgence_telephone","pps_identifier"].map((field) => (
          <input
            key={field}
            type="text"
            name={field}
            value={inscription[field] || ""}
            onChange={handleChange}
            placeholder={field.replace(/_/g, " ")}
            className="w-full p-2 border rounded"
          />
        ))}

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            name="apparaitre_resultats"
            checked={inscription.apparaitre_resultats}
            onChange={handleChange}
          />
          <label>Apparaître dans les résultats</label>
        </div>

        <input
          type="number"
          name="nombre_repas"
          value={inscription.nombre_repas || 0}
          onChange={handleChange}
          placeholder="Nombre de repas"
          className="w-full p-2 border rounded"
        />

        <CalculCreditAnnulation
          prixInscription={
            (inscription.prix_total_coureur || 0) - (inscription.prix_total_repas || 0)
          }
          prixRepas={inscription.prix_total_repas || 0}
          dateCourse={inscription.date}
          dateAnnulation={new Date()}
        />

        <div className="flex space-x-4 mt-4">
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Enregistrer
          </button>
          <button
            onClick={handleCancel}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Annuler mon inscription
          </button>
        </div>
      </div>
    </div>
  );
}

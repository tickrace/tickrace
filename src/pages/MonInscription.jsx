import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import CalculCreditAnnulation from "../components/CalculCreditAnnulation";

export default function MonInscription() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inscription, setInscription] = useState(null);
  const [format, setFormat] = useState(null);
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

  useEffect(() => {
    const fetchFormat = async () => {
      if (!inscription?.format_id) return;
      const { data, error } = await supabase
        .from("formats")
        .select("id, date, prix")
        .eq("id", inscription.format_id)
        .single();
      if (!error) setFormat(data);
    };

    fetchFormat();
  }, [inscription]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setInscription({
      ...inscription,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSave = async () => {
    await supabase
      .from("inscriptions")
      .update(inscription)
      .eq("id", id);
    alert("Modifications enregistrées");
  };

  const handleCancel = async () => {
    const confirm = window.confirm("Confirmer l’annulation de votre inscription ?");
    if (!confirm) return;

   await supabase.functions.invoke("annuler_inscription", {
  method: "POST",
  body: { id },
});


    alert("Inscription annulée");
    navigate("/mes-inscriptions");
  };

  if (loading || !inscription) return <p>Chargement...</p>;

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-md rounded">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Modifier mon inscription</h1>

      <div className="grid grid-cols-1 gap-4">
        {[
          "nom",
          "prenom",
          "genre",
          "date_naissance",
          "nationalite",
          "email",
          "telephone",
          "adresse",
          "adresse_complement",
          "code_postal",
          "ville",
          "pays",
          "club",
          "justificatif_type",
          "numero_licence",
          "contact_urgence_nom",
          "contact_urgence_telephone",
          "pps_identifier",
        ].map((field) => (
          <input
            key={field}
            type="text"
            name={field}
            value={inscription[field] || ""}
            onChange={handleChange}
            placeholder={field.replace(/_/g, " ").toUpperCase()}
            className="w-full p-3 border border-gray-300 rounded"
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
          className="w-full p-3 border border-gray-300 rounded"
        />

        {/* Simulation de crédit d'annulation */}
        {format && (
          <CalculCreditAnnulation
            prixInscription={(inscription.prix_total_coureur || 0) - (inscription.prix_total_repas || 0)}
            prixRepas={inscription.prix_total_repas || 0}
            dateCourse={format.date}
            dateAnnulation={new Date()}
          />
        )}

        <div className="flex justify-center space-x-6 mt-6">
          <button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded"
          >
            Enregistrer les modifications
          </button>
          {inscription.statut === "annulé" ? (
  <p className="text-red-600 font-semibold">
    Cette inscription a déjà été annulée.
  </p>
) : (
  <button
    onClick={handleCancel}
    className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded"
  >
    Annuler mon inscription
  </button>
)}

        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function MonInscription() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inscription, setInscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const fetchInscription = async () => {
      const { data, error } = await supabase
        .from("inscriptions")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        setMessage("Erreur lors du chargement de l'inscription.");
      } else {
        setInscription(data);
      }
      setLoading(false);
    };

    fetchInscription();
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setInscription((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleUpdate = async () => {
    const { error } = await supabase
      .from("inscriptions")
      .update(inscription)
      .eq("id", id);

    if (error) {
      setMessage("Erreur lors de la mise à jour.");
    } else {
      setMessage("Inscription mise à jour avec succès.");
    }
  };

  const handleCancel = async () => {
    const { error } = await supabase
      .from("inscriptions")
      .update({ statut: "annulé" })
      .eq("id", id);

    if (!error) {
      navigate("/mes-inscriptions");
    } else {
      setMessage("Erreur lors de l'annulation.");
    }
  };

  if (loading) return <p className="p-4">Chargement...</p>;

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Mon Inscription</h1>
      {message && <p className="text-red-600 mb-4">{message}</p>}
      {inscription && (
        <form className="grid grid-cols-1 gap-4">
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
            "pps_identifier",
            "contact_urgence_nom",
            "contact_urgence_telephone",
          ].map((field) => (
            <input
              key={field}
              name={field}
              value={inscription[field] || ""}
              onChange={handleChange}
              className="border p-2 rounded"
              placeholder={field.replace(/_/g, " ")}
            />
          ))}

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="apparaitre_resultats"
              checked={inscription.apparaitre_resultats}
              onChange={handleChange}
            />
            <span>Apparaître dans les résultats</span>
          </label>

          <label>
            Nombre de repas :
            <input
              type="number"
              name="nombre_repas"
              value={inscription.nombre_repas || 0}
              onChange={handleChange}
              className="border p-2 rounded w-full"
            />
          </label>

          <div className="flex space-x-4 mt-4">
            <button
              type="button"
              onClick={handleUpdate}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Mettre à jour
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Annuler mon inscription
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

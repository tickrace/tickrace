import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function MonInscription() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inscription, setInscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

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
    const { name, value } = e.target;
    setInscription((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
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
    const confirm = window.confirm("Confirmer l'annulation de votre inscription ?");
    if (!confirm) return;

    const { error } = await supabase
      .from("inscriptions")
      .update({ statut: "annulé" })
      .eq("id", id);

    if (error) {
      setMessage("Erreur lors de l'annulation.");
    } else {
      navigate("/mes-inscriptions");
    }
  };

  if (loading) return <div>Chargement...</div>;

  if (!inscription) return <div>Aucune inscription trouvée.</div>;

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Modifier mon inscription</h1>

      {message && <div className="mb-4 text-red-600">{message}</div>}

      <div className="grid grid-cols-1 gap-4">
        <label className="block">
          Nom
          <input type="text" name="nom" value={inscription.nom || ""} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
        </label>
        <label className="block">
          Prénom
          <input type="text" name="prenom" value={inscription.prenom || ""} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
        </label>
        <label className="block">
          Email
          <input type="email" name="email" value={inscription.email || ""} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
        </label>
        {/* Ajoute d'autres champs si nécessaire */}
      </div>

      <div className="mt-6 flex gap-4">
        <button onClick={handleSave} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
          Enregistrer les modifications
        </button>
        <button onClick={handleCancel} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
          Annuler mon inscription
        </button>
      </div>
    </div>
  );
}

// src/pages/MonProfilCoureur.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

export default function MonProfilCoureur() {
  const { session } = useUser();
  const [profil, setProfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchProfil = async () => {
      const { data, error } = await supabase
        .from("profils_utilisateurs")
        .select("*")
        .eq("user_id", session?.user.id)
        .eq("role", "coureur")
        .single();

      if (error) {
        console.error("Erreur récupération profil :", error.message);
      } else {
        setProfil(data);
      }
      setLoading(false);
    };

    if (session?.user.id) fetchProfil();
  }, [session]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfil((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    const { error } = await supabase
      .from("profils_utilisateurs")
      .update({
        nom: profil.nom,
        prenom: profil.prenom,
      })
      .eq("user_id", session.user.id)
      .eq("role", "coureur");

    if (error) {
      setMessage("Erreur lors de la sauvegarde.");
      console.error(error.message);
    } else {
      setMessage("✅ Profil mis à jour avec succès.");
    }
  };

  if (loading) return <p className="p-4">Chargement...</p>;
  if (!profil) return <p className="p-4">Profil introuvable.</p>;

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Mon profil coureur</h1>

      <label className="block mb-2">Nom</label>
      <input
        type="text"
        name="nom"
        value={profil.nom || ""}
        onChange={handleChange}
        className="w-full p-2 border mb-4"
      />

      <label className="block mb-2">Prénom</label>
      <input
        type="text"
        name="prenom"
        value={profil.prenom || ""}
        onChange={handleChange}
        className="w-full p-2 border mb-4"
      />

      <button
        onClick={handleSave}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Enregistrer
      </button>

      {message && <p className="mt-4 text-green-600">{message}</p>}
    </div>
  );
}

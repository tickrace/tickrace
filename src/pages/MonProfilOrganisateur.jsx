import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function MonProfilOrganisateur() {
  const [profil, setProfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchProfil = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setMessage("Utilisateur non connecté.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profils_utilisateurs")
        .select("*")
        .eq("user_id", user.id)
        .eq("role", "organisateur")
        .single();

      if (error) {
        setMessage("Aucun profil organisateur trouvé.");
        setLoading(false);
      } else {
        setProfil(data);
        setLoading(false);
      }
    };

    fetchProfil();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfil((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    const { error } = await supabase
      .from("profils_utilisateurs")
      .update({ nom: profil.nom, prenom: profil.prenom })
      .eq("user_id", profil.user_id)
      .eq("role", "organisateur");

    if (error) {
      console.error(error);
      setMessage("Erreur lors de la mise à jour du profil.");
    } else {
      setMessage("Profil mis à jour avec succès !");
    }
  };

  if (loading) return <p className="p-6">Chargement...</p>;
  if (!profil) return <p className="p-6">{message}</p>;

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Mon profil organisateur</h1>
      {message && <p className="mb-4 text-blue-600">{message}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="nom"
          value={profil.nom || ""}
          onChange={handleChange}
          placeholder="Nom"
          className="p-2 border rounded w-full"
        />
        <input
          name="prenom"
          value={profil.prenom || ""}
          onChange={handleChange}
          placeholder="Prénom"
          className="p-2 border rounded w-full"
        />
        <button
          type="submit"
          className="mt-4 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Valider les modifications
        </button>
      </form>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

export default function MonProfilCoureur() {
  const { session } = useUser();
  const userId = session?.user?.id;

  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    genre: "",
    date_naissance: "",
    nationalite: "",
    email: "",
    telephone: "",
    adresse: "",
    adresse_complement: "",
    code_postal: "",
    ville: "",
    pays: "",
    apparaitre_resultats: true,
    club: "",
    justificatif_type: "",
    contact_urgence_nom: "",
    contact_urgence_telephone: "",
  });

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const fetchProfil = async () => {
      if (!userId) return;

      const { data, error } = await supabase
        .from("profils_utilisateurs")
        .select("*")
        .eq("user_id", userId)
        .eq("role", "coureur")
        .single();

      if (error) {
        console.error("Erreur chargement profil coureur :", error.message);
        setStatus("Erreur lors du chargement du profil.");
      } else {
        setFormData(data);
      }

      setLoading(false);
    };

    fetchProfil();
  }, [userId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("Enregistrement en cours...");

    const { error } = await supabase
      .from("profils_utilisateurs")
      .update(formData)
      .eq("user_id", userId)
      .eq("role", "coureur");

    if (error) {
      console.error("Erreur mise à jour :", error.message);
      setStatus("Erreur lors de la mise à jour.");
    } else {
      setStatus("Profil mis à jour avec succès !");
    }
  };

  if (loading) return <p className="p-6">Chargement...</p>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Mon Profil Coureur</h1>
      <form onSubmit={handleSubmit} className="space-y-4">

        <div className="grid grid-cols-2 gap-4">
          <input name="nom" value={formData.nom} onChange={handleChange} placeholder="Nom" className="border p-2" />
          <input name="prenom" value={formData.prenom} onChange={handleChange} placeholder="Prénom" className="border p-2" />
          <input name="genre" value={formData.genre} onChange={handleChange} placeholder="Genre" className="border p-2" />
          <input type="date" name="date_naissance" value={formData.date_naissance || ""} onChange={handleChange} className="border p-2" />
          <input name="nationalite" value={formData.nationalite} onChange={handleChange} placeholder="Nationalité" className="border p-2" />
          <input name="email" value={formData.email} onChange={handleChange} placeholder="Email" className="border p-2" />
          <input name="telephone" value={formData.telephone || ""} onChange={handleChange} placeholder="Téléphone" className="border p-2" />
          <input name="club" value={formData.club || ""} onChange={handleChange} placeholder="Club" className="border p-2" />
          <input name="justificatif_type" value={formData.justificatif_type || ""} onChange={handleChange} placeholder="Type de justificatif (licence / PPS)" className="border p-2" />
        </div>

        <h2 className="text-xl font-semibold mt-4">Adresse</h2>
        <input name="adresse" value={formData.adresse || ""} onChange={handleChange} placeholder="Adresse" className="border p-2 w-full" />
        <input name="adresse_complement" value={formData.adresse_complement || ""} onChange={handleChange} placeholder="Complément d'adresse" className="border p-2 w-full" />
        <div className="grid grid-cols-3 gap-4">
          <input name="code_postal" value={formData.code_postal || ""} onChange={handleChange} placeholder="Code postal" className="border p-2" />
          <input name="ville" value={formData.ville || ""} onChange={handleChange} placeholder="Ville" className="border p-2" />
          <input name="pays" value={formData.pays || ""} onChange={handleChange} placeholder="Pays" className="border p-2" />
        </div>

        <label className="block mt-4">
          <input type="checkbox" name="apparaitre_resultats" checked={formData.apparaitre_resultats} onChange={handleChange} className="mr-2" />
          Apparaître dans les résultats
        </label>

        <h2 className="text-xl font-semibold mt-4">Contact d'urgence</h2>
        <input name="contact_urgence_nom" value={formData.contact_urgence_nom || ""} onChange={handleChange} placeholder="Nom du contact" className="border p-2 w-full" />
        <input name="contact_urgence_telephone" value={formData.contact_urgence_telephone || ""} onChange={handleChange} placeholder="Téléphone du contact" className="border p-2 w-full" />

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mt-4">
          Mettre à jour
        </button>

        {status && <p className="mt-4 text-sm">{status}</p>}
      </form>
    </div>
  );
}

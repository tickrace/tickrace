import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function MonProfilCoureur() {
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
        .from("profils_coureurs")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        setMessage("Aucun profil trouvé. Merci de créer votre profil.");
        setLoading(false);
      } else {
        setProfil(data);
        setLoading(false);
      }
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    const { error } = await supabase
      .from("profils_coureurs")
      .update({ ...profil, updated_at: new Date() })
      .eq("id", profil.id);

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
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Mon profil coureur</h1>
      {message && <p className="mb-4 text-blue-600">{message}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input name="nom" value={profil.nom || ""} onChange={handleChange} placeholder="Nom *" required className="p-2 border rounded" />
          <input name="prenom" value={profil.prenom || ""} onChange={handleChange} placeholder="Prénom *" required className="p-2 border rounded" />
          <input name="genre" value={profil.genre || ""} onChange={handleChange} placeholder="Genre *" required className="p-2 border rounded" />
          <input name="date_naissance" value={profil.date_naissance || ""} onChange={handleChange} type="date" required className="p-2 border rounded" />
          <input name="nationalite" value={profil.nationalite || ""} onChange={handleChange} placeholder="Nationalité *" required className="p-2 border rounded" />
          <input name="email" value={profil.email || ""} onChange={handleChange} placeholder="Email *" type="email" required className="p-2 border rounded" />
          <input name="telephone" value={profil.telephone || ""} onChange={handleChange} placeholder="Téléphone" className="p-2 border rounded" />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input name="adresse" value={profil.adresse || ""} onChange={handleChange} placeholder="Adresse" className="p-2 border rounded" />
          <input name="adresse_complement" value={profil.adresse_complement || ""} onChange={handleChange} placeholder="Complément d'adresse" className="p-2 border rounded" />
          <input name="code_postal" value={profil.code_postal || ""} onChange={handleChange} placeholder="Code postal" className="p-2 border rounded" />
          <input name="ville" value={profil.ville || ""} onChange={handleChange} placeholder="Ville" className="p-2 border rounded" />
          <input name="pays" value={profil.pays || ""} onChange={handleChange} placeholder="Pays" className="p-2 border rounded" />
        </div>

        <div>
          <label className="block mb-2">Apparaitre dans les résultats :</label>
          <input
            type="checkbox"
            name="apparaitre_resultats"
            checked={profil.apparaitre_resultats}
            onChange={handleChange}
          />
        </div>

        <input name="club" value={profil.club || ""} onChange={handleChange} placeholder="Club / Team / Association" className="p-2 border rounded w-full" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input name="justificatif_type" value={profil.justificatif_type || ""} onChange={handleChange} placeholder="Licence ou PPS *" required className="p-2 border rounded" />
          <input name="contact_urgence_nom" value={profil.contact_urgence_nom || ""} onChange={handleChange} placeholder="Contact urgence : Nom Prénom" className="p-2 border rounded" />
          <input name="contact_urgence_telephone" value={profil.contact_urgence_telephone || ""} onChange={handleChange} placeholder="Contact urgence : Téléphone" className="p-2 border rounded" />
        </div>

        <button type="submit" className="mt-4 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700">
          Valider les modifications
        </button>
      </form>
    </div>
  );
}

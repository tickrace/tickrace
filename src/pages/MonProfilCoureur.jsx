import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

export default function MonProfilCoureur() {
  const { session } = useUser();
  const user = session?.user;

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
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;

    const fetchProfil = async () => {
      const { data, error } = await supabase
        .from("profils_coureurs")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Erreur chargement profil :", error.message);
      } else {
        setFormData(data);
      }

      setLoading(false);
    };

    fetchProfil();
  }, [user]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase
      .from("profils_coureurs")
      .upsert({ ...formData, id: user.id });

    if (error) {
      console.error("Erreur enregistrement :", error.message);
      setMessage("❌ Une erreur est survenue.");
    } else {
      setMessage("✅ Profil mis à jour !");
    }
  };

  if (loading) return <p className="p-6">Chargement...</p>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Mon profil coureur</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input name="nom" value={formData.nom} onChange={handleChange} placeholder="Nom" className="p-2 border rounded" />
          <input name="prenom" value={formData.prenom} onChange={handleChange} placeholder="Prénom" className="p-2 border rounded" />
          <input name="genre" value={formData.genre} onChange={handleChange} placeholder="Genre" className="p-2 border rounded" />
          <input type="date" name="date_naissance" value={formData.date_naissance || ""} onChange={handleChange} className="p-2 border rounded" />
          <input name="nationalite" value={formData.nationalite} onChange={handleChange} placeholder="Nationalité" className="p-2 border rounded" />
          <input name="email" value={formData.email} onChange={handleChange} placeholder="Email" className="p-2 border rounded" />
          <input name="telephone" value={formData.telephone} onChange={handleChange} placeholder="Téléphone" className="p-2 border rounded" />
          <input name="adresse" value={formData.adresse} onChange={handleChange} placeholder="Adresse" className="p-2 border rounded" />
          <input name="adresse_complement" value={formData.adresse_complement} onChange={handleChange} placeholder="Complément" className="p-2 border rounded" />
          <input name="code_postal" value={formData.code_postal} onChange={handleChange} placeholder="Code postal" className="p-2 border rounded" />
          <input name="ville" value={formData.ville} onChange={handleChange} placeholder="Ville" className="p-2 border rounded" />
          <input name="pays" value={formData.pays} onChange={handleChange} placeholder="Pays" className="p-2 border rounded" />
          <input name="club" value={formData.club} onChange={handleChange} placeholder="Club / Team / Association" className="p-2 border rounded" />
          <input name="justificatif_type" value={formData.justificatif_type} onChange={handleChange} placeholder="Licence ou PPS" className="p-2 border rounded" />
          <input name="contact_urgence_nom" value={formData.contact_urgence_nom} onChange={handleChange} placeholder="Contact urgence - nom" className="p-2 border rounded" />
          <input name="contact_urgence_telephone" value={formData.contact_urgence_telephone} onChange={handleChange} placeholder="Contact urgence - téléphone" className="p-2 border rounded" />
        </div>

        <label className="flex items-center gap-2 mt-4">
          <input type="checkbox" name="apparaitre_resultats" checked={formData.apparaitre_resultats} onChange={handleChange} />
          Je souhaite apparaître dans les résultats
        </label>

        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mt-4">
          Enregistrer
        </button>
      </form>

      {message && <p className="mt-4">{message}</p>}
    </div>
  );
}

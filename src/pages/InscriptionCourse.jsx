import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function InscriptionCourse() {
  const { courseId } = useParams();
  const [profil, setProfil] = useState({});
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchProfil = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setMessage("Erreur : utilisateur non connecté.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profils_coureurs")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Erreur chargement profil", error.message);
        setMessage("Impossible de charger le profil.");
        setLoading(false);
      } else {
        setProfil(data);
        setFormData(data);
        setLoading(false);
      }
    };

    fetchProfil();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("inscriptions").insert([
      {
        user_id: user.id,
        course_id: courseId,
        ...formData,
      },
    ]);

    if (error) {
      console.error("Erreur d'inscription :", error.message);
      setMessage("Erreur lors de l'inscription.");
    } else {
      setMessage("Inscription réussie !");
    }
  };

  if (loading) return <p className="p-6">Chargement...</p>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Inscription à l'épreuve</h2>
      {message && <p className="mb-4 text-red-600">{message}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Informations personnelles */}
        <div>
          <label>Nom *</label>
          <input name="nom" value={formData.nom || ""} onChange={handleChange} required className="input" />
        </div>
        <div>
          <label>Prénom *</label>
          <input name="prenom" value={formData.prenom || ""} onChange={handleChange} required className="input" />
        </div>
        <div>
          <label>Genre *</label>
          <select name="genre" value={formData.genre || ""} onChange={handleChange} required className="input">
            <option value="">Choisir</option>
            <option value="H">Homme</option>
            <option value="F">Femme</option>
            <option value="Autre">Autre</option>
          </select>
        </div>
        <div>
          <label>Date de naissance *</label>
          <input name="date_naissance" type="date" value={formData.date_naissance || ""} onChange={handleChange} required className="input" />
        </div>
        <div>
          <label>Nationalité *</label>
          <input name="nationalite" value={formData.nationalite || ""} onChange={handleChange} required className="input" />
        </div>

        {/* Coordonnées */}
        <div>
          <label>Email *</label>
          <input type="email" name="email" value={formData.email || ""} onChange={handleChange} required className="input" />
        </div>
        <div>
          <label>Confirmer votre email *</label>
          <input type="email" required className="input" />
        </div>
        <div>
          <label>Téléphone *</label>
          <input name="telephone" value={formData.telephone || ""} onChange={handleChange} required className="input" />
        </div>
        <div>
          <label>Adresse *</label>
          <input name="adresse" value={formData.adresse || ""} onChange={handleChange} required className="input" />
        </div>
        <div>
          <label>Complément d’adresse</label>
          <input name="adresse_complement" value={formData.adresse_complement || ""} onChange={handleChange} className="input" />
        </div>
        <div>
          <label>Code postal *</label>
          <input name="code_postal" value={formData.code_postal || ""} onChange={handleChange} required className="input" />
        </div>
        <div>
          <label>Ville *</label>
          <input name="ville" value={formData.ville || ""} onChange={handleChange} required className="input" />
        </div>
        <div>
          <label>Pays *</label>
          <input name="pays" value={formData.pays || ""} onChange={handleChange} required className="input" />
        </div>

        {/* Résultats */}
        <div>
          <label>Apparaître dans les résultats *</label>
          <select name="apparaitre_resultats" value={formData.apparaitre_resultats || ""} onChange={handleChange} required className="input">
            <option value="">Choisir</option>
            <option value="oui">Oui</option>
            <option value="non">Non</option>
          </select>
        </div>
        <div>
          <label>Club / Team / Association</label>
          <input name="club" value={formData.club || ""} onChange={handleChange} className="input" />
        </div>

        {/* Justificatif */}
        <div>
          <label>Votre situation *</label>
          <textarea name="justificatif" value={formData.justificatif || ""} onChange={handleChange} required className="input" />
        </div>

        {/* Contact urgence */}
        <div>
          <label>Contact d’urgence – Nom Prénom *</label>
          <input name="contact_urgence_nom" value={formData.contact_urgence_nom || ""} onChange={handleChange} required className="input" />
        </div>
        <div>
          <label>Téléphone urgence *</label>
          <input name="contact_urgence_telephone" value={formData.contact_urgence_telephone || ""} onChange={handleChange} required className="input" />
        </div>

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Valider mon inscription
        </button>
      </form>
    </div>
  );
}

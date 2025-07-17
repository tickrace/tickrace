// src/pages/ProfilCoureur.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";

export default function ProfilCoureur() {
  const [profil, setProfil] = useState(null);
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfil = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;
      setUser(user);

      const { data, error } = await supabase
        .from("profils_coureurs")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) setProfil(data);
    };

    fetchProfil();
  }, []);

  const handleChange = (e) => {
    setProfil({ ...profil, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase.from("profils_coureurs").upsert({
      id: user.id,
      ...profil,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Erreur mise à jour :", error.message);
      setMessage("Erreur lors de l'enregistrement.");
    } else {
      setMessage("Profil mis à jour !");
      navigate("/courses");
    }
  };

  if (!user) return <p className="p-6">Connexion requise.</p>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Mon profil coureur</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="nom" placeholder="Nom" value={profil?.nom || ""} onChange={handleChange} required className="w-full p-2 border rounded" />
        <input name="prenom" placeholder="Prénom" value={profil?.prenom || ""} onChange={handleChange} required className="w-full p-2 border rounded" />
        <select name="genre" value={profil?.genre || ""} onChange={handleChange} required className="w-full p-2 border rounded">
          <option value="">Genre</option>
          <option value="Homme">Homme</option>
          <option value="Femme">Femme</option>
          <option value="Autre">Autre</option>
        </select>
        <input type="date" name="date_naissance" value={profil?.date_naissance || ""} onChange={handleChange} required className="w-full p-2 border rounded" />
        <input name="nationalite" placeholder="Nationalité" value={profil?.nationalite || ""} onChange={handleChange} required className="w-full p-2 border rounded" />

        <hr />

        <input type="email" name="email" placeholder="Email" value={profil?.email || ""} onChange={handleChange} required className="w-full p-2 border rounded" />
        <input name="telephone" placeholder="Téléphone" value={profil?.telephone || ""} onChange={handleChange} className="w-full p-2 border rounded" />
        <input name="adresse" placeholder="Adresse" value={profil?.adresse || ""} onChange={handleChange} className="w-full p-2 border rounded" />
        <input name="adresse_complement" placeholder="Complément adresse" value={profil?.adresse_complement || ""} onChange={handleChange} className="w-full p-2 border rounded" />
        <input name="code_postal" placeholder="Code Postal" value={profil?.code_postal || ""} onChange={handleChange} className="w-full p-2 border rounded" />
        <input name="ville" placeholder="Ville" value={profil?.ville || ""} onChange={handleChange} className="w-full p-2 border rounded" />
        <input name="pays" placeholder="Pays" value={profil?.pays || ""} onChange={handleChange} className="w-full p-2 border rounded" />

        <hr />

        <label className="block">
          Résultats visibles ?
          <select name="apparaitre_resultats" value={profil?.apparaitre_resultats ? "true" : "false"} onChange={(e) => setProfil({ ...profil, apparaitre_resultats: e.target.value === "true" })} className="w-full p-2 border rounded">
            <option value="true">Oui</option>
            <option value="false">Non</option>
          </select>
        </label>
        <input name="club" placeholder="Club / Team / Association" value={profil?.club || ""} onChange={handleChange} className="w-full p-2 border rounded" />
        <select name="justificatif_type" value={profil?.justificatif_type || ""} onChange={handleChange} className="w-full p-2 border rounded">
          <option value="">Type de justificatif</option>
          <option value="licence">Licence FFA</option>
          <option value="pps">PPS</option>
        </select>

        <hr />

        <input name="contact_urgence_nom" placeholder="Nom contact urgence" value={profil?.contact_urgence_nom || ""} onChange={handleChange} className="w-full p-2 border rounded" />
        <input name="contact_urgence_telephone" placeholder="Téléphone contact urgence" value={profil?.contact_urgence_telephone || ""} onChange={handleChange} className="w-full p-2 border rounded" />

        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Enregistrer</button>
      </form>

      {message && <p className="mt-4 text-green-600">{message}</p>}
    </div>
  );
}

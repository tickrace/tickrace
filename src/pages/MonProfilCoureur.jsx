import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function MonProfilCoureur() {
  const [profil, setProfil] = useState({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchProfil = async () => {
      const session = await supabase.auth.getSession();
      const user = session.data?.session?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from("profils_utilisateurs")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!error && data) {
        setProfil(data);
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
    const session = await supabase.auth.getSession();
    const user = session.data?.session?.user;
    if (!user) return;

    const profilToSave = { ...profil, user_id: user.id };

    // Gestion du booléen proprement
    if (typeof profilToSave.apparaitre_resultats === "string") {
      profilToSave.apparaitre_resultats = profilToSave.apparaitre_resultats === "true";
    }

    // Si justificatif_type !== 'licence', ne pas envoyer numero_licence
    if (profilToSave.justificatif_type !== "licence") {
      delete profilToSave.numero_licence;
    }

    // Nettoyage des chaînes vides
    Object.keys(profilToSave).forEach((key) => {
      if (profilToSave[key] === "") {
        profilToSave[key] = null;
      }
    });

    const { error } = await supabase
      .from("profils_utilisateurs")
      .upsert(profilToSave);

    setMessage(error ? "Erreur lors de la mise à jour." : "Profil mis à jour !");
  };

  const nationalites = ["Française", "Espagnole", "Italienne", "Allemande", "Portugaise", "Autre"];
  const pays = ["France", "Espagne", "Italie", "Allemagne", "Portugal", "Suisse", "Belgique"];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Mon profil coureur</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4">
          <input type="text" name="nom" placeholder="Nom" value={profil.nom || ""} onChange={handleChange} className="border p-2 w-1/2" />
          <input type="text" name="prenom" placeholder="Prénom" value={profil.prenom || ""} onChange={handleChange} className="border p-2 w-1/2" />
        </div>

        <div className="flex gap-4 items-center">
          <span className="font-semibold">Genre :</span>
          <label><input type="radio" name="genre" value="Homme" checked={profil.genre === "Homme"} onChange={handleChange} /> Homme</label>
          <label><input type="radio" name="genre" value="Femme" checked={profil.genre === "Femme"} onChange={handleChange} /> Femme</label>
        </div>

        <input type="date" name="date_naissance" value={profil.date_naissance || ""} onChange={handleChange} className="border p-2 w-full" />

        <select name="nationalite" value={profil.nationalite || ""} onChange={handleChange} className="border p-2 w-full">
          <option value="">-- Choisir une nationalité --</option>
          {nationalites.map((nat) => <option key={nat} value={nat}>{nat}</option>)}
        </select>

        <input type="email" name="email" placeholder="Email" value={profil.email || ""} onChange={handleChange} className="border p-2 w-full" />
        <input type="text" name="telephone" placeholder="Téléphone" value={profil.telephone || ""} onChange={handleChange} className="border p-2 w-full" />
        <input type="text" name="adresse" placeholder="Adresse" value={profil.adresse || ""} onChange={handleChange} className="border p-2 w-full" />
        <input type="text" name="adresse_complement" placeholder="Complément d'adresse" value={profil.adresse_complement || ""} onChange={handleChange} className="border p-2 w-full" />

        <div className="flex gap-4">
          <input type="text" name="code_postal" placeholder="Code postal" value={profil.code_postal || ""} onChange={handleChange} className="border p-2 w-1/2" />
          <input type="text" name="ville" placeholder="Ville" value={profil.ville || ""} onChange={handleChange} className="border p-2 w-1/2" />
        </div>

        <select name="pays" value={profil.pays || ""} onChange={handleChange} className="border p-2 w-full">
          <option value="">-- Choisir un pays --</option>
          {pays.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <div>
          <p className="font-semibold mb-1">Résultats :</p>
          <p className="text-sm mb-2">Conformément à la réglementation FFA, vous pouvez choisir que votre nom apparaisse ou non dans les résultats.</p>
          <label className="mr-4">
            <input type="radio" name="apparaitre_resultats" checked={profil.apparaitre_resultats === true} onChange={() => setProfil({ ...profil, apparaitre_resultats: true })} /> Oui
          </label>
          <label>
            <input type="radio" name="apparaitre_resultats" checked={profil.apparaitre_resultats === false} onChange={() => setProfil({ ...profil, apparaitre_resultats: false })} /> Non
          </label>
        </div>

        <div>
          <p className="font-semibold mb-1">Justificatif :</p>
          <p className="text-sm mb-2">Licence FFA ou PPS requis pour participer.</p>
          <label className="block mb-1">
            <input type="radio" name="justificatif_type" value="licence" checked={profil.justificatif_type === "licence"} onChange={handleChange} /> Licence FFA
          </label>
          <label className="block mb-2">
            <input type="radio" name="justificatif_type" value="pps" checked={profil.justificatif_type === "pps"} onChange={handleChange} /> PPS (Parcours Prévention Santé)
          </label>

          {profil.justificatif_type === "licence" && (
            <input type="text" name="numero_licence" placeholder="N° de licence" value={profil.numero_licence || ""} onChange={handleChange} className="border p-2 w-full" />
          )}
        </div>

        <input type="text" name="club" placeholder="Club (facultatif)" value={profil.club || ""} onChange={handleChange} className="border p-2 w-full" />
        <input type="text" name="contact_urgence_nom" placeholder="Contact d'urgence - Nom" value={profil.contact_urgence_nom || ""} onChange={handleChange} className="border p-2 w-full" />
        <input type="text" name="contact_urgence_telephone" placeholder="Contact d'urgence - Téléphone" value={profil.contact_urgence_telephone || ""} onChange={handleChange} className="border p-2 w-full" />

        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Sauvegarder</button>
        {message && <p className="text-sm text-green-700 mt-2">{message}</p>}
      </form>
    </div>
  );
}

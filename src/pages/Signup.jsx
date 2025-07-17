import React, { useState } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [roles, setRoles] = useState([]);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleCheckboxChange = (e) => {
    const { value, checked } = e.target;
    if (checked) {
      setRoles((prev) => [...prev, value]);
    } else {
      setRoles((prev) => prev.filter((role) => role !== value));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (roles.length === 0) {
      setMessage("Veuillez sélectionner au moins un rôle.");
      return;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setMessage("Erreur création compte : " + signUpError.message);
      return;
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      setMessage("Erreur : Utilisateur non récupéré.");
      return;
    }

    // Insertion des rôles dans la table profils_utilisateurs
    const insertData = roles.map((role) => ({
      user_id: userId,
      role,
      nom,
      prenom,
    }));

    const { error: insertError } = await supabase
      .from("profils_utilisateurs")
      .insert(insertData);

    if (insertError) {
      setMessage("Erreur enregistrement rôles : " + insertError.message);
    } else {
      setMessage("Compte créé avec succès !");
      navigate("/login");
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Créer un compte</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block">Email *</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="border w-full p-2 rounded" />
        </div>
        <div>
          <label className="block">Mot de passe *</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="border w-full p-2 rounded" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block">Nom *</label>
            <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} required className="border w-full p-2 rounded" />
          </div>
          <div>
            <label className="block">Prénom *</label>
            <input type="text" value={prenom} onChange={(e) => setPrenom(e.target.value)} required className="border w-full p-2 rounded" />
          </div>
        </div>
        <div>
          <label className="block mb-1">Rôle(s) *</label>
          <div className="flex gap-4">
            <label>
              <input type="checkbox" value="coureur" onChange={handleCheckboxChange} /> Coureur
            </label>
            <label>
              <input type="checkbox" value="organisateur" onChange={handleCheckboxChange} /> Organisateur
            </label>
          </div>
        </div>

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Créer le compte
        </button>

        {message && <p className="text-red-600 mt-2">{message}</p>}
      </form>
    </div>
  );
}

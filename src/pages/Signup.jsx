import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function Signup() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [message, setMessage] = useState(null);

  const handleSignup = async (e) => {
    e.preventDefault();

    // Création du compte utilisateur
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      console.error("Erreur création compte :", signUpError.message);
      setMessage("Erreur : " + signUpError.message);
      return;
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      setMessage("Erreur lors de la récupération de l'ID utilisateur.");
      return;
    }

    // Insertion du profil utilisateur
    const { error: profileError } = await supabase.from("profils_utilisateurs").insert([
      {
        user_id: userId,
        nom,
        prenom,
        role: "coureur", // rôle par défaut
      },
    ]);

    if (profileError) {
      console.error("Erreur insertion profil :", profileError.message);
      setMessage("Erreur lors de l'enregistrement du profil.");
      return;
    }

    setMessage("Compte créé avec succès. Veuillez confirmer votre email avant de vous connecter.");
    setTimeout(() => navigate("/login"), 3000);
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Créer un compte</h1>
      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label className="block">Nom</label>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            required
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block">Prénom</label>
          <input
            type="text"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            required
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block">Adresse email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block">Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Créer le compte
        </button>
      </form>

      {message && <p className="mt-4 text-center text-sm">{message}</p>}
    </div>
  );
}

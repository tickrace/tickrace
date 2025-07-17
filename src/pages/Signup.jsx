import React, { useState } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState([]);
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleCheckboxChange = (e) => {
    const value = e.target.value;
    setRoles((prev) =>
      prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]
    );
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
      setMessage(`Erreur : ${signUpError.message}`);
      return;
    }

    const user = signUpData.user;
    if (!user) {
      setMessage("Erreur : utilisateur non créé.");
      return;
    }

    // Insérer les rôles dans la table profils_utilisateurs
    const { error: insertError } = await supabase
      .from("profils_utilisateurs")
      .insert(
        roles.map((role) => ({
          user_id: user.id,
          role,
          nom,
          prenom,
        }))
      );

    if (insertError) {
      console.error("Erreur insertion rôles :", insertError);
      setMessage(`Erreur lors de l’enregistrement des rôles : ${insertError.message}`);
      return;
    }

    setMessage("Inscription réussie ! Veuillez vérifier votre email.");
    navigate("/login");
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Créer un compte</h1>
      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label className="block font-semibold">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border w-full px-3 py-2 rounded"
          />
        </div>

        <div>
          <label className="block font-semibold">Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="border w-full px-3 py-2 rounded"
          />
        </div>

        <div>
          <label className="block font-semibold">Nom</label>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            required
            className="border w-full px-3 py-2 rounded"
          />
        </div>

        <div>
          <label className="block font-semibold">Prénom</label>
          <input
            type="text"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            required
            className="border w-full px-3 py-2 rounded"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Rôle(s)</label>
          <label className="block">
            <input
              type="checkbox"
              value="coureur"
              checked={roles.includes("coureur")}
              onChange={handleCheckboxChange}
              className="mr-2"
            />
            Coureur
          </label>
          <label className="block">
            <input
              type="checkbox"
              value="organisateur"
              checked={roles.includes("organisateur")}
              onChange={handleCheckboxChange}
              className="mr-2"
            />
            Organisateur
          </label>
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Créer mon compte
        </button>

        {message && <p className="mt-4 text-sm text-red-600">{message}</p>}
      </form>
    </div>
  );
}

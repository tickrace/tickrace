import React, { useState } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  const handleRoleChange = (e) => {
    const { value, checked } = e.target;
    if (checked) {
      setRoles((prev) => [...prev, value]);
    } else {
      setRoles((prev) => prev.filter((role) => role !== value));
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email || !password || !nom || !prenom || roles.length === 0) {
      setError("Tous les champs sont obligatoires, y compris le rôle.");
      return;
    }

    if (roles.includes("admin")) {
      setError("Le rôle 'admin' ne peut pas être sélectionné.");
      return;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      console.error("Erreur création compte :", signUpError.message);
      setError("Erreur lors de la création du compte.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    if (!userId) {
      setError("Utilisateur non connecté après inscription.");
      return;
    }

    const insertData = roles.map((r) => ({
      user_id: userId,
      role: r,
      nom,
      prenom,
    }));

    const { error: insertError } = await supabase
      .from("profils_utilisateurs")
      .insert(insertData);

    if (insertError) {
      console.error("Erreur insertion profils_utilisateurs :", insertError.message);
      setError("Erreur lors de l’enregistrement des rôles.");
      return;
    }

    alert("Compte créé avec succès !");
    navigate("/login");
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Créer un compte</h1>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <form onSubmit={handleSignup} className="space-y-4">
        <input
          type="text"
          placeholder="Nom"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <input
          type="text"
          placeholder="Prénom"
          value={prenom}
          onChange={(e) => setPrenom(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <input
          type="email"
          placeholder="Adresse email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />

        <fieldset className="border p-3 rounded">
          <legend className="font-semibold mb-2">Rôle(s)</legend>
          <label className="block">
            <input
              type="checkbox"
              value="coureur"
              checked={roles.includes("coureur")}
              onChange={handleRoleChange}
              className="mr-2"
            />
            Coureur
          </label>
          <label className="block">
            <input
              type="checkbox"
              value="organisateur"
              checked={roles.includes("organisateur")}
              onChange={handleRoleChange}
              className="mr-2"
            />
            Organisateur
          </label>
        </fieldset>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Créer mon compte
        </button>
      </form>
    </div>
  );
}

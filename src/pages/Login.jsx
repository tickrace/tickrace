// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();
  const { setSession, setRoles, setActiveRole, setNom, setPrenom } = useUser();

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage(null);

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("Erreur de connexion : " + error.message);
      return;
    }

    const user = authData.user;
    const session = authData.session;
    setSession(session);

    // Charger les rôles dans profils_utilisateurs
    const { data: profils, error: profilsError } = await supabase
      .from("profils_utilisateurs")
      .select("*")
      .eq("user_id", user.id);

    if (profilsError || !profils || profils.length === 0) {
      setMessage("Aucun rôle trouvé pour cet utilisateur.");
      return;
    }

    const rolesList = profils.map((p) => p.role);
    const roleParDefaut = rolesList.includes("coureur")
      ? "coureur"
      : rolesList[0]; // Priorité au rôle coureur sinon 1er rôle

    const { nom, prenom } = profils.find((p) => p.role === roleParDefaut) || profils[0];

    setRoles(rolesList);
    setActiveRole(roleParDefaut);
    setNom(nom);
    setPrenom(prenom);

    // Redirection
    if (roleParDefaut === "organisateur") navigate("/organisateur/mon-espace");
    else if (roleParDefaut === "admin") navigate("/admin/dashboard");
    else if (roleParDefaut === "benevole") navigate("/benevole/mes-missions");
    else navigate("/profil");
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Connexion</h1>
      <form onSubmit={handleLogin} className="space-y-4">
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
          Se connecter
        </button>
      </form>

      {message && <p className="mt-4 text-red-600 text-sm">{message}</p>}
    </div>
  );
}

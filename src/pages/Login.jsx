// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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

    const { data: profils, error: profilsError } = await supabase
      .from("profils_utilisateurs")
      .select("*")
      .eq("user_id", user.id);

    if (profilsError || !profils || profils.length === 0) {
      setMessage("Aucune donnée de profil trouvée.");
      return;
    }

    const profil = profils[0];
    setNom(profil.nom);
    setPrenom(profil.prenom);
    setRoles(["coureur"]);
    setActiveRole("coureur");

    navigate("/profil");
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

      <div className="mt-4 text-center">
        <Link to="/forgot-password" className="text-blue-600 hover:underline">
          Mot de passe oublié ?
        </Link>
      </div>

      {message && <p className="mt-4 text-red-600 text-sm">{message}</p>}
    </div>
  );
}

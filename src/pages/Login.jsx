import React, { useState } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setError("Échec de la connexion : " + loginError.message);
      return;
    }

    const user = data.user;

    // On récupère les rôles depuis la table profils_utilisateurs
    const { data: profils, error: profilsError } = await supabase
      .from("profils_utilisateurs")
      .select("role")
      .eq("id", user.id);

    if (profilsError || !profils || profils.length === 0) {
      setError("Aucun rôle trouvé pour cet utilisateur.");
      return;
    }

    const roles = profils.map((p) => p.role);

    // Redirection en fonction du ou des rôles
    if (roles.includes("organisateur")) {
      navigate("/organisateur/espace");
    } else if (roles.includes("coureur")) {
      navigate("/coureur");
    } else {
      setError("Aucun rôle reconnu. Veuillez contacter l'administrateur.");
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Connexion</h2>
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block mb-1">Email</label>
          <input
            type="email"
            className="w-full border p-2 rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block mb-1">Mot de passe</label>
          <input
            type="password"
            className="w-full border p-2 rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-red-600">{error}</p>}

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Se connecter
        </button>
      </form>
    </div>
  );
}

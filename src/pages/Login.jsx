import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErreur("");
    setChargement(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: motDePasse,
    });

    if (error) {
      setErreur("Échec de la connexion : " + error.message);
    } else {
      navigate("/"); // ✅ redirection vers l'accueil
    }

    setChargement(false);
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-6">Connexion</h2>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block font-medium">
            Adresse email
          </label>
          <input
            type="email"
            id="email"
            required
            className="w-full border border-gray-300 rounded px-3 py-2 mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="password" className="block font-medium">
            Mot de passe
          </label>
          <input
            type="password"
            id="password"
            required
            className="w-full border border-gray-300 rounded px-3 py-2 mt-1"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
          />
        </div>

        {erreur && <p className="text-red-600">{erreur}</p>}

        <button
          type="submit"
          disabled={chargement}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {chargement ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </div>
  );
}

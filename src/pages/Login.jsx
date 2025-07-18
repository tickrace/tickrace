import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { UserContext } from "../contexts/UserContext";

export default function Login() {
  const navigate = useNavigate();
  const { setUser, setRoles } = useContext(UserContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("Échec de la connexion : " + error.message);
    } else {
      setMessage("Connexion réussie !");
      navigate("/"); // ✅ Redirection vers la page d'accueil
    }
  };

  return;
    }

    const user = data.user;
    const roles = user.user_metadata?.roles || [];

    setUser(user);
    setRoles(roles);

    // Redirection conditionnelle selon les rôles
    if (roles.includes("admin")) {
      navigate("/admin");
    } else if (roles.includes("organisateur")) {
      navigate("/monprofilorganisateur");
    } else if (roles.includes("coureur")) {
      navigate("/monprofilcoureur");
    } else {
      navigate("/");
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Connexion</h1>
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label>Email</label>
          <input
            type="email"
            className="w-full border rounded p-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Mot de passe</label>
          <input
            type="password"
            className="w-full border rounded p-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {errorMsg && <p className="text-red-600">{errorMsg}</p>}

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Se connecter
        </button>
      </form>
    </div>
  );
}

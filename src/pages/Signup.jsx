// src/pages/Signup.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../supabase";
import { Loader2 } from "lucide-react";

export default function Signup() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (password !== confirmPassword) {
      setMessage("⚠️ Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error("Erreur création compte :", error.message);
      setMessage("❌ Erreur : " + error.message);
      setLoading(false);
      return;
    }

    setMessage("✅ Compte créé. Vérifiez votre email pour confirmer.");
    setLoading(false);

    setTimeout(() => navigate("/login"), 3000);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50 px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-extrabold text-neutral-900 mb-6">
          Créer un compte
        </h1>

        <form onSubmit={handleSignup} className="space-y-5 text-left">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Adresse email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-neutral-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
              placeholder="exemple@mail.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-neutral-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Confirmer le mot de passe
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full border border-neutral-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 bg-neutral-900 text-white py-3 rounded-xl font-semibold hover:bg-neutral-800 transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : null}
            {loading ? "Création..." : "Créer le compte"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="text-neutral-700 hover:underline text-sm"
          >
            Déjà inscrit ? Connectez-vous
          </Link>
        </div>

        {message && (
          <p className="mt-4 text-center text-sm text-red-600">{message}</p>
        )}
      </div>
    </div>
  );
}

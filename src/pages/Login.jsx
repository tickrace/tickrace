// src/pages/Login.jsx
import React, { useMemo, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import { Loader2 } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { setSession, setRoles, setActiveRole, setNom, setPrenom } = useUser();

  const nextPath = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const next = sp.get("next");
    // sécurité basique : uniquement routes internes
    if (next && next.startsWith("/")) return next;
    return "/";
  }, [location.search]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("❌ Erreur de connexion : " + error.message);
      setLoading(false);
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
      setMessage("⚠️ Aucune donnée de profil trouvée.");
      setLoading(false);
      return;
    }

    const profil = profils[0];
    setNom(profil.nom);
    setPrenom(profil.prenom);

    // ⚠️ tu avais figé "coureur" : on garde tel quel pour l’instant
    setRoles(["coureur"]);
    setActiveRole("coureur");

    setLoading(false);
    navigate(nextPath);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50 px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-extrabold text-neutral-900 mb-2">Connexion</h1>
        <p className="text-sm text-neutral-600 mb-6">
          Connecte-toi pour accéder à ton espace (coureur, organisateur, bénévole).
        </p>

        <form onSubmit={handleLogin} className="space-y-5 text-left">
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
          

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 bg-neutral-900 text-white py-3 rounded-xl font-semibold hover:bg-neutral-800 transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : null}
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <Link to="/forgot-password" className="text-neutral-700 hover:underline">
            Mot de passe oublié ?
          </Link>

          <Link
            to={`/signup?next=${encodeURIComponent(nextPath)}`}
            className="text-neutral-900 font-semibold hover:underline"
          >
            Créer un compte
          </Link>
        </div>

        {message && (
          <p className="mt-4 text-center text-red-600 text-sm">{message}</p>
        )}
      </div>
    </div>
  );
}

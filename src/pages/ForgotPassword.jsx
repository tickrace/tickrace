// src/pages/ForgotPassword.jsx
import React, { useState } from "react";
import { supabase } from "../supabase";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (!email) {
      setMessage("Veuillez entrer votre adresse email.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        // Redirige vers ta page ResetPassword après clic mail
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        console.error("Erreur Supabase:", error);
        setMessage("❌ " + error.message);
      } else {
        setMessage("✅ Email de réinitialisation envoyé. Vérifiez votre boîte mail.");
      }
    } catch (err) {
      console.error("Erreur inattendue:", err);
      setMessage("❌ Erreur inattendue : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50 px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-extrabold text-neutral-900 mb-6">
          Mot de passe oublié
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5 text-left">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Adresse email
            </label>
            <input
              type="email"
              className="w-full border border-neutral-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
              placeholder="exemple@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 bg-neutral-900 text-white py-3 rounded-xl font-semibold hover:bg-neutral-800 transition disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {loading ? "Envoi en cours..." : "Réinitialiser"}
          </button>
        </form>

        <div className="mt-6">
          <Link to="/login" className="text-neutral-700 hover:underline text-sm">
            Retour à la connexion
          </Link>
        </div>

        {message && (
          <p className="mt-4 text-center text-sm text-neutral-700">{message}</p>
        )}
      </div>
    </div>
  );
}

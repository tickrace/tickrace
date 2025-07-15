import React, { useState } from "react";
import { supabase } from "../supabase";

export default function SignupOrganisateur() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({
        type: "success",
        text: "✅ Compte créé ! Vérifiez vos emails pour confirmer votre inscription.",
      });
    }

    setLoading(false);
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Créer un compte organisateur</h1>
      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border px-3 py-2 rounded"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Mot de passe
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border px-3 py-2 rounded"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white px-4 py-2 rounded"
        >
          {loading ? "Chargement..." : "Créer mon compte"}
        </button>

        {message && (
          <p
            className={`text-sm mt-2 ${
              message.type === "error"
                ? "text-red-500"
                : "text-green-600"
            }`}
          >
            {message.text}
          </p>
        )}
      </form>
    </div>
  );
}

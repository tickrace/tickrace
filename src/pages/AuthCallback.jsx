// src/pages/AuthCallback.jsx
import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../supabase";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    (async () => {
      // Si Supabase renvoie une erreur dans l’URL
      const error = params.get("error") || params.get("error_description");
      if (error) {
        navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true });
        return;
      }

      // Attendre que la session soit dispo
      const { data } = await supabase.auth.getSession();
      const session = data?.session;

      const next = params.get("next") || "/";

      // Pas connecté -> renvoyer login (en gardant next)
      if (!session) {
        navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true });
        return;
      }

      // Connecté -> go next
      navigate(next, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200 p-6 text-center max-w-md w-full">
        <div className="text-lg font-extrabold">Connexion en cours…</div>
        <div className="mt-2 text-sm text-neutral-600">
          On finalise ton accès Tickrace.
        </div>
      </div>
    </div>
  );
}

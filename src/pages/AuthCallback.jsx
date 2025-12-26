// src/pages/AuthCallback.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { getSafeNext } from "../utils/redirect";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      const url = new URL(window.location.href);
      const next = getSafeNext(url.searchParams.get("next"));
      // Supabase finalise la session si besoin (selon le flow)
      await supabase.auth.getSession();
      navigate(next, { replace: true });
    };
    run();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      Connexion en cours…
    </div>
  );
}

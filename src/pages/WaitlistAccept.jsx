// src/pages/WaitlistAccept.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "../supabase";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function WaitlistAccept() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const token = sp.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Chargement…");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setLoading(true);
      setError("");

      if (!token) {
        setLoading(false);
        setStatus("Lien invalide");
        setError("Token manquant dans l’URL.");
        return;
      }

      try {
        setStatus("Validation du lien…");

        const { data, error } = await supabase.functions.invoke("waitlist-accept", {
          body: { token },
        });

        if (error) throw error;

        // ✅ Attendu idéalement côté function:
        // { ok: true, next: "/inscription/<courseId>?formatId=...&token=..." }
        const next = data?.next;

        if (!alive) return;

        if (next) {
          setStatus("Redirection…");
          navigate(next, { replace: true });
          return;
        }

        // fallback
        setLoading(false);
        setStatus(data?.ok ? "Invitation validée" : "Lien invalide");
        if (!data?.ok) setError(data?.message || "Impossible de valider le lien.");
      } catch (e) {
        console.error("WAITLIST_ACCEPT_PAGE_ERROR", e);
        if (!alive) return;
        setLoading(false);
        setStatus("Erreur");
        setError("Impossible de valider l’invitation (token expiré ? déjà utilisé ?).");
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [token, navigate]);

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-neutral-900">Invitation liste d’attente</h1>
        <p className="mt-2 text-sm text-neutral-600">
          {status}
        </p>

        {!!error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/"
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
          >
            Retour à l’accueil
          </Link>

          <a
            href="mailto:support@tickrace.com"
            className={cls(
              "rounded-xl px-4 py-2 text-sm font-semibold",
              "bg-neutral-900 text-white hover:bg-black"
            )}
          >
            Contacter le support
          </a>
        </div>

        <div className="mt-4 text-xs text-neutral-400 break-all">
          Token: {token || "—"}
        </div>
      </div>
    </div>
  );
}

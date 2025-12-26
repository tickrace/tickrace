import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../supabase";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function WaitlistAccept() {
  const [sp] = useSearchParams();
  const token = useMemo(() => sp.get("token") || "", [sp]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setLoading(true);
      setError("");
      setPayload(null);

      if (!token) {
        setError("Lien invalide : token manquant.");
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("waitlist-accept", {
          body: { token },
        });

        if (error) throw error;
        if (!alive) return;

        if (!data?.ok) {
          setError(data?.message || "Lien invalide ou expiré.");
        } else {
          setPayload(data);
        }
      } catch (e) {
        console.error("WAITLIST_ACCEPT_ERROR", e);
        if (alive) setError("Erreur lors de la validation de l’invitation.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [token]);

  // ✅ IMPORTANT : on ne connait pas ta route d’inscription.
  // Mets ici LA route que tu veux.
  // Exemple (à adapter) : `/inscription/${payload.courseId}?formatId=${payload.formatId}`
  const nextHref =
    payload?.courseId && payload?.formatId
      ? `/inscription/${payload.courseId}?formatId=${payload.formatId}&invite_token=${encodeURIComponent(token)}`
      : "/";

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-neutral-900">Invitation – Liste d’attente</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Validation de ton invitation…
      </p>

      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        {loading ? (
          <div className="text-sm text-neutral-600">Chargement…</div>
        ) : error ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </div>
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
            >
              Retour
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Invitation validée ✅
            </div>

            <div className="text-sm text-neutral-700">
              <div>
                <span className="text-neutral-500">Email :</span>{" "}
                <span className="font-medium">{payload.email}</span>
              </div>
              <div>
                <span className="text-neutral-500">Format :</span>{" "}
                <span className="font-medium">{payload.formatId}</span>
              </div>
              <div>
                <span className="text-neutral-500">Course :</span>{" "}
                <span className="font-medium">{payload.courseId}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-2">
              <a
                href={nextHref}
                className={cls(
                  "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold",
                  "bg-neutral-900 text-white hover:bg-black"
                )}
              >
                Continuer
              </a>
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
              >
                Accueil
              </Link>
            </div>

            <p className="text-xs text-neutral-500">
              ⚠️ Si le bouton “Continuer” ne mène pas au bon endroit, remplace <code>/inscription/...</code> dans ce fichier
              par ta route réelle d’inscription.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

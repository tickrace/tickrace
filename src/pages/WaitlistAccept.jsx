// src/pages/WaitlistAccept.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { CheckCircle2, AlertCircle, Loader2, ArrowRight } from "lucide-react";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function WaitlistAccept() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  const token = sp.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [payload, setPayload] = useState(null);

  // ✅ Ta route inscription réelle (App.jsx) : /inscription/:courseId
  const nextUrl = useMemo(() => {
    if (!payload?.courseId || !payload?.formatId || !token) return "";

    const qs = new URLSearchParams();
    qs.set("formatId", payload.formatId);
    qs.set("inviteToken", token);
    if (payload.email) qs.set("email", payload.email);

    return `/inscription/${payload.courseId}?${qs.toString()}`;
  }, [payload, token]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setErr("");
      setPayload(null);

      if (!token) {
        setLoading(false);
        setErr("Token manquant. Vérifie le lien reçu par email.");
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("waitlist-accept", {
          body: { token },
        });

        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || "Invitation invalide.");

        if (!alive) return;
        setPayload(data);
      } catch (e) {
        console.error("WAITLIST_ACCEPT_ERROR", e);
        if (!alive) return;
        setErr(
          e?.message ||
            "Impossible de valider l’invitation. Le token est peut-être expiré ou déjà consommé."
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-neutral-600" />
          ) : err ? (
            <AlertCircle className="h-6 w-6 text-rose-600" />
          ) : (
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          )}

          <div className="min-w-0">
            <h1 className="text-xl font-bold text-neutral-900">
              {loading
                ? "Validation de l’invitation…"
                : err
                ? "Invitation invalide"
                : "Invitation validée ✅"}
            </h1>

            <p className="mt-1 text-sm text-neutral-600">
              {loading
                ? "Merci de patienter."
                : err
                ? "Le lien est peut-être expiré, déjà utilisé, ou incorrect."
                : "Tu peux maintenant poursuivre vers l’inscription."}
            </p>
          </div>
        </div>

        {err && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {err}
            <div className="mt-2 text-xs text-rose-700">
              Demande à l’organisateur de renvoyer une invitation si besoin.
            </div>
          </div>
        )}

        {!loading && !err && payload && (
          <>
            <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
              <div className="text-neutral-700 space-y-1">
                <div>
                  Email : <b>{payload.email || "—"}</b>
                </div>
                <div>
                  Course : <b>{payload.courseId}</b>
                </div>
                <div>
                  Format : <b>{payload.formatId}</b>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-800">
                ← Retour
              </Link>

              <button
                onClick={() => navigate(nextUrl)}
                disabled={!nextUrl}
                className={cls(
                  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold",
                  !nextUrl
                    ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                    : "bg-neutral-900 text-white hover:bg-black"
                )}
              >
                Continuer vers l’inscription
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 text-xs text-neutral-500 break-all">
              Redirection : <span className="font-mono">{nextUrl}</span>
              <br />
              (Si l’utilisateur n’est pas connecté, <b>ProtectedRoute</b> le renverra vers Login.)
            </div>
          </>
        )}
      </div>
    </div>
  );
}

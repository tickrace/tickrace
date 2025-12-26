// src/pages/Signup.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "../supabase";
import { Loader2, ShieldCheck, ArrowRight } from "lucide-react";

/* ------------------------- Helpers ------------------------- */
function getSafeNext(next) {
  if (!next) return "/";
  // autoriser uniquement les chemins internes
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

function getIntentCopy(intent) {
  switch (intent) {
    case "benevole":
      return {
        title: "Créer un compte bénévole",
        subtitle:
          "Un compte est nécessaire pour accéder à ton espace, consulter ton planning, confirmer ta mission et utiliser le chat équipe (accès sécurisé).",
      };
    case "inscription":
      return {
        title: "Créer un compte coureur",
        subtitle:
          "Un compte permet de sécuriser ton inscription, retrouver tes justificatifs, suivre ton statut, et éviter de ressaisir tes infos aux prochaines courses.",
      };
    case "organisateur":
      return {
        title: "Créer un compte organisateur",
        subtitle:
          "Un compte organisateur te donne accès à ton back-office : création d’épreuves, bénévoles, inscriptions, emails, et suivi financier.",
      };
    default:
      return {
        title: "Créer un compte",
        subtitle:
          "Un compte Tickrace te donne un accès sécurisé et un suivi (inscriptions, espace bénévole, organisation).",
      };
  }
}

/* ------------------------- Page ------------------------- */
export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const intent = params.get("intent") || "default";
  const next = getSafeNext(params.get("next"));

  const { title, subtitle } = useMemo(() => getIntentCopy(intent), [intent]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(null);
  const [tone, setTone] = useState("info"); // info | error | success
  const [loading, setLoading] = useState(false);

  // si déjà connecté, go next direct
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) navigate(next, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginLink = useMemo(() => {
    const sp = new URLSearchParams();
    if (intent && intent !== "default") sp.set("intent", intent);
    if (next && next !== "/") sp.set("next", next);
    const qs = sp.toString();
    return `/login${qs ? `?${qs}` : ""}`;
  }, [intent, next]);

  const handleSignup = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (password !== confirmPassword) {
      setTone("error");
      setMessage("⚠️ Les mots de passe ne correspondent pas.");
      return;
    }
    if (!email.includes("@")) {
      setTone("error");
      setMessage("⚠️ Email invalide.");
      return;
    }

    setLoading(true);
    setTone("info");

    try {
      // Après clic email, on revient sur /auth/callback qui redirige vers `next`
      const emailRedirectTo = `${window.location.origin}/auth/callback?intent=${encodeURIComponent(
        intent
      )}&next=${encodeURIComponent(next)}`;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo },
      });

      if (error) throw error;

      // Selon config Supabase : session immédiate ou confirmation email requise
      if (data?.session?.user) {
        setTone("success");
        setMessage("✅ Compte créé, connexion réussie. Redirection…");
        setTimeout(() => navigate(next, { replace: true }), 600);
      } else {
        setTone("success");
        setMessage(
          "✅ Compte créé. Vérifie ton email pour confirmer, puis tu seras redirigé automatiquement vers ton espace."
        );
      }
    } catch (err) {
      console.error("Erreur création compte :", err?.message || err);
      setTone("error");
      setMessage("❌ Erreur : " + (err?.message || "Impossible de créer le compte."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50 px-4">
      <div className="max-w-md w-full">
        <div className="rounded-3xl bg-white ring-1 ring-neutral-200 shadow-sm p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <ShieldCheck className="h-5 w-5 text-neutral-900" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900">
                {title}
              </h1>
              <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>
            </div>
          </div>

          {/* Petit rappel destination */}
          {next && next !== "/" ? (
            <div className="mt-4 rounded-2xl bg-neutral-50 ring-1 ring-neutral-200 px-4 py-3 text-xs text-neutral-700">
              Après inscription, tu seras redirigé vers :{" "}
              <span className="font-semibold break-all">{next}</span>
            </div>
          ) : null}

          <form onSubmit={handleSignup} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                Adresse email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                placeholder="exemple@mail.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-900 text-white py-3 text-sm font-extrabold hover:bg-neutral-800 transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : null}
              {loading ? "Création..." : "Créer le compte"}
              {!loading ? <ArrowRight className="h-4 w-4 opacity-80" /> : null}
            </button>
          </form>

          <div className="mt-5 text-center">
            <Link to={loginLink} className="text-sm text-neutral-700 hover:underline">
              Déjà inscrit ? Se connecter
            </Link>
          </div>

          {message ? (
            <div
              className={[
                "mt-4 rounded-2xl px-4 py-3 text-sm ring-1",
                tone === "error"
                  ? "bg-red-50 text-red-800 ring-red-200"
                  : tone === "success"
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                  : "bg-neutral-50 text-neutral-800 ring-neutral-200",
              ].join(" ")}
            >
              {message}
              {tone === "success" ? (
                <div className="mt-2 text-xs text-neutral-600">
                  Si tu as confirmé l’email mais que rien ne se passe,{" "}
                  <Link to={loginLink} className="font-semibold text-neutral-900 underline underline-offset-4">
                    clique ici pour te connecter
                  </Link>
                  .
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

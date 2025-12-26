// src/pages/Login.jsx
import React, { useMemo, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import { Loader2, ShieldCheck, ArrowRight } from "lucide-react";

/* ------------------------- Helpers ------------------------- */
function getSafeNext(next) {
  if (!next) return "/";
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

function getIntentCopy(intent) {
  switch (intent) {
    case "benevole":
      return {
        title: "Connexion bénévole",
        subtitle: "Connecte-toi pour accéder à ton espace (planning, mission, chat).",
      };
    case "inscription":
      return {
        title: "Connexion coureur",
        subtitle: "Connecte-toi pour finaliser ton inscription et retrouver tes infos.",
      };
    case "organisateur":
      return {
        title: "Connexion organisateur",
        subtitle: "Connecte-toi pour accéder à ton espace organisateur.",
      };
    default:
      return {
        title: "Connexion",
        subtitle: "Connecte-toi pour accéder à Tickrace.",
      };
  }
}

/* ------------------------- Page ------------------------- */
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession, setRoles, setActiveRole, setNom, setPrenom } = useUser();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const intent = params.get("intent") || "default";
  const next = getSafeNext(params.get("next"));

  const { title, subtitle } = useMemo(() => getIntentCopy(intent), [intent]);

  const signupLink = useMemo(() => {
    const sp = new URLSearchParams();
    if (intent && intent !== "default") sp.set("intent", intent);
    if (next && next !== "/") sp.set("next", next);
    const qs = sp.toString();
    return `/signup${qs ? `?${qs}` : ""}`;
  }, [intent, next]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(null);
  const [tone, setTone] = useState("info"); // info | error | success
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage(null);
    setTone("info");
    setLoading(true);

    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const user = authData.user;
      const session = authData.session;
      setSession(session);

      // Profil (best effort)
      const { data: profils, error: profilsError } = await supabase
        .from("profils_utilisateurs")
        .select("nom, prenom, role")
        .eq("user_id", user.id);

      if (!profilsError && profils && profils.length > 0) {
        // nom/prenom (si dispo)
        setNom(profils[0]?.nom || "");
        setPrenom(profils[0]?.prenom || "");

        // rôles (si tu en as en base)
        const roles = Array.from(new Set(profils.map((p) => p.role).filter(Boolean)));
        if (roles.length) {
          setRoles(roles);
          setActiveRole(roles.includes("organisateur") ? "organisateur" : roles[0]);
        } else {
          // fallback
          setRoles(["coureur"]);
          setActiveRole("coureur");
        }
      } else {
        // fallback si pas de profil
        setRoles(["coureur"]);
        setActiveRole("coureur");
      }

      setTone("success");
      setMessage("✅ Connecté. Redirection…");

      // ✅ redirection selon provenance (next)
      setTimeout(() => navigate(next, { replace: true }), 300);
    } catch (err) {
      setTone("error");
      setMessage("❌ Erreur de connexion : " + (err?.message || "Impossible de se connecter."));
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
              <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900">{title}</h1>
              <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>
            </div>
          </div>

          {next && next !== "/" ? (
            <div className="mt-4 rounded-2xl bg-neutral-50 ring-1 ring-neutral-200 px-4 py-3 text-xs text-neutral-700">
              Après connexion, tu seras redirigé vers :{" "}
              <span className="font-semibold break-all">{next}</span>
            </div>
          ) : null}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">Adresse email</label>
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
              <label className="block text-sm font-semibold text-neutral-700 mb-1">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {loading ? "Connexion..." : "Se connecter"}
              {!loading ? <ArrowRight className="h-4 w-4 opacity-80" /> : null}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <Link to="/forgot-password" className="text-neutral-700 hover:underline">
              Mot de passe oublié ?
            </Link>

            <Link to={signupLink} className="font-semibold text-neutral-900 hover:underline">
              Créer un compte
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
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

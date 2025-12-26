// src/pages/BenevoleInscription.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabase";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  UserPlus,
  LogIn,
} from "lucide-react";

/* ------------------------------ UI Helpers ------------------------------ */

const Container = ({ children }) => (
  <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 lg:px-8">{children}</div>
);

const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200 ${className}`}>{children}</div>
);

const Btn = ({ variant = "dark", className = "", ...props }) => {
  const variants = {
    dark: "bg-neutral-900 text-white hover:bg-neutral-800",
    light: "bg-white text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50",
    orange: "bg-orange-600 text-white hover:bg-orange-500",
    subtle: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
  };
  return (
    <button
      {...props}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className,
      ].join(" ")}
    />
  );
};

function safe(s) {
  return (s || "").toString().trim();
}
function normalizeEmail(s) {
  return safe(s).toLowerCase();
}

/* ====================================================================== */

export default function BenevoleInscription() {
  const { courseId } = useParams();

  const [course, setCourse] = useState(null);

  const [pageLoading, setPageLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);

  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    email: "",
    telephone: "",
  });

  const publicCourseTitle = useMemo(() => {
    if (!course) return "cette course";
    return `${course.nom}${course.lieu ? ` (${course.lieu})` : ""}`;
  }, [course]);

  const nextPath = useMemo(() => `/benevoles/${courseId}`, [courseId]);
  const loginLink = useMemo(() => `/login?next=${encodeURIComponent(nextPath)}&flow=benevole&courseId=${courseId}`, [nextPath, courseId]);
  const signupLink = useMemo(() => `/signup?next=${encodeURIComponent(nextPath)}&flow=benevole&courseId=${courseId}`, [nextPath, courseId]);

  /* ------------------------------ Load course + auth ------------------------------ */

  useEffect(() => {
    let abort = false;

    (async () => {
      setPageLoading(true);
      setError("");

      try {
        // Course (public)
        const { data, error: cErr } = await supabase
          .from("courses")
          .select("id, nom, lieu, image_url")
          .eq("id", courseId)
          .maybeSingle();

        if (cErr) console.error(cErr);
        if (!abort) setCourse(data ?? null);

        // Auth
        const { data: sess } = await supabase.auth.getSession();
        const user = sess?.session?.user || null;
        if (!abort) {
          setSessionUser(user);
          setAuthChecked(true);
        }

        // Prefill email si connecté
        if (user?.email && !abort) {
          setForm((f) => ({ ...f, email: f.email || user.email }));
        }
      } finally {
        if (!abort) setPageLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const user = session?.user || null;
      setSessionUser(user);
      setAuthChecked(true);
      if (user?.email) setForm((f) => ({ ...f, email: f.email || user.email }));
    });

    return () => {
      abort = true;
      sub?.subscription?.unsubscribe?.();
    };
  }, [courseId]);

  /* ------------------------------ Form handlers ------------------------------ */

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setSending(true);

    try {
      // ✅ On oblige le login
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess?.session?.access_token;
      const user = sess?.session?.user;

      if (!user || !accessToken) {
        throw new Error("Tu dois être connecté(e) pour t’inscrire comme bénévole.");
      }

      const payload = {
        course_id: courseId,
        nom: safe(form.nom),
        prenom: safe(form.prenom),
        // on garde l’email saisi mais on force la cohérence avec le compte
        email: normalizeEmail(form.email || user.email),
        telephone: safe(form.telephone),
        website: "", // honeypot
      };

      if (!payload.email) throw new Error("Email invalide.");
      if (!payload.nom || !payload.prenom || !payload.telephone) {
        throw new Error("Champs requis manquants.");
      }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/volunteer-signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Erreur inconnue");

      setInfo("Ton inscription est enregistrée. Tu peux accéder à ton espace bénévole (planning + chat).");
      setDone(true);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Erreur réseau.");
    } finally {
      setSending(false);
    }
  };

  /* ------------------------------ Render states ------------------------------ */

  if (pageLoading || !authChecked) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Container>
          <div className="py-10">
            <div className="flex items-center gap-2 text-neutral-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          </div>
        </Container>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Container>
          <div className="py-10 space-y-4">
            <Card className="p-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                <div>
                  <h1 className="text-2xl font-extrabold">Merci 🙌</h1>
                  <p className="mt-1 text-neutral-700">
                    Ton inscription bénévole est enregistrée pour <strong>{publicCourseTitle}</strong>.
                  </p>

                  {info ? <p className="mt-2 text-sm text-neutral-600">{info}</p> : null}

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link to={`/benevole/${courseId}`} className="inline-flex">
                      <Btn variant="dark">
                        <ArrowRight className="h-4 w-4" />
                        Aller à mon espace bénévole
                      </Btn>
                    </Link>

                    <Link to="/courses" className="inline-flex">
                      <Btn variant="light">
                        Retour aux courses <ArrowRight className="h-4 w-4 opacity-70" />
                      </Btn>
                    </Link>
                  </div>

                  <p className="mt-4 text-xs text-neutral-500">
                    Ton compte Tickrace sert à sécuriser l’accès (missions, planning, chat, notifications). Aucun spam.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </Container>
      </div>
    );
  }

  // ✅ Pas connecté -> on bloque l’accès au formulaire et on pousse vers Login/Signup
  if (!sessionUser) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Container>
          <div className="py-10 space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-extrabold">Devenir bénévole</h1>
              {course ? (
                <p className="text-sm text-neutral-600">
                  Pour <strong>{course.nom}</strong> — {course.lieu}
                </p>
              ) : (
                <p className="text-sm text-neutral-600">Course inconnue.</p>
              )}
            </div>

            <Card className="p-6">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-6 w-6 text-neutral-900" />
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold">Connexion requise</h2>
                  <p className="mt-1 text-sm text-neutral-700">
                    Pour gérer ton planning, tes missions et le chat équipe, Tickrace demande un compte (gratuit).
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Link to={loginLink}>
                      <Btn variant="dark" className="w-full">
                        <LogIn className="h-4 w-4" /> Se connecter
                      </Btn>
                    </Link>
                    <Link to={signupLink}>
                      <Btn variant="light" className="w-full">
                        <UserPlus className="h-4 w-4" /> Créer un compte
                      </Btn>
                    </Link>
                  </div>

                  <div className="mt-4 rounded-xl bg-neutral-50 ring-1 ring-neutral-200 p-3">
                    <div className="text-xs font-semibold text-neutral-700">Pourquoi c’est nécessaire ?</div>
                    <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                      <li>• Accès sécurisé à ton espace (missions, check-in, messages)</li>
                      <li>• Planning toujours à jour (modifs en temps réel)</li>
                      <li>• Historique et preuves (qui a confirmé / qui est arrivé)</li>
                    </ul>
                  </div>

                  <p className="mt-3 text-xs text-neutral-500">
                    Tu reviendras automatiquement ici après connexion.
                  </p>
                </div>
              </div>
            </Card>

            <div className="text-xs text-neutral-500">
              Déjà bénévole et tu as un lien d’accès direct ? Utilise plutôt l’espace bénévole :{" "}
              <Link to={`/benevole/${courseId}`} className="text-orange-700 hover:underline">
                /benevole/{courseId}
              </Link>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  /* ------------------------------ Form (connected) ------------------------------ */

  return (
    <div className="min-h-screen bg-neutral-50">
      <Container>
        <div className="py-10 space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold">Devenir bénévole</h1>
            {course ? (
              <p className="text-sm text-neutral-600">
                Pour <strong>{course.nom}</strong> — {course.lieu}
              </p>
            ) : (
              <p className="text-sm text-neutral-600">Course inconnue.</p>
            )}
          </div>

          {error ? (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-3 text-red-700">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" /> {error}
              </div>
            </div>
          ) : null}

          <Card className="p-6">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="rounded-xl bg-neutral-50 ring-1 ring-neutral-200 p-3 text-sm text-neutral-700">
                Connecté(e) en tant que <b>{sessionUser?.email}</b>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-neutral-700">Prénom</span>
                  <input
                    name="prenom"
                    required
                    value={form.prenom}
                    onChange={onChange}
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-neutral-700">Nom</span>
                  <input
                    name="nom"
                    required
                    value={form.nom}
                    onChange={onChange}
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-neutral-700">Email</span>
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={onChange}
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Astuce : utilise le même email que ton compte (recommandé).
                </p>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-neutral-700">Téléphone</span>
                <input
                  name="telephone"
                  required
                  value={form.telephone}
                  onChange={onChange}
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                />
              </label>

              <Btn type="submit" variant="orange" disabled={sending} className="w-full sm:w-auto">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {sending ? "Envoi…" : "Valider mon inscription bénévole"}
              </Btn>

              <p className="text-xs text-neutral-500">
                Les infos collectées servent uniquement à l’organisation de la course (planning, missions, communication).
              </p>
            </form>
          </Card>
        </div>
      </Container>
    </div>
  );
}

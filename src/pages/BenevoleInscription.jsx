// src/pages/BenevoleInscription.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabase";
import { Loader2, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";

const Container = ({ children }) => (
  <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 lg:px-8">{children}</div>
);

const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200 ${className}`}>{children}</div>
);

function safe(s) {
  return (s || "").toString().trim();
}
function normalizeEmail(s) {
  return safe(s).toLowerCase();
}

export default function BenevoleInscription() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [info, setInfo] = useState(""); // message non bloquant (déjà inscrit, etc.)
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

  useEffect(() => {
    let abort = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("courses")
        .select("id, nom, lieu, image_url")
        .eq("id", courseId)
        .maybeSingle();

      if (!abort) {
        if (error) console.error(error);
        setCourse(data ?? null);
        setLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
  }, [courseId]);

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
      const payload = {
        course_id: courseId,
        nom: safe(form.nom),
        prenom: safe(form.prenom),
        email: normalizeEmail(form.email),
        telephone: safe(form.telephone),
        status: "registered",
        // user_id reste null ici (sera “claim” au 1er login via EspaceBenevole)
      };

      if (!payload.email) throw new Error("Email invalide.");
      if (!payload.nom || !payload.prenom || !payload.telephone) throw new Error("Champs requis manquants.");

      // 1) On tente un upsert (course_id + email unique)
      // ⚠️ IMPORTANT: ton index unique s'appelle benevoles_course_email_unique (course_id, email)
      const { data: up, error: upErr } = await supabase
        .from("benevoles")
        .upsert(payload, { onConflict: "course_id,email" })
        .select("id, status, created_at")
        .maybeSingle();

      if (upErr) {
        // Si RLS empêche l'insert (souvent le cas), tu peux repasser via Edge Function.
        throw upErr;
      }

      // Si l'utilisateur était déjà enregistré, on le signale gentiment
      if (up) {
        setInfo("Votre inscription est enregistrée. Si vous étiez déjà inscrit, vos infos ont été mises à jour.");
      }

      setDone(true);
    } catch (err) {
      console.error(err);

      // Fallback possible : si tu veux conserver l'Edge Function,
      // tu peux réactiver ce fallback en cas de RLS:
      // if (String(err?.message || "").includes("permission")) { ...invoke function... }

      setError(err?.message || "Erreur réseau / permissions.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
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
                    Votre inscription bénévole est enregistrée pour <strong>{publicCourseTitle}</strong>.
                  </p>
                  {info ? <p className="mt-2 text-sm text-neutral-600">{info}</p> : null}

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      to="/courses"
                      className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                    >
                      Retour aux courses <ArrowRight className="h-4 w-4 opacity-70" />
                    </Link>
                  </div>

                  <p className="mt-4 text-xs text-neutral-500">
                    L’organisation pourra ensuite vous inviter par email vers l’espace bénévole (planning + chat).
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </Container>
      </div>
    );
  }

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
              <div className="mt-1 text-sm text-red-700/90">
                Si tu as activé des policies strictes, l’inscription publique peut nécessiter une Edge Function
                (service role) pour écrire dans la table.
              </div>
            </div>
          ) : null}

          <Card className="p-6">
            <form onSubmit={onSubmit} className="space-y-4">
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

              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-60"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {sending ? "Envoi…" : "Valider mon inscription bénévole"}
              </button>

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

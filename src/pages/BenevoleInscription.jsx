import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../supabase";

export default function BenevoleInscription() {
  const { courseId } = useParams();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
    message: "",
    website: "", // honeypot anti-spam (doit rester vide)
  });

  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let abort = false;
    (async () => {
      setLoading(true);
      const { data, error: e } = await supabase
        .from("courses")
        .select("id, nom, lieu, image_url, en_ligne")
        .eq("id", courseId)
        .maybeSingle();
      if (!abort) {
        if (e) console.error(e);
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
    setSending(true);

    try {
      // validations rapides
      if (!form.prenom || !form.nom || !form.email || !form.telephone) {
        throw new Error("Merci de remplir tous les champs obligatoires.");
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/volunteer-signup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_id: courseId,
            ...form,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Une erreur est survenue.");
      setDone(true);
    } catch (err) {
      setError(err.message || "Erreur réseau.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <p>Chargement…</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-3">
        <h1 className="text-2xl font-bold">Épreuve introuvable</h1>
        <p className="text-neutral-600">
          Le lien d’inscription bénévole est invalide ou l’épreuve n’existe pas.
        </p>
        <Link to="/courses" className="text-orange-600 underline">
          ← Retour aux épreuves
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold">Merci 🙌</h1>
        <p>
          Votre proposition d’aide a bien été envoyée pour{" "}
          <strong>{course.nom}</strong> ({course.lieu}). Un organisateur vous
          recontactera rapidement.
        </p>
        <Link to={`/courses/${course.id}`} className="text-orange-600 underline">
          ← Retour à l’épreuve
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Titre */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Devenir bénévole</h1>
        <p className="text-sm text-neutral-600">
          Pour <strong>{course.nom}</strong> — {course.lieu}
        </p>
      </div>

      {/* Alerte erreur */}
      {error ? (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-700">
          {error}
        </div>
      ) : null}

      {/* Formulaire */}
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium">Prénom *</span>
            <input
              name="prenom"
              required
              value={form.prenom}
              onChange={onChange}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Nom *</span>
            <input
              name="nom"
              required
              value={form.nom}
              onChange={onChange}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium">Email *</span>
          <input
            type="email"
            name="email"
            required
            value={form.email}
            onChange={onChange}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Téléphone *</span>
          <input
            name="telephone"
            required
            value={form.telephone}
            onChange={onChange}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Message (optionnel)</span>
          <textarea
            name="message"
            rows={4}
            value={form.message}
            onChange={onChange}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            placeholder="Disponibilités, préférences de mission, etc."
          />
        </label>

        {/* Honeypot anti-spam (caché) */}
        <div className="hidden" aria-hidden>
          <label>
            Site web (ne pas remplir)
            <input
              name="website"
              value={form.website}
              onChange={onChange}
              autoComplete="off"
              tabIndex={-1}
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={sending}
          className="rounded-xl bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-60"
        >
          {sending ? "Envoi…" : "Envoyer ma candidature bénévole"}
        </button>
      </form>

      <div className="text-xs text-neutral-500">* Champs obligatoires</div>
    </div>
  );
}

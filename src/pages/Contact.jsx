// src/pages/Contact.jsx
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Mail,
  MessageCircle,
  Users,
  Building2,
  Newspaper,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Shield,
} from "lucide-react";
import { supabase } from "../supabase";

const Container = ({ children, className = "" }) => (
  <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>
    {children}
  </div>
);

const Card = ({ icon: Icon, title, desc, to, badge }) => (
  <Link
    to={to}
    className={[
      "group relative rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm",
      "hover:shadow-md hover:border-neutral-300 transition",
      "focus:outline-none focus:ring-2 focus:ring-orange-300",
    ].join(" ")}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
          <Icon className="h-5 w-5 text-neutral-800" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
            {badge ? (
              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700 ring-1 ring-orange-200">
                {badge}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-neutral-600">{desc}</p>
        </div>
      </div>

      <ArrowRight className="h-5 w-5 text-neutral-400 group-hover:text-neutral-700 transition" />
    </div>
  </Link>
);

function Field({ label, hint, required, children }) {
  return (
    <label className="block">
      <div className="flex items-end justify-between gap-2">
        <span className="text-xs font-semibold text-neutral-700">
          {label}
          {required ? " *" : ""}
        </span>
        {hint ? <span className="text-[11px] text-neutral-500">{hint}</span> : null}
      </div>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none",
        "focus:ring-2 focus:ring-orange-300",
        props.className || "",
      ].join(" ")}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className={[
        "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none",
        "focus:ring-2 focus:ring-orange-300",
        props.className || "",
      ].join(" ")}
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className={[
        "w-full min-h-[140px] rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none",
        "focus:ring-2 focus:ring-orange-300",
        props.className || "",
      ].join(" ")}
    />
  );
}

export default function Contact() {
  const [form, setForm] = useState({
    role: "coureur",
    categorie: "support_general",
    nom: "",
    email: "",
    telephone: "",
    organisation: "",
    lien: "",
    sujet: "",
    message: "",
    consent: false,
    // honeypot (anti-spam)
    website: "",
  });

  const [status, setStatus] = useState({ type: "idle", msg: "" });
  const [loading, setLoading] = useState(false);

  const categoriesByRole = useMemo(() => {
    return {
      coureur: [
        { value: "support_general", label: "Support général" },
        { value: "inscription", label: "Inscription / dossard / infos course" },
        { value: "paiement", label: "Paiement / reçu / remboursement" },
        { value: "bug", label: "Bug / problème technique" },
        { value: "compte", label: "Compte / connexion" },
      ],
      organisateur: [
        { value: "support_general", label: "Support général organisateur" },
        { value: "publication", label: "Publication / modification d’épreuve" },
        { value: "inscrits", label: "Gestion des inscrits / exports / dossards" },
        { value: "paiement", label: "Paiements / reversements" },
        { value: "demo", label: "Demande de démo / onboarding" },
        { value: "bug", label: "Bug / problème technique" },
      ],
      partenaire: [
        { value: "partenariat", label: "Proposition de partenariat" },
        { value: "media", label: "Contenu / affiliation / média" },
        { value: "tech", label: "Intégration / API / timing" },
        { value: "autre", label: "Autre" },
      ],
      presse: [
        { value: "presse", label: "Demande presse / kit média" },
        { value: "interview", label: "Interview / interview fondateur" },
        { value: "evenement", label: "Couverture d’événement" },
      ],
      autre: [{ value: "autre", label: "Autre" }],
    };
  }, []);

  const roleLabel = useMemo(() => {
    const map = {
      coureur: "Coureur",
      organisateur: "Organisateur",
      partenaire: "Partenaire",
      presse: "Presse / média",
      autre: "Autre",
    };
    return map[form.role] || "Contact";
  }, [form.role]);

  const showOrganisation = form.role === "organisateur" || form.role === "partenaire";
  const showLien = form.role !== "presse"; // utile pour coureur/orga/partenaire
  const showTelephone = form.role === "organisateur" || form.categorie === "paiement";

  const categories = categoriesByRole[form.role] || categoriesByRole.autre;

  function update(key, value) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setStatus({ type: "idle", msg: "" });

    // Anti-spam : si honeypot rempli, on fait semblant que c'est OK
    if (form.website?.trim()) {
      setStatus({
        type: "success",
        msg: "Message envoyé ✅",
      });
      return;
    }

    if (!form.nom.trim() || !form.email.trim() || !form.message.trim()) {
      setStatus({ type: "error", msg: "Merci de compléter au minimum Nom, Email et Message." });
      return;
    }
    if (!form.consent) {
      setStatus({ type: "error", msg: "Merci de cocher le consentement (RGPD) pour envoyer." });
      return;
    }

    setLoading(true);
    try {
      // Edge Function Supabase recommandée : supabase/functions/contact
      const payload = {
        role: form.role,
        categorie: form.categorie,
        nom: form.nom.trim(),
        email: form.email.trim(),
        telephone: form.telephone.trim(),
        organisation: form.organisation.trim(),
        lien: form.lien.trim(),
        sujet: (form.sujet || `${roleLabel} — ${form.categorie}`).trim(),
        message: form.message.trim(),
        source: "contact_page",
        ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
      };

      const { data, error } = await supabase.functions.invoke("contact", {
        body: payload,
      });

      if (error) throw error;

      setStatus({
        type: "success",
        msg: data?.message || "Message envoyé ✅ On te répond dès que possible.",
      });

      setForm((s) => ({
        ...s,
        telephone: "",
        organisation: "",
        lien: "",
        sujet: "",
        message: "",
        consent: false,
        website: "",
      }));
    } catch (err) {
      console.error(err);
      setStatus({
        type: "error",
        msg:
          "Impossible d’envoyer pour le moment. Réessaie plus tard, ou écris-nous directement à support@tickrace.com.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Hero */}
      <div className="border-b border-neutral-200 bg-white">
        <Container className="py-10">
          <div className="flex flex-col gap-3">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-600">
              <Mail className="h-4 w-4" />
              Contact Tickrace
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900">
              Parlons de ton projet, de ton inscription, ou d’un partenariat.
            </h1>

            <p className="max-w-2xl text-neutral-600">
              Support coureurs & organisateurs, demandes de démo, partenariats média… On répond
              généralement sous <span className="font-semibold">24–48h ouvrées</span>.
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-neutral-700">
                <Shield className="h-4 w-4" />
                Données utilisées uniquement pour traiter ta demande.
              </span>
              <Link
                to="/help"
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 font-semibold text-neutral-800 hover:bg-neutral-50 transition"
              >
                <MessageCircle className="h-4 w-4" />
                Centre d’aide
              </Link>
            </div>
          </div>
        </Container>
      </div>

      <Container className="py-10">
        {/* Quick routes */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card
            icon={Users}
            title="Support coureur"
            desc="Inscription, paiement, accès, bugs…"
            to="#formulaire"
            badge="Coureurs"
          />
          <Card
            icon={Building2}
            title="Support organisateur"
            desc="Publication, formats, inscrits, reversements…"
            to="#formulaire"
            badge="Organisateurs"
          />
          <Card
            icon={MessageCircle}
            title="Partenariats"
            desc="Timing, médias, contenus, clubs, marques…"
            to="#formulaire"
            badge="Partenaires"
          />
          <Card
            icon={Newspaper}
            title="Presse / média"
            desc="Kit média, interview, couverture événement…"
            to="#formulaire"
            badge="Presse"
          />
        </div>

        {/* Form */}
        <div id="formulaire" className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-neutral-900">Envoyer un message</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Plus tu es précis (lien, ID, contexte), plus on répond vite.
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {/* honeypot hidden */}
              <div className="hidden">
                <label>
                  Website
                  <input
                    value={form.website}
                    onChange={(e) => update("website", e.target.value)}
                    autoComplete="off"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Vous êtes" required>
                  <Select
                    value={form.role}
                    onChange={(e) => {
                      const role = e.target.value;
                      update("role", role);
                      // reset categorie to first item for this role
                      const nextCats = categoriesByRole[role] || categoriesByRole.autre;
                      update("categorie", nextCats[0]?.value || "autre");
                    }}
                  >
                    <option value="coureur">Coureur</option>
                    <option value="organisateur">Organisateur</option>
                    <option value="partenaire">Partenaire</option>
                    <option value="presse">Presse / média</option>
                    <option value="autre">Autre</option>
                  </Select>
                </Field>

                <Field label="Catégorie" required>
                  <Select
                    value={form.categorie}
                    onChange={(e) => update("categorie", e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nom / Prénom" required>
                  <Input
                    value={form.nom}
                    onChange={(e) => update("nom", e.target.value)}
                    placeholder="Ex : Nicolas Izard"
                    autoComplete="name"
                  />
                </Field>

                <Field label="Email" required hint="On répond ici">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="ex: nicolas@mail.com"
                    autoComplete="email"
                  />
                </Field>
              </div>

              {showTelephone ? (
                <Field label="Téléphone" hint="Optionnel mais utile (urgence paiement)">
                  <Input
                    value={form.telephone}
                    onChange={(e) => update("telephone", e.target.value)}
                    placeholder="Ex : 06 00 00 00 00"
                    autoComplete="tel"
                  />
                </Field>
              ) : null}

              {showOrganisation ? (
                <Field
                  label={form.role === "organisateur" ? "Organisation" : "Société / structure"}
                  hint="Optionnel"
                >
                  <Input
                    value={form.organisation}
                    onChange={(e) => update("organisation", e.target.value)}
                    placeholder={form.role === "organisateur" ? "Ex : Team / Asso / Club" : "Ex : Marque / Média / Timing"}
                  />
                </Field>
              ) : null}

              {showLien ? (
                <Field
                  label="Lien utile (optionnel)"
                  hint="Ex : lien course / mon-inscription / capture"
                >
                  <Input
                    value={form.lien}
                    onChange={(e) => update("lien", e.target.value)}
                    placeholder="https://www.tickrace.com/..."
                  />
                </Field>
              ) : null}

              <Field label="Sujet" hint="Optionnel (sinon auto)">
                <Input
                  value={form.sujet}
                  onChange={(e) => update("sujet", e.target.value)}
                  placeholder={`Ex : ${roleLabel} — question sur ${form.categorie}`}
                />
              </Field>

              <Field label="Message" required hint="Décris le contexte + ce que tu attends">
                <Textarea
                  value={form.message}
                  onChange={(e) => update("message", e.target.value)}
                  placeholder={
                    form.role === "organisateur"
                      ? "Ex : je veux publier une course avec plusieurs formats, comment gérer les inscriptions + options ?"
                      : form.role === "partenaire"
                      ? "Ex : proposition de partenariat + bénéfices + audience + fréquence…"
                      : "Ex : je n’arrive pas à retrouver mon inscription / problème de paiement / bug…"
                  }
                />
              </Field>

              <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <input
                  id="consent"
                  type="checkbox"
                  checked={form.consent}
                  onChange={(e) => update("consent", e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-neutral-300"
                />
                <label htmlFor="consent" className="text-sm text-neutral-700">
                  J’accepte que Tickrace utilise ces informations uniquement pour traiter ma demande.
                </label>
              </div>

              {status.type !== "idle" ? (
                <div
                  className={[
                    "rounded-xl border p-3 text-sm",
                    status.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-rose-200 bg-rose-50 text-rose-800",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-2">
                    {status.type === "success" ? (
                      <CheckCircle2 className="h-4 w-4 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 mt-0.5" />
                    )}
                    <p>{status.msg}</p>
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className={[
                  "w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold",
                  "bg-neutral-900 text-white hover:bg-neutral-800 transition",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                ].join(" ")}
              >
                <Mail className="h-4 w-4" />
                {loading ? "Envoi..." : "Envoyer"}
              </button>

              <p className="text-xs text-neutral-500">
                Alternative : écris-nous à{" "}
                <a className="font-semibold text-neutral-700 hover:underline" href="mailto:support@tickrace.com">
                  support@tickrace.com
                </a>
                .
              </p>
            </form>
          </div>

          {/* Side info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-bold text-neutral-900">Avant d’écrire</h3>
              <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                <li className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-neutral-400" />
                  Pour une inscription : ajoute si possible l’ID ou le lien “Mon inscription”.
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-neutral-400" />
                  Pour un bug : indique ton navigateur + une capture si tu peux.
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-neutral-400" />
                  Pour un partenariat : explique l’audience + la valeur proposée (contenu, reach, timing…).
                </li>
              </ul>

              <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
                <div className="flex items-center gap-2 font-semibold">
                  <MessageCircle className="h-4 w-4" />
                  Astuce
                </div>
                <p className="mt-1">
                  Si ta question concerne une épreuve, pense aussi au chat sous l’épreuve (si activé) :
                  c’est souvent le moyen le plus rapide pour obtenir une réponse de l’organisateur.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-bold text-neutral-900">Contacts directs</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-neutral-700">
                  <Mail className="h-4 w-4" />
                  <a href="mailto:support@tickrace.com" className="font-semibold hover:underline">
                    support@tickrace.com
                  </a>
                </div>
                <div className="text-xs text-neutral-500">
                  (Tu peux garder l’email pour les urgences, sinon le formulaire ci-contre est idéal.)
                </div>
              </div>

              <div className="mt-4">
                <Link
                  to="/help"
                  className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 transition"
                >
                  Centre d’aide
                  <ArrowRight className="h-4 w-4 opacity-70" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}

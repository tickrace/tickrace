// src/pages/MonProfilCoureur.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";
import JustificatifFfaPps from "../components/JustificatifFfaPps";

/* Utils */
const nationalites = ["Française", "Espagnole", "Italienne", "Allemande", "Portugaise", "Autre"];
const pays = ["France", "Espagne", "Italie", "Allemagne", "Portugal", "Suisse", "Belgique"];

export default function MonProfilCoureur() {
  const [profil, setProfil] = useState({});
  const [message, setMessage] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfil = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from("profils_utilisateurs")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!error && data) setProfil(data);
    };
    fetchProfil();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProfil((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) return;

    const profilToSave = { ...profil, user_id: user.id };

    // Booléens (radio "true"/"false" → bool)
    if (typeof profilToSave.apparaitre_resultats === "string") {
      profilToSave.apparaitre_resultats = profilToSave.apparaitre_resultats === "true";
    }

    // Si justificatif_type !== 'licence', ne pas envoyer numero_licence
    if (profilToSave.justificatif_type !== "licence") {
      delete profilToSave.numero_licence;
    }

    // Nettoyage des chaînes vides
    Object.keys(profilToSave).forEach((key) => {
      if (profilToSave[key] === "") profilToSave[key] = null;
    });

    const { error } = await supabase.from("profils_utilisateurs").upsert(profilToSave);
    setMessage(error ? "Erreur lors de la mise à jour." : "Profil mis à jour !");
  };

  const handleDeleteAccount = async () => {
    setDeleteError("");
    const confirm = window.confirm(
      "Cette action est irréversible.\n\nVotre compte sera supprimé et vos données personnelles seront effacées ou anonymisées.\nContinuer ?"
    );
    if (!confirm) return;

    try {
      setIsDeleting(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        throw new Error("Session introuvable. Veuillez vous reconnecter.");
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Erreur lors de la suppression du compte.");
      }

      // Déconnexion locale + redirection
      await supabase.auth.signOut();
      navigate("/");
    } catch (err) {
      console.error("Erreur suppression compte:", err);
      setDeleteError(err.message || "Erreur lors de la suppression du compte.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 text-center">
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Mon profil coureur{" "}
            <span className="font-black">
              <span className="text-orange-600">Tick</span>Race
            </span>
          </h1>
          <p className="mt-2 text-neutral-600 text-sm sm:text-base">
            Complétez vos informations personnelles et sportives pour des inscriptions plus rapides.
          </p>
        </div>
      </section>

      {/* Formulaire */}
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
          {/* Identité */}
          <Card title="Identité">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nom">
                <Input
                  name="nom"
                  value={profil.nom || ""}
                  onChange={handleChange}
                  placeholder="Ex. Martin"
                />
              </Field>
              <Field label="Prénom">
                <Input
                  name="prenom"
                  value={profil.prenom || ""}
                  onChange={handleChange}
                  placeholder="Ex. Léa"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 mt-4">
              <Field label="Genre">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="genre"
                      value="Homme"
                      checked={profil.genre === "Homme"}
                      onChange={handleChange}
                    />
                    Homme
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="genre"
                      value="Femme"
                      checked={profil.genre === "Femme"}
                      onChange={handleChange}
                    />
                    Femme
                  </label>
                </div>
              </Field>

              <Field label="Date de naissance">
                <Input
                  type="date"
                  name="date_naissance"
                  value={profil.date_naissance || ""}
                  onChange={handleChange}
                />
              </Field>

              <Field label="Nationalité">
                <Select
                  name="nationalite"
                  value={profil.nationalite || ""}
                  onChange={handleChange}
                >
                  <option value="">-- Choisir une nationalité --</option>
                  {nationalites.map((nat) => (
                    <option key={nat} value={nat}>
                      {nat}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          {/* Contact */}
          <Card title="Contact">
            <div className="grid grid-cols-1 gap-4">
              <Field label="Email">
                <Input
                  type="email"
                  name="email"
                  value={profil.email || ""}
                  onChange={handleChange}
                  placeholder="vous@exemple.com"
                />
              </Field>
              <Field label="Téléphone">
                <Input
                  name="telephone"
                  value={profil.telephone || ""}
                  onChange={handleChange}
                  placeholder="06 12 34 56 78"
                />
              </Field>
              <Field label="Adresse">
                <Input
                  name="adresse"
                  value={profil.adresse || ""}
                  onChange={handleChange}
                  placeholder="N° et rue"
                />
              </Field>
              <Field label="Complément d'adresse">
                <Input
                  name="adresse_complement"
                  value={profil.adresse_complement || ""}
                  onChange={handleChange}
                  placeholder="Bâtiment, étage…"
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Code postal">
                  <Input
                    name="code_postal"
                    value={profil.code_postal || ""}
                    onChange={handleChange}
                    placeholder="75001"
                  />
                </Field>
                <Field label="Ville">
                  <Input
                    name="ville"
                    value={profil.ville || ""}
                    onChange={handleChange}
                    placeholder="Paris"
                  />
                </Field>
              </div>
              <Field label="Pays">
                <Select
                  name="pays"
                  value={profil.pays || ""}
                  onChange={handleChange}
                >
                  <option value="">-- Choisir un pays --</option>
                  {pays.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          {/* Résultats & justificatifs */}
          <Card title="Résultats & justificatifs">
            <div className="grid gap-6">
              {/* Apparition dans les résultats */}
              <div>
                <div className="text-sm font-semibold text-neutral-800 mb-1">
                  Apparition dans les résultats
                </div>
                <p className="text-xs sm:text-sm text-neutral-600 mb-2">
                  Conformément à la réglementation FFA, vous pouvez choisir que votre nom apparaisse ou non dans les résultats.
                </p>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="apparaitre_resultats"
                      value="true"
                      checked={
                        profil.apparaitre_resultats === true ||
                        profil.apparaitre_resultats === "true"
                      }
                      onChange={handleChange}
                    />
                    Oui
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="apparaitre_resultats"
                      value="false"
                      checked={
                        profil.apparaitre_resultats === false ||
                        profil.apparaitre_resultats === "false"
                      }
                      onChange={handleChange}
                    />
                    Non
                  </label>
                </div>
              </div>

              {/* Justificatif FFA / PPS */}
              <div>
                <div className="text-sm font-semibold text-neutral-800 mb-1">
                  Justificatif (Licence FFA / PPS)
                </div>
                <p className="text-xs sm:text-sm text-neutral-600 mb-2">
                  Licence FFA ou PPS requis pour participer à certaines épreuves. Vous pouvez gérer votre justificatif ici.
                </p>

                <JustificatifFfaPps profil={profil} onProfilChange={setProfil} />
              </div>
            </div>
          </Card>

          {/* Divers */}
          <Card title="Divers">
            <div className="grid gap-4">
              <Field label="Club (facultatif)">
                <Input
                  name="club"
                  value={profil.club || ""}
                  onChange={handleChange}
                  placeholder="Ex. AC Paris"
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Contact d'urgence - Nom">
                  <Input
                    name="contact_urgence_nom"
                    value={profil.contact_urgence_nom || ""}
                    onChange={handleChange}
                    placeholder="Ex. Dupont"
                  />
                </Field>
                <Field label="Contact d'urgence - Téléphone">
                  <Input
                    name="contact_urgence_telephone"
                    value={profil.contact_urgence_telephone || ""}
                    onChange={handleChange}
                    placeholder="06 98 76 54 32"
                  />
                </Field>
              </div>
            </div>
          </Card>

          {/* Sécurité & suppression de compte */}
          <Card title="Sécurité & confidentialité">
            <p className="text-xs sm:text-sm text-neutral-700 mb-3">
              Vous pouvez supprimer définitivement votre compte Tickrace. Cette action est irréversible :
              vos données personnelles seront effacées ou anonymisées, et vous ne pourrez plus accéder à vos
              inscriptions depuis cet espace.
            </p>
            {deleteError && (
              <p className="text-xs sm:text-sm text-rose-600 mb-2">{deleteError}</p>
            )}
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="w-full sm:w-auto inline-flex justify-center items-center gap-2 rounded-xl border border-rose-500 px-5 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
            >
              {isDeleting ? "Suppression en cours..." : "Supprimer mon compte"}
            </button>
          </Card>

          {/* Actions sauvegarde */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mt-2">
            <button
              type="submit"
              className="w-full sm:w-auto inline-flex justify-center items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:brightness-110"
            >
              Sauvegarder
            </button>
            {message && (
              <p
                className={`text-xs sm:text-sm ${
                  message.includes("Erreur") ? "text-rose-600" : "text-emerald-700"
                }`}
              >
                {message}
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- UI helpers ---------- */
function Card({ title, children }) {
  return (
    <section className="rounded-2xl bg-white shadow-lg shadow-neutral-900/5 ring-1 ring-neutral-200 p-4 sm:p-5">
      {title && <h2 className="text-base sm:text-lg font-semibold mb-3">{title}</h2>}
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-neutral-600">{label}</span>
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

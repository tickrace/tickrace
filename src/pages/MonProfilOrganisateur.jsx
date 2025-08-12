// src/pages/MonProfilOrganisateur.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function MonProfilOrganisateur() {
  const [profil, setProfil] = useState({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // Stripe Connect UI
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [onboardingMsg, setOnboardingMsg] = useState("");

  const pays = ["France", "Belgique", "Suisse", "Espagne", "Italie", "Portugal", "Autre"];

  useEffect(() => {
    let abort = false;
    async function fetchProfil() {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from("profils_utilisateurs")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!abort) {
        if (!error && data) setProfil(data);
        setLoading(false);
      }
    }
    fetchProfil();
    return () => { abort = true; };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfil((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) return;

    const { error } = await supabase
      .from("profils_utilisateurs")
      .upsert({ ...profil, user_id: user.id });

    setMessage(error ? "Erreur lors de la mise à jour." : "Profil mis à jour !");
  };

  async function handleConnectStripe() {
    setOnboardingMsg("");
    setOnboardingBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        setOnboardingMsg("Vous devez être connecté.");
        return;
      }

      // On prend l'email du profil si présent, sinon celui du compte auth
      const email = (profil.email || user.email || "").trim();
      if (!email) {
        setOnboardingMsg("Renseignez et sauvegardez votre email avant de continuer.");
        return;
      }

      // Appelle l’Edge Function : crée/récupère le compte Connect + génère l’URL d’onboarding
      const { data, error } = await supabase.functions.invoke("connect-onboarding", {
        body: { user_id: user.id, email, country: "FR" },
      });
      if (error) {
        setOnboardingMsg(error.message || "Erreur lors de la création du lien d’onboarding.");
        return;
      }

      const url = data?.url;
      if (!url) {
        setOnboardingMsg("Lien d’onboarding introuvable.");
        return;
      }

      // Redirection vers Stripe
      window.location.href = url;
    } catch (e) {
      setOnboardingMsg(e?.message || "Erreur inattendue.");
    } finally {
      setOnboardingBusy(false);
    }
  }

  if (loading) return <div className="p-6">Chargement…</div>;

  const stripeConfigured = !!profil?.stripe_account_id;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Mon profil organisateur</h1>

      {/* Bloc Stripe Connect */}
      <div className="mb-5 p-4 rounded-lg border bg-gray-50">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Stripe Connect</div>
            <div className="text-sm text-gray-700">
              {stripeConfigured ? (
                <>
                  Compte connecté : <span className="font-mono">{profil.stripe_account_id}</span>
                </>
              ) : (
                "Aucun compte connecté pour le moment."
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={onboardingBusy}
            onClick={handleConnectStripe}
            className={`px-4 py-2 rounded text-white ${onboardingBusy ? "bg-gray-400" : "bg-purple-600 hover:bg-purple-700"}`}
            title={stripeConfigured ? "Gérer / finaliser votre compte Stripe" : "Configurer votre compte Stripe"}
          >
            {onboardingBusy
              ? "Ouverture…"
              : (stripeConfigured ? "Gérer mon compte Stripe" : "Configurer mon compte Stripe")}
          </button>
        </div>

        {onboardingMsg && (
          <div className="mt-2 text-sm text-red-600">{onboardingMsg}</div>
        )}

        {!stripeConfigured && (
          <p className="mt-2 text-xs text-gray-600">
            Vous serez redirigé vers Stripe pour compléter votre profil (identité, IBAN, CGU). Sans cela,
            les paiements ne pourront pas être versés automatiquement.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4">
          <input
            type="text"
            name="nom"
            placeholder="Nom"
            value={profil.nom || ""}
            onChange={handleChange}
            className="border p-2 w-1/2"
          />
          <input
            type="text"
            name="prenom"
            placeholder="Prénom"
            value={profil.prenom || ""}
            onChange={handleChange}
            className="border p-2 w-1/2"
          />
        </div>

        <input
          type="text"
          name="structure"
          placeholder="Structure / association / société"
          value={profil.structure || ""}
          onChange={handleChange}
          className="border p-2 w-full"
        />

        <input
          type="email"
          name="email"
          placeholder="Email"
          value={profil.email || ""}
          onChange={handleChange}
          className="border p-2 w-full"
        />

        <input
          type="text"
          name="telephone"
          placeholder="Téléphone"
          value={profil.telephone || ""}
          onChange={handleChange}
          className="border p-2 w-full"
        />

        <input
          type="text"
          name="adresse"
          placeholder="Adresse"
          value={profil.adresse || ""}
          onChange={handleChange}
          className="border p-2 w-full"
        />

        <div className="flex gap-4">
          <input
            type="text"
            name="code_postal"
            placeholder="Code postal"
            value={profil.code_postal || ""}
            onChange={handleChange}
            className="border p-2 w-1/2"
          />
          <input
            type="text"
            name="ville"
            placeholder="Ville"
            value={profil.ville || ""}
            onChange={handleChange}
            className="border p-2 w-1/2"
          />
        </div>

        <select
          name="pays"
          value={profil.pays || ""}
          onChange={handleChange}
          className="border p-2 w-full"
        >
          <option value="">-- Choisir un pays --</option>
          {pays.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <input
          type="text"
          name="site_web"
          placeholder="Site web (optionnel)"
          value={profil.site_web || ""}
          onChange={handleChange}
          className="border p-2 w-full"
        />

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
          Sauvegarder
        </button>

        {message && <p className="text-sm text-green-700 mt-2">{message}</p>}
      </form>
    </div>
  );
}

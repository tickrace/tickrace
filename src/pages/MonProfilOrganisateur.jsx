import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { useNavigate, useLocation } from "react-router-dom";

const CONDITIONS_VERSION = "2025-08-17";

export default function MonProfilOrganisateur() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [profil, setProfil] = useState(null);

  const [organisationNom, setOrganisationNom] = useState("");
  const [siteWeb, setSiteWeb] = useState("");
  const [telephone, setTelephone] = useState("");

  const [stripeStatus, setStripeStatus] = useState({
    has_account: false,
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
    requirements_due: [],
  });
  const [checkingStripe, setCheckingStripe] = useState(false);
  const [cgvAccepted, setCgvAccepted] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(search);
    if (p.get("stripe_onboarding") === "done") console.log("Stripe onboarding terminé.");
    if (p.get("stripe_onboarding") === "refresh") console.log("Stripe onboarding refresh.");
  }, [search]);

  useEffect(() => {
    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        if (!s?.session?.user) { navigate("/login"); return; }
        setUser(s.session.user);

        const { data, error } = await supabase
          .from("profils_utilisateurs")
          .select(`
            user_id, email, organisation_nom, site_web, telephone,
            stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted, stripe_requirements_due,
            conditions_acceptees, conditions_acceptees_at, conditions_version
          `)
          .eq("user_id", s.session.user.id)
          .maybeSingle();
        if (error) throw error;

        setProfil(data);
        setOrganisationNom(data?.organisation_nom || "");
        setSiteWeb(data?.site_web || "");
        setTelephone(data?.telephone || "");
        setCgvAccepted(Boolean(data?.conditions_acceptees));

        setStripeStatus({
          has_account: Boolean(data?.stripe_account_id),
          charges_enabled: Boolean(data?.stripe_charges_enabled),
          payouts_enabled: Boolean(data?.stripe_payouts_enabled),
          details_submitted: Boolean(data?.stripe_details_submitted),
          requirements_due: Array.isArray(data?.stripe_requirements_due) ? data?.stripe_requirements_due : [],
        });
      } catch (e) {
        setErr(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  async function handleSave() {
    try {
      if (!cgvAccepted) { alert("Vous devez accepter les conditions pour continuer."); return; }
      const payload = {
        organisation_nom: organisationNom || null,
        site_web: siteWeb || null,
        telephone: telephone || null,
        conditions_acceptees: true,
        conditions_acceptees_at: new Date().toISOString(),
        conditions_version: CONDITIONS_VERSION,
      };
      const { error } = await supabase.from("profils_utilisateurs").update(payload).eq("user_id", user.id);
      if (error) throw error;
      alert("Profil sauvegardé ✅");
    } catch (e) {
      alert("Erreur: " + (e?.message ?? String(e)));
    }
  }

  async function startStripeOnboarding() {
    try {
      const base = window.location.origin;
      const body = {
        returnUrl: `${base}/monprofilorganisateur?stripe_onboarding=done`,
        refreshUrl: `${base}/monprofilorganisateur?stripe_onboarding=refresh`,
      };
      const { data, error } = await supabase.functions.invoke("connect-onboarding", { body });
      if (error) throw error;
      window.location.href = data.url;
    } catch (e) {
      alert("Erreur Stripe Onboarding: " + (e?.message ?? String(e)));
    }
  }

  async function refreshStripeStatus() {
    try {
      setCheckingStripe(true);
      const { data, error } = await supabase.functions.invoke("connect-account-status", { body: {} });
      if (error) throw error;
      setStripeStatus({
        has_account: !!data?.has_account,
        charges_enabled: !!data?.charges_enabled,
        payouts_enabled: !!data?.payouts_enabled,
        details_submitted: !!data?.details_submitted,
        requirements_due: Array.isArray(data?.requirements_due) ? data.requirements_due : [],
      });
    } catch (e) {
      alert("Erreur statut Stripe: " + (e?.message ?? String(e)));
    } finally {
      setCheckingStripe(false);
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Chargement…</div>;

  return (
    <div className="max-w-3xl mx-auto p-4">
      {/* Bandeau explicatif */}
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 mb-4 text-sm">
        <b>Compte Stripe requis :</b> Pour encaisser les inscriptions et recevoir vos reversements,
        vous devez <u>configurer votre compte Stripe Express</u>. Sans cela, les paiements seront bloqués.
      </div>

      {/* Bloc Stripe */}
      <section className="mb-6 border rounded-md p-4">
        <h2 className="text-lg font-semibold mb-2">Paiements & compte Stripe</h2>

        <div className="text-sm mb-3">
          <div>
            Statut :{" "}
            {stripeStatus.has_account ? (
              <span className="text-green-700">Compte trouvé</span>
            ) : (
              <span className="text-red-700">Non configuré</span>
            )}
          </div>
          {stripeStatus.has_account && (
            <>
              <div>Charges activées : {stripeStatus.charges_enabled ? "Oui ✅" : "Non ❌"}</div>
              <div>Payouts activés : {stripeStatus.payouts_enabled ? "Oui ✅" : "Non ❌"}</div>
              <div>Dossier soumis : {stripeStatus.details_submitted ? "Oui ✅" : "Non ❌"}</div>
              {stripeStatus.requirements_due?.length > 0 && (
                <div className="mt-2">
                  <div className="font-medium">Éléments à compléter :</div>
                  <ul className="list-disc ml-6">
                    {stripeStatus.requirements_due.map((k, i) => (
                      <li key={i}><code>{k}</code></li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={startStripeOnboarding}
            className="px-3 py-2 rounded bg-black text-white hover:bg-gray-800"
          >
            {stripeStatus.has_account ? "Continuer la configuration Stripe" : "Configurer mon compte Stripe"}
          </button>
          <button
            onClick={refreshStripeStatus}
            disabled={checkingStripe}
            className="px-3 py-2 rounded border"
          >
            {checkingStripe ? "Vérification…" : "Vérifier le statut"}
          </button>
        </div>
      </section>

      {/* Formulaire profil */}
      <section className="mb-6 border rounded-md p-4">
        <h2 className="text-lg font-semibold mb-3">Informations organisateur</h2>
        <div className="grid gap-3">
          <label className="flex flex-col">
            <span className="text-sm text-gray-700">Nom de l’organisation</span>
            <input className="border rounded px-2 py-1" value={organisationNom} onChange={e => setOrganisationNom(e.target.value)} />
          </label>
          <label className="flex flex-col">
            <span className="text-sm text-gray-700">Site web</span>
            <input className="border rounded px-2 py-1" value={siteWeb} onChange={e => setSiteWeb(e.target.value)} placeholder="https://…" />
          </label>
          <label className="flex flex-col">
            <span className="text-sm text-gray-700">Téléphone</span>
            <input className="border rounded px-2 py-1" value={telephone} onChange={e => setTelephone(e.target.value)} />
          </label>
        </div>
      </section>

      {/* Conditions */}
      <section className="mb-6 border rounded-md p-4">
        <h2 className="text-lg font-semibold mb-3">Conditions & conformité</h2>
        <div className="text-sm text-gray-700 mb-2">
          Avant d’enregistrer votre profil, vous devez accepter nos termes :
          <ul className="list-disc ml-6 mt-2">
            <li><a className="underline" href="/legal/cgv-organisateurs" target="_blank" rel="noreferrer">CGV Organisateurs</a></li>
            <li><a className="underline" href="/legal/remboursements" target="_blank" rel="noreferrer">Politique de remboursement</a></li>
            <li><a className="underline" href="/legal/charte-organisateur" target="_blank" rel="noreferrer">Charte anti-fraude</a></li>
          </ul>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={cgvAccepted}
            onChange={(e) => setCgvAccepted(e.target.checked)}
            disabled={profil?.conditions_acceptees === true}
          />
          <span>
            J’accepte les documents ci-dessus (version {CONDITIONS_VERSION}).{" "}
            {profil?.conditions_acceptees && profil.conditions_acceptees_at ? (
              <em>Accepté le {new Date(profil.conditions_acceptees_at).toLocaleString("fr-FR")}.</em>
            ) : null}
          </span>
        </label>
      </section>

      {/* Sauvegarde */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
          disabled={!cgvAccepted}
          title={!cgvAccepted ? "Vous devez accepter les conditions" : ""}
        >
          Sauvegarder le profil
        </button>
      </div>
    </div>
  );
}

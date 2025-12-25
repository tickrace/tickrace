// src/pages/MonProfilOrganisateur.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  BadgeCheck,
  Building2,
  CreditCard,
  FileText,
  ExternalLink,
  ArrowRight,
  RefreshCw,
  Wallet,
} from "lucide-react";

const CONDITIONS_VERSION = "2025-08-17";
const COMPTA_PATH = "/organisateur/compta";

/* ---------- Utils ---------- */
function cleanStr(v) {
  const s = (v ?? "").toString().trim();
  return s.length ? s : "";
}

/* ---------- UI helpers ---------- */
function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-neutral-600">{label}</span>
      {hint ? <div className="mt-1 text-xs text-neutral-500">{hint}</div> : null}
      <div className="mt-2">{children}</div>
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
function TextArea(props) {
  return (
    <textarea
      {...props}
      rows={props.rows ?? 3}
      className={[
        "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none",
        "focus:ring-2 focus:ring-orange-300",
        props.className || "",
      ].join(" ")}
    />
  );
}
function Pill({ ok, children }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
        ok
          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
          : "bg-red-50 text-red-800 border border-red-200",
      ].join(" ")}
    >
      {ok ? <BadgeCheck className="h-4 w-4" /> : null}
      {children}
    </span>
  );
}

export default function MonProfilOrganisateur() {
  const navigate = useNavigate();
  const { search } = useLocation();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [profil, setProfil] = useState(null);

  // Base orga
  const [organisationNom, setOrganisationNom] = useState("");
  const [siteWeb, setSiteWeb] = useState("");
  const [telephone, setTelephone] = useState("");

  // ✅ Infos facturation (SANS IBAN/BIC)
  const [titulaireCompte, setTitulaireCompte] = useState("");
  const [emailFacturation, setEmailFacturation] = useState("");
  const [siret, setSiret] = useState("");
  const [tvaIntra, setTvaIntra] = useState("");
  const [adresseFact, setAdresseFact] = useState("");
  const [cpFact, setCpFact] = useState("");
  const [villeFact, setVilleFact] = useState("");
  const [paysFact, setPaysFact] = useState("France");

  // Stripe
  const [stripeStatus, setStripeStatus] = useState({
    has_account: false,
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
    requirements_due: [],
  });
  const [checkingStripe, setCheckingStripe] = useState(false);

  // Conditions
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
        const u = s?.session?.user;
        if (!u) {
          navigate("/login");
          return;
        }
        setUser(u);

        const { data, error } = await supabase
          .from("profils_utilisateurs")
          .select(`
            user_id, email, organisation_nom, site_web, telephone,
            stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted, stripe_requirements_due,
            conditions_acceptees, conditions_acceptees_at, conditions_version,
            orga_titulaire_compte, orga_email_facturation, orga_siret, orga_tva_intra,
            orga_adresse_facturation, orga_code_postal, orga_ville, orga_pays
          `)
          .eq("user_id", u.id)
          .maybeSingle();

        if (error) throw error;

        setProfil(data || null);

        setOrganisationNom(data?.organisation_nom || "");
        setSiteWeb(data?.site_web || "");
        setTelephone(data?.telephone || "");

        setTitulaireCompte(data?.orga_titulaire_compte || "");
        setEmailFacturation(data?.orga_email_facturation || data?.email || "");
        setSiret(data?.orga_siret || "");
        setTvaIntra(data?.orga_tva_intra || "");
        setAdresseFact(data?.orga_adresse_facturation || "");
        setCpFact(data?.orga_code_postal || "");
        setVilleFact(data?.orga_ville || "");
        setPaysFact(data?.orga_pays || "France");

        setCgvAccepted(Boolean(data?.conditions_acceptees));

        setStripeStatus({
          has_account: Boolean(data?.stripe_account_id),
          charges_enabled: Boolean(data?.stripe_charges_enabled),
          payouts_enabled: Boolean(data?.stripe_payouts_enabled),
          details_submitted: Boolean(data?.stripe_details_submitted),
          requirements_due: Array.isArray(data?.stripe_requirements_due)
            ? data?.stripe_requirements_due
            : [],
        });
      } catch (e) {
        setErr(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const stripeReady = useMemo(() => {
    if (!stripeStatus.has_account) return false;
    return !!stripeStatus.charges_enabled && !!stripeStatus.payouts_enabled;
  }, [stripeStatus]);

  async function handleSave() {
    try {
      if (!cgvAccepted) {
        alert("Vous devez accepter les conditions pour continuer.");
        return;
      }

      const payload = {
        organisation_nom: cleanStr(organisationNom) || null,
        site_web: cleanStr(siteWeb) || null,
        telephone: cleanStr(telephone) || null,

        orga_titulaire_compte: cleanStr(titulaireCompte) || null,
        orga_email_facturation: cleanStr(emailFacturation) || null,
        orga_siret: cleanStr(siret) || null,
        orga_tva_intra: cleanStr(tvaIntra) || null,
        orga_adresse_facturation: cleanStr(adresseFact) || null,
        orga_code_postal: cleanStr(cpFact) || null,
        orga_ville: cleanStr(villeFact) || null,
        orga_pays: cleanStr(paysFact) || null,

        conditions_acceptees: true,
        conditions_acceptees_at: new Date().toISOString(),
        conditions_version: CONDITIONS_VERSION,
      };

      const { error } = await supabase
        .from("profils_utilisateurs")
        .update(payload)
        .eq("user_id", user.id);

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

  if (loading) return <div className="p-6">Chargement…</div>;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <section className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-5xl px-4 py-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Profil Organisateur{" "}
            <span className="font-black">
              <span className="text-orange-600">Tick</span>Race
            </span>
          </h1>
          <p className="mt-2 text-neutral-600 text-base">
            Gérez vos informations, configurez Stripe et suivez votre comptabilité.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        {err && (
          <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
            Erreur : {err}
          </div>
        )}

        {/* ✅ Bandeau Stripe + Politique reversement */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 space-y-2">
          <div>
            <b>💳 Compte Stripe requis :</b> pour encaisser les inscriptions et recevoir vos reversements, vous devez
            configurer <b>Stripe Express</b>. Sans Stripe, les paiements sont bloqués.
          </div>
          <div>
            <b>📤 Politique de reversement Tickrace :</b> votre net organisateur est versé en <b>2 temps</b> :
            <ul className="list-disc ml-6 mt-1">
              <li>
                <b>Acompte :</b> 50% du net, <b>à partir de J+7 après chaque paiement</b>
              </li>
              <li>
                <b>Solde :</b> le reste, <b>à partir de J+2 après le jour de la course</b>
              </li>
            </ul>
            <div className="mt-1 text-[12px] text-blue-900/80">
              Délais indicatifs : peuvent varier selon Stripe, contrôles, banques et jours ouvrés.
            </div>
          </div>
        </div>

        {/* ✅ Bloc Comptabilité */}
        <section className="rounded-2xl bg-white shadow ring-1 ring-neutral-200 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Wallet className="h-5 w-5 text-neutral-700" />
                Comptabilité
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                Consultez vos encaissements, frais Stripe, commission Tickrace, remboursements, et imprimez votre relevé.
              </p>
              <div className="mt-3">
                <Pill ok={stripeReady}>
                  {stripeReady ? "Stripe prêt (encaissements + reversements)" : "Stripe incomplet (vérifiez la configuration)"}
                </Pill>
              </div>
            </div>

            <Link
              to={COMPTA_PATH}
              className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 text-white px-4 py-2 text-sm font-semibold hover:bg-neutral-800"
            >
              Accéder à ma compta
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs text-neutral-600">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="font-semibold text-neutral-800">Relevé imprimable</div>
              <div className="mt-1">Période + lignes + totaux.</div>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="font-semibold text-neutral-800">Export CSV</div>
              <div className="mt-1">Pour ton comptable / Excel.</div>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="font-semibold text-neutral-800">Traçabilité</div>
              <div className="mt-1">Paiements, ajustements, remboursements.</div>
            </div>
          </div>
        </section>

        {/* Bloc Stripe */}
        <section className="rounded-2xl bg-white shadow ring-1 ring-neutral-200 p-5">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-neutral-700" />
            Paiements & compte Stripe
          </h2>

          <div className="text-sm mb-4 space-y-1">
            <div>
              Statut :{" "}
              {stripeStatus.has_account ? (
                <span className="text-green-700 font-medium">Compte trouvé ✅</span>
              ) : (
                <span className="text-red-700 font-medium">Non configuré ❌</span>
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
                        <li key={i}>
                          <code>{k}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={startStripeOnboarding}
              className="px-4 py-2 rounded-xl bg-black text-white text-sm font-semibold hover:bg-neutral-800 inline-flex items-center gap-2"
            >
              {stripeStatus.has_account ? "Continuer la configuration Stripe" : "Configurer mon compte Stripe"}
              <ExternalLink className="h-4 w-4 opacity-80" />
            </button>

            <button
              onClick={refreshStripeStatus}
              disabled={checkingStripe}
              className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 inline-flex items-center gap-2"
            >
              <RefreshCw className={["h-4 w-4", checkingStripe ? "animate-spin" : ""].join(" ")} />
              {checkingStripe ? "Vérification…" : "Vérifier le statut"}
            </button>
          </div>
        </section>

        {/* Profil orga */}
        <section className="rounded-2xl bg-white shadow ring-1 ring-neutral-200 p-5">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-neutral-700" />
            Informations organisateur
          </h2>
          <div className="grid gap-4">
            <Field label="Nom de l’organisation">
              <Input
                value={organisationNom}
                onChange={(e) => setOrganisationNom(e.target.value)}
                placeholder="Ex. Association Les Trails du Sud"
              />
            </Field>
            <Field label="Site web">
              <Input value={siteWeb} onChange={(e) => setSiteWeb(e.target.value)} placeholder="https://…" />
            </Field>
            <Field label="Téléphone">
              <Input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="06 12 34 56 78" />
            </Field>
          </div>
        </section>

        {/* ✅ Facturation (sans IBAN/BIC) + rappel Stripe */}
        <section className="rounded-2xl bg-white shadow ring-1 ring-neutral-200 p-5">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5 text-neutral-700" />
            Facturation (pour vos exports)
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Titulaire / Nom légal" hint="Optionnel — affichage dans les exports compta.">
              <Input
                value={titulaireCompte}
                onChange={(e) => setTitulaireCompte(e.target.value)}
                placeholder="Ex. Association Les Trails du Sud"
              />
            </Field>

            <Field label="Email de facturation" hint="Optionnel — pour recevoir les relevés / factures.">
              <Input
                value={emailFacturation}
                onChange={(e) => setEmailFacturation(e.target.value)}
                placeholder="compta@organisation.fr"
              />
            </Field>

            <Field label="SIRET" hint="Optionnel — pour des factures/relevés plus propres.">
              <Input value={siret} onChange={(e) => setSiret(e.target.value)} placeholder="123 456 789 00012" />
            </Field>

            <Field label="TVA intracommunautaire" hint="Optionnel (si assujetti).">
              <Input value={tvaIntra} onChange={(e) => setTvaIntra(e.target.value)} placeholder="FRXX123456789" />
            </Field>

            <div className="md:col-span-2">
              <Field label="Adresse de facturation" hint="Optionnel — utilisé dans les exports / impressions.">
                <TextArea
                  value={adresseFact}
                  onChange={(e) => setAdresseFact(e.target.value)}
                  placeholder="N° et rue"
                />
              </Field>
            </div>

            <Field label="Code postal">
              <Input value={cpFact} onChange={(e) => setCpFact(e.target.value)} placeholder="12000" />
            </Field>

            <Field label="Ville">
              <Input value={villeFact} onChange={(e) => setVilleFact(e.target.value)} placeholder="Rodez" />
            </Field>

            <Field label="Pays">
              <Input value={paysFact} onChange={(e) => setPaysFact(e.target.value)} placeholder="France" />
            </Field>
          </div>

          <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 space-y-1">
            <div>
              💡 <b>IBAN/BIC supprimés :</b> les reversements ne passent pas par un virement manuel Tickrace.
            </div>
            <div>
              ✅ <b>Vos reversements sont gérés par Stripe Express</b> (KYC + compte bancaire côté Stripe).
            </div>
            <div className="text-[12px] text-neutral-600">
              Pensez à finaliser Stripe pour activer <b>encaissements</b> et <b>payouts</b>.
            </div>
          </div>
        </section>

        {/* Conditions */}
        <section className="rounded-2xl bg-white shadow ring-1 ring-neutral-200 p-5">
          <h2 className="text-lg font-semibold mb-3">Conditions & conformité</h2>
          <p className="text-sm text-neutral-700 mb-3">
            Avant d’enregistrer votre profil, vous devez accepter nos documents :
          </p>

          <ul className="list-disc ml-6 mb-4 text-sm text-neutral-700">
            <li>
              <a className="underline text-orange-600" href="/legal/cgv-organisateurs" target="_blank" rel="noreferrer">
                CGV Organisateurs
              </a>
            </li>
            <li>
              <a className="underline text-orange-600" href="/legal/remboursements" target="_blank" rel="noreferrer">
                Politique de remboursement
              </a>
            </li>
            <li>
              <a className="underline text-orange-600" href="/legal/charte-organisateur" target="_blank" rel="noreferrer">
                Charte anti-fraude
              </a>
            </li>
          </ul>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={cgvAccepted}
              onChange={(e) => setCgvAccepted(e.target.checked)}
              disabled={profil?.conditions_acceptees === true}
              className="mt-1"
            />
            <span>
              J’accepte les documents ci-dessus (version {CONDITIONS_VERSION}).{" "}
              {profil?.conditions_acceptees && profil.conditions_acceptees_at ? (
                <em>Accepté le {new Date(profil.conditions_acceptees_at).toLocaleString("fr-FR")}.</em>
              ) : null}
            </span>
          </label>
        </section>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleSave}
            className="px-5 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
            disabled={!cgvAccepted}
          >
            Sauvegarder le profil
          </button>

          <Link
            to={COMPTA_PATH}
            className="px-5 py-3 rounded-xl border border-neutral-200 bg-white font-semibold hover:bg-neutral-50 inline-flex items-center gap-2"
          >
            Voir ma compta
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

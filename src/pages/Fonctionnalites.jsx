// src/pages/Fonctionnalites.jsx
import React, { useState } from "react";
import { ArrowRight, MapPin, LineChart, MessageCircle, ShieldCheck, Settings2, Users2, Map, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";

const Pill = ({ children }) => (
  <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 ring-1 ring-orange-200 px-3 py-1 text-xs text-orange-700">
    ✨ {children}
  </span>
);

const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 ${className}`}>{children}</div>
);

export default function Fonctionnalites() {
  const [tab, setTab] = useState("coureurs");

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 pb-24 md:pb-0">
      {/* HERO */}
      <section className="relative">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_0%,#fed7aa_0%,transparent_60%)]" />
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="text-center max-w-3xl mx-auto">
            <Pill>Nouveautés TickRace</Pill>
            <h1 className="mt-3 text-4xl sm:text-5xl font-black tracking-tight">
              Toutes les fonctionnalités pour <span className="text-orange-600">courir</span> et <span className="text-orange-600">organiser</span>.
            </h1>
            <p className="mt-3 text-neutral-600">
              Une plateforme unique : inscrivez-vous aux épreuves, échangez avec la communauté,
              publiez et gérez vos courses avec des outils modernes.
            </p>

            {/* Tabs */}
            <div className="mt-6 inline-flex rounded-xl ring-1 ring-gray-200 p-1 bg-white">
              {[
                { key: "coureurs", label: "Pour les coureurs" },
                { key: "organisateurs", label: "Pour les organisateurs" },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-semibold",
                    tab === t.key ? "bg-black text-white" : "text-gray-800 hover:bg-gray-50"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CONTENT */}
      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {tab === "coureurs" ? <Coureurs /> : <Organisateurs />}
      </section>
    </div>
  );
}

function cn(...c){ return c.filter(Boolean).join(" "); }

function Row({ icon:Icon, title, bullets }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 h-10 w-10 rounded-xl bg-orange-100 text-orange-700 grid place-items-center ring-1 ring-orange-200">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="font-semibold">{title}</div>
        <ul className="mt-1 text-sm text-neutral-700 list-disc ml-4">
          {bullets.map((b,i)=><li key={i}>{b}</li>)}
        </ul>
      </div>
    </div>
  );
}

function Coureurs(){
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card className="p-6">
        <Row icon={MapPin} title="Trouver & s’inscrire" bullets={[
          "Recherche par lieu, date, distance & D+",
          "Fiches épreuves détaillées, GPX et infos pratiques",
          "Paiement sécurisé, récap en 1 clic"
        ]}/>
        <div className="my-5 h-px bg-gray-100" />
        <Row icon={LineChart} title="S’entraîner mieux" bullets={[
          "Plans IA personnalisés (Premium)",
          "Estimation chrono (ITRA/UTMB)",
          "Exports vers montres & Garmin Connect"
        ]}/>
        <div className="my-5 h-px bg-gray-100" />
        <Row icon={MessageCircle} title="Communauté & chat" bullets={[
          "Questions sous chaque épreuve",
          "Covoiturage & tips matériel",
          "Mentions @IA pour des réponses instantanées"
        ]}/>
        <div className="mt-6">
          <Link to="/premium" className="inline-flex items-center gap-2 rounded-2xl bg-orange-600 px-4 py-2 text-white text-sm font-semibold hover:brightness-110">
            Passer en Premium <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </Card>

      <Card className="p-6">
        <Row icon={Map} title="Parcours & GPX" bullets={[
          "Affichage GPX responsive",
          "Infos départ/arrivée, ravitos, dotations",
          "Gestion multi-formats"
        ]}/>
        <div className="my-5 h-px bg-gray-100" />
        <Row icon={Users2} title="Suivi d’inscriptions" bullets={[
          "Places restantes & seuils",
          "Historique & QR d’accès",
          "E-mails transactionnels"
        ]}/>
        <div className="my-5 h-px bg-gray-100" />
        <Row icon={ShieldCheck} title="Confidentialité" bullets={[
          "Choix d’apparaitre dans les résultats",
          "Gestion licence / PPS",
          "RGPD by design"
        ]}/>
      </Card>
    </div>
  );
}

function Organisateurs(){
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card className="p-6">
        <Row icon={Settings2} title="Publier en minutes" bullets={[
          "Création d’épreuve simple & multi-formats",
          "Codes promo, quotas & brouillons",
          "Chat sous épreuve avec modération IA"
        ]}/>
        <div className="my-5 h-px bg-gray-100" />
        <Row icon={CreditCard} title="Paiements & reversements" bullets={[
          "Stripe Express intégré",
          "95% automatique à J+1",
          "Acompte possible sur demande"
        ]}/>
        <div className="mt-6">
          <Link to="/organisateur/mon-espace" className="inline-flex items-center gap-2 rounded-2xl bg-black px-4 py-2 text-white text-sm font-semibold hover:brightness-110">
            Accéder à l’espace organisateur <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </Card>

      <Card className="p-6">
        <Row icon={Users2} title="Equipe & rôles" bullets={[
          "Ajout de co-organisateurs",
          "Permissions ciblées (inscriptions, finance)",
          "Journal d’audit"
        ]}/>
        <div className="my-5 h-px bg-gray-100" />
        <Row icon={Map} title="Parcours & médias" bullets={[
          "Images par format, GPX par format",
          "Docs réglement & infos pratiques",
          "Pages publiques SEO-friendly"
        ]}/>
      </Card>
    </div>
  );
}

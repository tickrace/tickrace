// src/pages/help/CreerUneCourse.jsx
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  CreditCard,
  FileText,
  Image as ImageIcon,
  MapPin,
  Route as RouteIcon,
  Settings,
  Sparkles,
  Timer,
  Users,
  AlertTriangle,
} from "lucide-react";

const Container = ({ children }) => (
  <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">{children}</div>
);

const Pill = ({ children }) => (
  <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200">
    {children}
  </span>
);

const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`}>{children}</div>
);

const SectionTitle = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-start gap-3">
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-800 ring-1 ring-neutral-200">
      <Icon className="h-5 w-5" />
    </span>
    <div>
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      {subtitle ? <p className="text-sm text-neutral-600">{subtitle}</p> : null}
    </div>
  </div>
);

function Accordion({ title, icon: Icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left"
        aria-expanded={open}
      >
        <div className="flex items-start gap-4 px-5 py-4">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-800 ring-1 ring-neutral-200">
            <Icon className="h-5 w-5" />
          </span>

          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
              <span className="mt-1 text-neutral-500">
                {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </span>
            </div>
          </div>
        </div>
      </button>

      {open ? (
        <div className="border-t border-neutral-200">
          <div className="px-5 py-4 text-sm leading-6 text-neutral-800 space-y-3">{children}</div>
        </div>
      ) : null}
    </Card>
  );
}

const Bullet = ({ children }) => (
  <li className="flex gap-2">
    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0" />
    <span>{children}</span>
  </li>
);

export default function CreerUneCourse() {
  const lastUpdate = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit" });
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white">
        <Container>
          <div className="py-10 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Pill>
                <BookOpen className="mr-2 inline h-4 w-4" />
                Guide organisateur
              </Pill>
              <Pill>
                <Sparkles className="mr-2 inline h-4 w-4" />
                Créer une course
              </Pill>
              <Pill>
                <FileText className="mr-2 inline h-4 w-4" />
                V1 • MAJ {lastUpdate}
              </Pill>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
                Tutoriel : créer une course sur Tickrace
              </h1>
              <p className="max-w-3xl text-sm text-neutral-600">
                Ce guide te fait passer de “zéro” à une fiche course publiée, avec formats, tarifs, options et
                (si besoin) l’option prestataire de chronométrage.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/organisateur/creer-course"
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
              >
                Ouvrir le formulaire de création
              </Link>
              <Link
                to="/legal/faq"
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-800 ring-1 ring-neutral-200 hover:bg-neutral-50"
              >
                Aller à la FAQ
              </Link>
            </div>
          </div>
        </Container>
      </div>

      <Container>
        <div className="py-10 space-y-8">
          {/* Prérequis */}
          <Card>
            <div className="px-6 py-5 space-y-4">
              <SectionTitle
                icon={ClipboardCheck}
                title="Avant de commencer"
                subtitle="Prépare ces éléments pour gagner du temps."
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-neutral-800">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="font-semibold text-neutral-900">Infos de base</p>
                  <ul className="mt-2 space-y-2">
                    <Bullet>Nom de l’événement + édition (ex : 2026)</Bullet>
                    <Bullet>Date(s) + heure(s) de départ</Bullet>
                    <Bullet>Lieu (commune, département) + accès</Bullet>
                    <Bullet>Contact organisateur (email / téléphone)</Bullet>
                  </ul>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="font-semibold text-neutral-900">Parcours & formats</p>
                  <ul className="mt-2 space-y-2">
                    <Bullet>Distances / D+ / D- par format</Bullet>
                    <Bullet>Nombre de dossards max par format</Bullet>
                    <Bullet>Tarif par format (+ options éventuelles)</Bullet>
                    <Bullet>Fichier GPX (si dispo)</Bullet>
                  </ul>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="font-semibold text-neutral-900">Paiements</p>
                  <ul className="mt-2 space-y-2">
                    <Bullet>Compte Stripe Express activé (recommandé)</Bullet>
                    <Bullet>IBAN / informations de l’organisation prêts</Bullet>
                    <Bullet>Politique d’annulation Tickrace (commune) acceptée</Bullet>
                  </ul>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="font-semibold text-neutral-900">Visuels</p>
                  <ul className="mt-2 space-y-2">
                    <Bullet>Image principale (affiche / photo / bannière)</Bullet>
                    <Bullet>Logo de l’événement (optionnel)</Bullet>
                    <Bullet>Règlement PDF (optionnel en V1)</Bullet>
                  </ul>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" />
                  <p className="text-amber-900">
                    <span className="font-semibold">Astuce :</span> commence simple. Tu peux publier avec une fiche propre
                    + 1 format, puis ajouter les autres formats et options après.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Étapes */}
          <div className="space-y-4">
            <Accordion title="Étape 1 — Informations générales" icon={MapPin} defaultOpen>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  Renseigne le <b>nom</b> de la course, la <b>date</b>, le <b>lieu</b> et les infos de contact.
                </li>
                <li>
                  Ajoute une <b>description claire</b> : type de terrain, niveau, barrières horaires (si applicable),
                  ravitos, matériel conseillé…
                </li>
                <li>
                  Vérifie l’orthographe : le titre et le lieu sont très visibles sur la liste des courses.
                </li>
              </ul>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="font-semibold text-neutral-900">Bonnes pratiques</p>
                <ul className="mt-2 list-disc pl-5 space-y-2">
                  <li>Un titre court + l’année : “Ronde des Berges de l’Aveyron 2026”.</li>
                  <li>Une description structurée avec des puces (moins de pavé).</li>
                </ul>
              </div>
            </Accordion>

            <Accordion title="Étape 2 — Créer les formats (distances, quotas, tarifs)" icon={RouteIcon}>
              <p>
                Chaque format représente une épreuve (ex : 11 km, 22 km, relais, marche…).
              </p>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="font-semibold text-neutral-900">Champs à remplir (par format)</p>
                <ul className="mt-2 list-disc pl-5 space-y-2">
                  <li>Distance + D+ / D-</li>
                  <li>Nombre de dossards maximum</li>
                  <li>Tarif d’inscription</li>
                  <li>Heure de départ (si gérée dans ton modèle)</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="font-semibold text-neutral-900">Conseils</p>
                <ul className="mt-2 list-disc pl-5 space-y-2">
                  <li>Commence avec 1 format, publie, puis duplique/ajoute les autres.</li>
                  <li>Fixe un quota réaliste : tu peux le modifier plus tard.</li>
                </ul>
              </div>
            </Accordion>

            <Accordion title="Étape 3 — Options organisateur (repas, t-shirt, tombola…)" icon={Settings}>
              <p>
                En V1, Tickrace garde <b>5 %</b> sur les options (comme sur l’inscription) — c’est déjà en place.
              </p>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="font-semibold text-neutral-900">Exemples d’options</p>
                <ul className="mt-2 list-disc pl-5 space-y-2">
                  <li>T-shirt / débardeur (avec tailles)</li>
                  <li>Repas d’après-course (quantité)</li>
                  <li>Parking / navettes</li>
                  <li>Tombola / soutien club</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="font-semibold text-neutral-900">Conseil pricing</p>
                <p className="mt-2">
                  Garde des options simples et “add-on” (petits montants) : ça augmente le panier moyen sans freiner
                  l’inscription.
                </p>
              </div>
            </Accordion>

            <Accordion title="Étape 4 — Visuels & GPX" icon={ImageIcon}>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  Ajoute une <b>image principale</b> (affiche ou photo). C’est elle qui rend la course “cliquable”.
                </li>
                <li>
                  Ajoute le <b>GPX</b> si disponible (utile pour la confiance et le SEO).
                </li>
                <li>
                  Vérifie le rendu sur mobile : titre lisible, image pas trop sombre, infos clés visibles.
                </li>
              </ul>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="font-semibold text-neutral-900">Format d’image recommandé</p>
                <ul className="mt-2 list-disc pl-5 space-y-2">
                  <li>JPG/PNG</li>
                  <li>Largeur ≥ 1600px</li>
                  <li>Poids raisonnable (≤ 1–2 Mo si possible)</li>
                </ul>
              </div>
            </Accordion>

            <Accordion title="Étape 5 — Option prestataire de chronométrage (1,30 € / coureur)" icon={Timer}>
              <p>
                Si tu proposes un prestataire de chronométrage via Tickrace, l’option est facturée{" "}
                <b>1,30 € par coureur</b>.
              </p>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="font-semibold text-neutral-900">Ce que ça implique</p>
                <ul className="mt-2 list-disc pl-5 space-y-2">
                  <li>Le service est réalisé par un prestataire tiers (matériel, puces, chrono…)</li>
                  <li>Tickrace ne prélève aucune commission sur cette option</li>
                  <li>La responsabilité d’exécution est côté prestataire</li>
                </ul>
              </div>
            </Accordion>

            <Accordion title="Étape 6 — Publication et vérifications" icon={CheckCircle2}>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="font-semibold text-neutral-900">Checklist avant publication</p>
                <ul className="mt-2 space-y-2">
                  <Bullet>Nom / date / lieu corrects</Bullet>
                  <Bullet>Au moins 1 format complet (distance, quota, prix)</Bullet>
                  <Bullet>Image principale OK</Bullet>
                  <Bullet>Contact organisateur visible</Bullet>
                </ul>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="font-semibold text-neutral-900">Après publication</p>
                <ul className="mt-2 list-disc pl-5 space-y-2">
                  <li>Teste une inscription “comme un coureur” (jusqu’au paiement si possible).</li>
                  <li>Vérifie l’email de confirmation et la page “Mes inscriptions”.</li>
                  <li>Partage le lien public de la course (réseaux, club, mairie, partenaires).</li>
                </ul>
              </div>
            </Accordion>
          </div>

          {/* Bloc Paiements / commissions */}
          <Card>
            <div className="px-6 py-5 space-y-4">
              <SectionTitle
                icon={CreditCard}
                title="Rappel V1 : commissions & règles"
                subtitle="On fige ces règles pour simplifier."
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="font-semibold text-neutral-900">Commission Tickrace</p>
                  <p className="mt-2 text-neutral-800">
                    <b>5 %</b> sur inscriptions + options.
                  </p>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="font-semibold text-neutral-900">Chronométrage</p>
                  <p className="mt-2 text-neutral-800">
                    <b>1,30 €</b> / coureur (option prestataire).
                  </p>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="font-semibold text-neutral-900">Annulation (commune)</p>
                  <p className="mt-2 text-neutral-800">
                    Barème Tickrace, <b>5 %</b> conservés.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
                <p className="font-semibold text-neutral-900">Besoin d’aide ?</p>
                <p className="mt-1">
                  Écris-nous : <b>support@tickrace.com</b> (ou via ton email de contact actuel).
                </p>
                <p className="mt-2 text-xs text-neutral-500">
                  Ajoute le nom de la course + une capture de ton formulaire si possible.
                </p>
              </div>
            </div>
          </Card>

          {/* Navigation */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/organisateur/creer-course"
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Créer une course maintenant
            </Link>
            <Link
              to="/legal/faq"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-800 ring-1 ring-neutral-200 hover:bg-neutral-50"
            >
              Retour à la FAQ
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}

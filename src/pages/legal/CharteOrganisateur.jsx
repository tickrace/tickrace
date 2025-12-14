// src/pages/CharteOrganisateur.jsx
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  BadgeCheck,
  CalendarDays,
  FileWarning,
  CreditCard,
  Database,
  Gavel,
  Info,
} from "lucide-react";

const Container = ({ children }) => (
  <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">{children}</div>
);

const Card = ({ icon: Icon, title, children }) => (
  <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
    <div className="flex items-start gap-3 border-b border-neutral-200 px-5 py-4">
      <div className="mt-0.5 rounded-xl bg-neutral-100 p-2">
        <Icon className="h-5 w-5 text-neutral-700" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        <p className="text-sm text-neutral-600">Charte organisateur & anti-fraude – Tickrace V1</p>
      </div>
    </div>
    <div className="px-5 py-4 text-sm leading-6 text-neutral-800">{children}</div>
  </div>
);

const Pill = ({ children }) => (
  <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200">
    {children}
  </span>
);

export default function CharteOrganisateur() {
  const lastUpdate = useMemo(() => {
    // tu peux remplacer par une date fixe si tu veux figer la charte
    const d = new Date();
    return d.toLocaleDateString("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit" });
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Hero */}
      <div className="border-b border-neutral-200 bg-white">
        <Container>
          <div className="py-10">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="space-y-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Pill>
                  <ShieldCheck className="mr-2 inline h-4 w-4" />
                  Charte Organisateur
                </Pill>
                <Pill>
                  <FileWarning className="mr-2 inline h-4 w-4" />
                  Anti-fraude
                </Pill>
                <Pill>
                  <BadgeCheck className="mr-2 inline h-4 w-4" />
                  V1
                </Pill>
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
                Charte organisateur & anti-fraude
              </h1>

              <p className="max-w-3xl text-sm text-neutral-600">
                Dernière mise à jour : <span className="font-medium text-neutral-800">{lastUpdate}</span>. Cette charte
                complète les CGV Tickrace. En utilisant Tickrace, l’organisateur s’engage à respecter les règles ci-dessous.
              </p>
            </motion.div>
          </div>
        </Container>
      </div>

      <Container>
        <div className="py-10 space-y-6">
          <Card icon={BadgeCheck} title="1. Identité & autorisations">
            <ul className="list-disc pl-5 space-y-2">
              <li>Fournir une identité exacte et à jour (personne morale ou physique).</li>
              <li>
                Détenir les autorisations nécessaires (collectivités, propriétaires, préfecture si requis) et respecter la
                réglementation applicable.
              </li>
              <li>Être couvert par une assurance responsabilité civile organisateur.</li>
            </ul>
          </Card>

          <Card icon={CalendarDays} title="2. Transparence de l’événement">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Publier des informations exactes : date, lieu, distances, dénivelé, nombre de dossards, règlement, pièces
                justificatives (licence / PPS), etc.
              </li>
              <li>
                Communiquer clairement en cas de changement (mise à jour de la fiche course et, lorsque disponible,
                notification aux inscrits).
              </li>
            </ul>
          </Card>

          <Card icon={FileWarning} title="3. Lutte anti-fraude">
            <ul className="list-disc pl-5 space-y-2">
              <li>Interdiction d’usurper l’identité d’un autre organisateur ou d’une course existante.</li>
              <li>
                Tickrace peut demander des justificatifs supplémentaires et <strong>geler les fonds</strong> en cas de
                suspicion (ex. incohérences, signalements, activité anormale).
              </li>
              <li>
                En cas de fraude avérée, Tickrace peut annuler des ventes, rembourser les participants, résilier l’accès,
                et signaler les faits aux autorités compétentes.
              </li>
            </ul>
          </Card>

          <Card icon={CreditCard} title="4. Paiements">
            <ul className="list-disc pl-5 space-y-2">
              <li>Activer et maintenir un compte Stripe Express valide (KYC, coordonnées, justificatifs).</li>
              <li>Respecter les procédures de remboursement et les délais de réponse (≤ 72h) lorsqu’une action est requise.</li>
            </ul>
          </Card>

          <Card icon={Database} title="5. Données & conformité">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Respect du RGPD : l’usage des données des coureurs doit être strictement limité à l’organisation de
                l’événement et aux communications liées à celui-ci.
              </li>
              <li>Respect des obligations fiscales et sociales applicables.</li>
            </ul>
          </Card>

          <Card icon={Gavel} title="6. Sanctions">
            <p>
              Tout manquement grave à cette charte peut entraîner : gel des fonds, suppression d’événement, résiliation
              d’accès, et actions légales.
            </p>
          </Card>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-700">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl bg-neutral-100 p-2">
                <Info className="h-5 w-5 text-neutral-700" />
              </div>
              <div>
                <p className="font-semibold text-neutral-900">Note</p>
                <p className="mt-1">
                  Cette charte complète les CGV. Elle peut évoluer ; la poursuite d’utilisation de Tickrace vaut
                  acceptation de la version en vigueur.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}

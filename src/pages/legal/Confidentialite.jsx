// src/pages/legal/Confidentialite.jsx
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Shield, FileText, Info, Database, Users, Lock } from "lucide-react";

const Container = ({ children }) => (
  <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">{children}</div>
);

const Card = ({ icon: Icon, title, children }) => (
  <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
    <header className="flex items-start gap-3 border-b border-neutral-200 px-5 py-4">
      <div className="mt-0.5 rounded-xl bg-neutral-100 p-2">
        <Icon className="h-5 w-5 text-neutral-700" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        <p className="text-sm text-neutral-600">Confidentialité (RGPD) – Tickrace V1</p>
      </div>
    </header>
    <div className="px-5 py-4 text-sm leading-6 text-neutral-800">{children}</div>
  </section>
);

const Pill = ({ children }) => (
  <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200">
    {children}
  </span>
);

export default function Confidentialite() {
  const lastUpdate = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit" });
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50">
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
                  <Shield className="mr-2 inline h-4 w-4" />
                  RGPD
                </Pill>
                <Pill>
                  <FileText className="mr-2 inline h-4 w-4" />
                  Confidentialité
                </Pill>
                <Pill>
                  <Info className="mr-2 inline h-4 w-4" />
                  V1
                </Pill>
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Politique de confidentialité</h1>

              <p className="max-w-3xl text-sm text-neutral-600">
                Dernière mise à jour : <span className="font-medium text-neutral-800">{lastUpdate}</span>. Cette page décrit
                comment Tickrace collecte, utilise et protège tes données.
              </p>
            </motion.div>
          </div>
        </Container>
      </div>

      <Container>
        <div className="py-10 space-y-6">
          <Card icon={Info} title="1. Responsable de traitement">
            <p>
              Responsable : <strong>[à compléter]</strong> • Contact : <strong>contact@tickrace.com</strong>
            </p>
          </Card>

          <Card icon={Database} title="2. Données collectées">
            <ul className="list-disc pl-5 space-y-2">
              <li>Données de compte (email, identité, coordonnées).</li>
              <li>Données d’inscription (course, format, justificatifs, options).</li>
              <li>Données de paiement (identifiants techniques, statut) via le prestataire de paiement.</li>
              <li>Données techniques (logs, sécurité, lutte anti-fraude).</li>
            </ul>
          </Card>

          <Card icon={Users} title="3. Finalités">
            <ul className="list-disc pl-5 space-y-2">
              <li>Création de compte et gestion des inscriptions.</li>
              <li>Traitement des paiements et reversements.</li>
              <li>Communication liée à l’événement (emails transactionnels).</li>
              <li>Lutte anti-fraude, sécurité, conformité.</li>
            </ul>
          </Card>

          <Card icon={Lock} title="4. Partage des données">
            <p>
              Les données nécessaires à l’exécution du service peuvent être partagées avec :
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-2">
              <li>
                <strong>Organisateurs</strong> : uniquement pour gérer l’événement et les participants inscrits.
              </li>
              <li>
                <strong>Prestataire de paiement</strong> : pour traiter les paiements (ex. Stripe).
              </li>
              <li>
                <strong>Prestataires tiers</strong> (ex. chronométrage) : uniquement si l’option est activée et nécessaire à
                la prestation.
              </li>
            </ul>
          </Card>

          <Card icon={Shield} title="5. Conservation et sécurité">
            <p>
              Tickrace met en œuvre des mesures de sécurité adaptées (contrôles d’accès, journalisation, chiffrement quand
              applicable). Les durées de conservation dépendent des obligations légales et des besoins de gestion des
              événements.
            </p>
          </Card>

          <Card icon={FileText} title="6. Tes droits">
            <p>
              Conformément au RGPD, tu disposes de droits d’accès, de rectification, d’effacement, d’opposition, de limitation
              et de portabilité. Pour exercer tes droits : <strong>contact@tickrace.com</strong>.
            </p>
          </Card>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-700">
            <p className="font-semibold text-neutral-900">Note</p>
            <p className="mt-2">
              Cette politique pourra évoluer. La version publiée sur Tickrace fait foi. Pour les sujets sensibles (cookies,
              traqueurs, analytics), une section dédiée pourra être ajoutée en V2.
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}

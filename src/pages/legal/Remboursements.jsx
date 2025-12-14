// src/pages/Remboursements.jsx
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { FileText, Shield, CalendarDays, CreditCard, Info, Gavel } from "lucide-react";

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
        <p className="text-sm text-neutral-600">Politique de remboursement – Tickrace V1</p>
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

export default function Remboursements() {
  const lastUpdate = useMemo(() => {
    // Remplace par une date fixe si tu veux figer
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
                  <FileText className="mr-2 inline h-4 w-4" />
                  Remboursements
                </Pill>
                <Pill>
                  <Shield className="mr-2 inline h-4 w-4" />
                  Politique commune
                </Pill>
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
                Politique de remboursement
              </h1>

              <p className="max-w-3xl text-sm text-neutral-600">
                Dernière mise à jour : <span className="font-medium text-neutral-800">{lastUpdate}</span>. Cette politique
                s’applique aux inscriptions réalisées via Tickrace. Elle complète les CGV.
              </p>
            </motion.div>
          </div>
        </Container>
      </div>

      <Container>
        <div className="py-10 space-y-6">
          <Card icon={Info} title="1. Principe général">
            <p>
              Tickrace est une plateforme d’inscription et un intermédiaire de paiement. La politique de remboursement est
              <strong> commune</strong> et définie par Tickrace (V1). La commission Tickrace de <strong>5 %</strong> est
              conservée en toutes circonstances.
            </p>
            <p className="mt-3">
              Le remboursement éventuel est calculé sur le montant restant après déduction de cette commission, selon le
              barème ci-dessous. Le solde non remboursé est conservé par l’organisateur.
            </p>
          </Card>

          <Card icon={CalendarDays} title="2. Barème d’annulation (demande du participant)">
            <p>
              Le pourcentage de remboursement dépend du nombre de jours calendaires avant la date de l’événement :
            </p>

            <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
              <div className="border-b border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-900">
                Barème officiel Tickrace
              </div>
              <div className="px-4 py-3 text-sm text-neutral-800">
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>J-30 et plus</strong> : 90 %
                  </li>
                  <li>
                    <strong>J-15 à J-29</strong> : 70 %
                  </li>
                  <li>
                    <strong>J-7 à J-14</strong> : 50 %
                  </li>
                  <li>
                    <strong>J-3 à J-6</strong> : 30 %
                  </li>
                  <li>
                    <strong>J-0 à J-2</strong> : 0 %
                  </li>
                </ul>
                <p className="mt-3 text-neutral-700">
                  Les pourcentages s’appliquent <strong>après</strong> déduction de la commission Tickrace (5 %).
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
              <p className="text-sm text-neutral-800">
                <strong>Exemple :</strong> inscription 20 € → Tickrace conserve 1 € (5 %). Base remboursable 19 €. À J-10
                (50 %), le coureur reçoit 9,50 € et l’organisateur conserve 9,50 €.
              </p>
            </div>
          </Card>

          <Card icon={CreditCard} title="3. Cas particuliers (organisateur / événement)">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Annulation par l’organisateur</strong> : l’organisateur informe les participants. Tickrace applique,
                selon le contexte et les possibilités techniques, un remboursement et/ou un report, en cohérence avec la
                réglementation applicable et les contraintes de paiement.
              </li>
              <li>
                <strong>Report / modification majeure</strong> : lorsque l’événement est reporté ou modifié de manière
                substantielle, Tickrace peut proposer au participant des options disponibles (maintien, report, crédit,
                remboursement), selon les règles affichées dans l’interface.
              </li>
              <li>
                <strong>Options et prestations tierces</strong> : certaines options peuvent être non remboursables si la
                prestation a déjà été engagée (ex. chronométrage, production de dossard, personnalisation). Ces exclusions
                sont indiquées au moment de l’inscription.
              </li>
            </ul>
          </Card>

          <Card icon={Shield} title="4. Procédure de remboursement">
            <ol className="list-decimal pl-5 space-y-2">
              <li>Le participant initie la demande depuis son espace Tickrace (ou via le canal prévu sur la plateforme).</li>
              <li>
                Tickrace applique automatiquement le barème et calcule le montant, puis déclenche le remboursement et/ou le
                crédit selon les fonctionnalités actives.
              </li>
              <li>
                L’organisateur est informé du remboursement et de la répartition (coureur / organisateur) via son espace.
              </li>
            </ol>
          </Card>

          <Card icon={Gavel} title="5. Litiges & rétrofacturations (chargebacks)">
            <p>
              En cas de litige bancaire (chargeback), le montant contesté peut être bloqué, déduit ou compensé dans les
              reversements en attente, jusqu’à résolution du dossier par l’établissement bancaire et le prestataire de
              paiement.
            </p>
          </Card>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-700">
            <p className="font-semibold text-neutral-900">Note</p>
            <p className="mt-2">
              Certaines lois peuvent limiter le droit de rétractation pour des services de loisirs à date déterminée. Cette
              politique pourra évoluer ; la version affichée sur Tickrace fait foi.
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}

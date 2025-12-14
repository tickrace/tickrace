// src/pages/CGVCoureurs.jsx
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { FileText, Shield, CreditCard, Info, CalendarDays } from "lucide-react";

const Container = ({ children }) => (
  <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">{children}</div>
);

const Section = ({ id, title, icon: Icon, children }) => (
  <section id={id} className="scroll-mt-24">
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-neutral-200 px-5 py-4">
        <div className="mt-0.5 rounded-xl bg-neutral-100 p-2">
          <Icon className="h-5 w-5 text-neutral-700" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
          <p className="text-sm text-neutral-600">Conditions Coureurs (Tickrace V1)</p>
        </div>
      </div>
      <div className="px-5 py-4 text-sm leading-6 text-neutral-800">{children}</div>
    </div>
  </section>
);

const AnchorLink = ({ href, children }) => (
  <a
    href={href}
    className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100"
  >
    <span className="h-2 w-2 rounded-full bg-neutral-300" />
    {children}
  </a>
);

export default function CGVCoureurs() {
  const lastUpdate = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "2-digit" });
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
              className="flex flex-col gap-3"
            >
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                <FileText className="h-4 w-4" />
                CGV Coureurs – Tickrace V1
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Conditions Coureurs</h1>

              <p className="max-w-3xl text-sm text-neutral-600">
                Dernière mise à jour : <span className="font-medium text-neutral-800">{lastUpdate}</span>. Tickrace est une
                plateforme d’inscription et un intermédiaire de paiement. L’événement est organisé par l’organisateur
                indiqué sur la page de course.
              </p>
            </motion.div>

            {/* Nav */}
            <div className="mt-6 flex flex-wrap gap-2">
              <AnchorLink href="#objet">1. Objet</AnchorLink>
              <AnchorLink href="#compte">2. Compte</AnchorLink>
              <AnchorLink href="#inscription">3. Inscription</AnchorLink>
              <AnchorLink href="#paiement">4. Paiement</AnchorLink>
              <AnchorLink href="#annulation">5. Annulation</AnchorLink>
              <AnchorLink href="#options">6. Options</AnchorLink>
              <AnchorLink href="#chrono">7. Chronométrage</AnchorLink>
              <AnchorLink href="#responsabilite">8. Responsabilité</AnchorLink>
              <AnchorLink href="#donnees">9. Données</AnchorLink>
              <AnchorLink href="#droit">10. Droit applicable</AnchorLink>
            </div>
          </div>
        </Container>
      </div>

      <Container>
        <div className="py-10 space-y-6">
          <Section id="objet" title="1. Objet" icon={Info}>
            <p>
              Les présentes conditions encadrent l’utilisation de Tickrace par les participants (coureurs) pour s’inscrire à
              des événements sportifs proposés par des organisateurs tiers.
            </p>
            <p className="mt-3">
              Tickrace agit en qualité de plateforme technique et d’intermédiaire de paiement. L’organisateur demeure seul
              responsable de l’événement, de son déroulement et de sa conformité.
            </p>
          </Section>

          <Section id="compte" title="2. Compte et exactitude des informations" icon={Shield}>
            <p>
              Le participant s’engage à fournir des informations exactes lors de la création de compte et/ou de l’inscription
              (identité, coordonnées, justificatifs éventuels). Toute fausse déclaration peut entraîner l’annulation de
              l’inscription.
            </p>
          </Section>

          <Section id="inscription" title="3. Inscription à un événement" icon={CalendarDays}>
            <p>
              L’inscription à un événement via Tickrace constitue une demande d’inscription auprès de l’organisateur. Les
              informations essentielles (date, lieu, format, prix, options) sont affichées sur la page de l’événement.
            </p>
            <p className="mt-3">
              Le participant reconnaît que l’organisateur est seul responsable des conditions sportives et logistiques de
              l’événement, ainsi que des informations communiquées sur la page de course.
            </p>
          </Section>

          <Section id="paiement" title="4. Paiement" icon={CreditCard}>
            <p>
              Le paiement s’effectue via un prestataire de paiement sécurisé. Les prix affichés sont en principe indiqués{" "}
              <strong>TTC</strong>. Une confirmation d’inscription peut être transmise après validation du paiement.
            </p>
          </Section>

          <Section id="annulation" title="5. Politique d’annulation Tickrace (commune)" icon={Shield}>
            <p>
              La politique d’annulation est <strong>unique</strong> et appliquée par Tickrace. La commission Tickrace (5 %)
              est conservée en toutes circonstances. Le remboursement éventuel est calculé sur la base restante après
              déduction de cette commission.
            </p>

            <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
              <div className="border-b border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-900">
                Barème d’annulation
              </div>
              <div className="px-4 py-3 text-sm text-neutral-800">
                <ul className="list-disc pl-5 space-y-1">
                  <li>J-30 et plus : 90 %</li>
                  <li>J-15 à J-29 : 70 %</li>
                  <li>J-7 à J-14 : 50 %</li>
                  <li>J-3 à J-6 : 30 %</li>
                  <li>J-0 à J-2 : 0 %</li>
                </ul>
                <p className="mt-3 text-neutral-700">
                  Les pourcentages s’appliquent <strong>après</strong> déduction de la commission Tickrace (5 %). Le solde non
                  remboursé est conservé par l’organisateur.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
              <p className="text-sm text-neutral-800">
                <strong>Exemple :</strong> inscription 20 € → Tickrace conserve 1 € (5 %). Base remboursable 19 €. À J-10
                (50 %), le coureur reçoit 9,50 €.
              </p>
            </div>

            <p className="mt-4">
              Le remboursement peut prendre la forme d’un remboursement partiel et/ou d’un crédit Tickrace selon les
              fonctionnalités disponibles. Certaines prestations tierces peuvent être exclues du remboursement si elles ont
              déjà été engagées (ex. chronométrage), ce qui est indiqué lors de l’inscription.
            </p>
          </Section>

          <Section id="options" title="6. Options (repas, t-shirt, tombola…)" icon={Info}>
            <p>
              Certaines options (repas, t-shirt, tombola, goodies, etc.) peuvent être proposées sur la page de l’événement.
              Le participant reconnaît que la fourniture matérielle de ces options relève de l’organisateur.
            </p>
            <p className="mt-3">
              En cas d’annulation, des exclusions peuvent s’appliquer à certaines options si la prestation a déjà été engagée.
              Ces conditions sont indiquées lors de l’inscription.
            </p>
          </Section>

          <Section id="chrono" title="7. Option prestataire chronométrage" icon={Info}>
            <p>
              Une option de chronométrage peut être proposée par un prestataire tiers. Tickrace agit comme intermédiaire
              technique et de facturation.
            </p>
            <p className="mt-3">
              Le prix de l’option prestataire chronométrage est fixé à <strong>1,30 € par coureur</strong>. Tickrace ne
              perçoit aucune commission sur cette option. Le prestataire est seul responsable de la prestation de
              chronométrage.
            </p>
          </Section>

          <Section id="responsabilite" title="8. Responsabilité" icon={Shield}>
            <p>
              Tickrace est tenue à une obligation de moyens pour l’accès et le fonctionnement de la plateforme. Tickrace ne
              saurait être tenue responsable du déroulement de l’événement, d’un accident, d’un report/annulation par
              l’organisateur, ou d’une défaillance d’un prestataire tiers.
            </p>
          </Section>

          <Section id="donnees" title="9. Données personnelles" icon={Shield}>
            <p>
              Tickrace traite les données personnelles conformément au RGPD. Les données nécessaires à l’inscription et à la
              gestion de l’événement peuvent être transmises à l’organisateur et, le cas échéant, au prestataire de
              chronométrage, uniquement pour l’exécution des services.
            </p>
          </Section>

          <Section id="droit" title="10. Droit applicable et juridiction" icon={Info}>
            <p>
              Les présentes conditions sont soumises au droit français. Tout litige relèvera de la compétence des tribunaux
              compétents du ressort du siège de Tickrace.
            </p>
          </Section>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-700">
            <p className="font-semibold text-neutral-900">Informations légales</p>
            <p className="mt-2">
              Éditeur : <strong>[à compléter]</strong> • Contact : <strong>[email]</strong>
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}

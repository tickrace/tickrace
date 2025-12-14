// src/pages/CGVOrganisateurs.jsx
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { FileText, Shield, CreditCard, Handshake, Info } from "lucide-react";

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
          <p className="text-sm text-neutral-600">
            Conditions Générales de Vente – Organisateurs (Tickrace V1)
          </p>
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

export default function CGVOrganisateurs() {
  const lastUpdate = useMemo(() => {
    // tu peux remplacer par une date fixe si tu préfères
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
                CGV Organisateurs – Tickrace V1
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
                Conditions Générales de Vente – Organisateurs
              </h1>

              <p className="max-w-3xl text-sm text-neutral-600">
                Dernière mise à jour : <span className="font-medium text-neutral-800">{lastUpdate}</span>.{" "}
                Tickrace est une plateforme technique et un intermédiaire de paiement. Tickrace n’est ni organisateur,
                ni co-organisateur des événements publiés.
              </p>
            </motion.div>

            {/* Nav */}
            <div className="mt-6 flex flex-wrap gap-2">
              <AnchorLink href="#presentation">1. Présentation</AnchorLink>
              <AnchorLink href="#champ">2. Champ d’application</AnchorLink>
              <AnchorLink href="#responsabilites">3. Responsabilités</AnchorLink>
              <AnchorLink href="#tarifs-inscriptions">4. Tarifs inscriptions</AnchorLink>
              <AnchorLink href="#tarifs-options">5. Tarifs options</AnchorLink>
              <AnchorLink href="#chrono">6. Option chronométrage</AnchorLink>
              <AnchorLink href="#paiements">7. Paiements</AnchorLink>
              <AnchorLink href="#reversements">8. Reversements</AnchorLink>
              <AnchorLink href="#annulation">9. Annulation</AnchorLink>
              <AnchorLink href="#responsa-tickrace">10. Responsabilité</AnchorLink>
              <AnchorLink href="#donnees">11. Données</AnchorLink>
              <AnchorLink href="#suspension">12. Suspension</AnchorLink>
              <AnchorLink href="#modif">13. Modifications</AnchorLink>
              <AnchorLink href="#droit">14. Droit applicable</AnchorLink>
            </div>
          </div>
        </Container>
      </div>

      <Container>
        <div className="py-10 space-y-6">
          <Section id="presentation" title="1. Présentation de Tickrace" icon={Info}>
            <p>
              Tickrace est une plateforme en ligne permettant la gestion administrative et financière d’événements
              sportifs, notamment : création et publication d’événements, gestion des inscriptions et options, encaissement
              des paiements des participants, et mise en relation avec des prestataires tiers.
            </p>
            <p className="mt-3">
              Tickrace agit <strong>exclusivement</strong> en qualité de plateforme technique et d’intermédiaire de
              paiement. Tickrace <strong>n’est ni organisateur, ni co-organisateur</strong> des événements publiés.
            </p>
          </Section>

          <Section id="champ" title="2. Champ d’application" icon={Shield}>
            <p>
              Les présentes Conditions Générales de Vente (CGV) s’appliquent à tout organisateur utilisant la plateforme
              Tickrace. Toute utilisation implique l’acceptation pleine et entière des présentes CGV.
            </p>
          </Section>

          <Section id="responsabilites" title="3. Création et responsabilité de l’événement" icon={Handshake}>
            <p>
              L’organisateur est seul responsable : des informations publiées, de la conformité réglementaire (autorisations,
              assurances, sécurité), et du bon déroulement de l’événement.
            </p>
            <p className="mt-3">
              Tickrace fournit uniquement un <strong>outil logiciel</strong> de gestion et ne saurait être tenue responsable
              de l’organisation sportive ou logistique.
            </p>
          </Section>

          <Section id="tarifs-inscriptions" title="4. Tarification – Inscriptions" icon={CreditCard}>
            <p>
              Pour chaque inscription effectuée via la plateforme, Tickrace perçoit une <strong>commission de 5 %</strong>{" "}
              sur le montant de l’inscription. Cette commission inclut les frais de plateforme et les frais techniques de
              paiement.
            </p>
            <p className="mt-3">
              Le solde, soit <strong>95 %</strong>, est destiné à l’organisateur selon les modalités prévues à l’article 8.
              Les prix affichés aux participants sont <strong>TTC</strong>.
            </p>
          </Section>

          <Section id="tarifs-options" title="5. Tarification – Options organisateur" icon={CreditCard}>
            <p>
              L’organisateur peut proposer des options payantes (repas, t-shirt, tombola, goodies, etc.). Tickrace perçoit
              une <strong>commission de 5 %</strong> sur le montant de chaque option. Le solde est reversé à l’organisateur.
            </p>
            <p className="mt-3">
              Tickrace n’intervient pas dans la fourniture matérielle de ces options, qui relève exclusivement de la
              responsabilité de l’organisateur.
            </p>
          </Section>

          <Section id="chrono" title="6. Option prestataire chronométrage" icon={Handshake}>
            <p>
              Tickrace peut proposer une option de chronométrage fournie par un prestataire tiers. Tickrace agit uniquement
              en tant qu’intermédiaire de mise en relation et de facturation.
            </p>
            <p className="mt-3">
              Le prix de l’option prestataire chronométrage est fixé à <strong>1,30 € par coureur</strong>. Ce montant est{" "}
              <strong>intégralement reversé</strong> aux prestataires concernés selon leurs accords internes. Tickrace{" "}
              <strong>ne perçoit aucune commission</strong> sur cette option.
            </p>
            <p className="mt-3">
              Le prestataire de chronométrage est seul responsable de la bonne exécution de sa prestation. Tickrace ne
              saurait être tenue responsable d’un dysfonctionnement du matériel, d’une erreur de chronométrage, d’un retard
              ou d’une défaillance du prestataire.
            </p>
          </Section>

          <Section id="paiements" title="7. Paiements" icon={CreditCard}>
            <p>
              Les paiements des participants sont encaissés via un prestataire de paiement sécurisé (ex. Stripe). Tickrace
              agit en tant qu’intermédiaire de paiement conformément à la réglementation applicable.
            </p>
          </Section>

          <Section id="reversements" title="8. Reversements à l’organisateur" icon={CreditCard}>
            <p>
              Les reversements sont effectués automatiquement selon les modalités techniques de la plateforme. Les montants
              reversés correspondent aux sommes encaissées <strong>déduction faite</strong> des commissions Tickrace
              applicables.
            </p>
            <p className="mt-3">
              Les délais de reversement peuvent varier selon les contraintes du prestataire de paiement.
            </p>
          </Section>

          <Section id="annulation" title="9. Politique d’annulation commune Tickrace" icon={Shield}>
            <p>
              La politique d’annulation est <strong>unique, commune et définie par Tickrace</strong>. L’organisateur ne peut
              pas définir sa propre politique d’annulation. La <strong>commission Tickrace de 5 %</strong> est conservée en
              toutes circonstances.
            </p>

            <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
              <div className="border-b border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-900">
                Barème d’annulation
              </div>
              <div className="px-4 py-3 text-sm text-neutral-800">
                <ul className="list-disc pl-5 space-y-1">
                  <li>J-30+ : 90%</li>
                  <li>J-15–29 : 70%</li>
                  <li>J-7–14 : 50%</li>
                  <li>J-3–6 : 30%</li>
                  <li>J-0–2 : 0%</li>
                </ul>
                <p className="mt-3 text-neutral-700">
                  Ces pourcentages s’appliquent <strong>après</strong> déduction de la commission Tickrace (5 %). Le montant
                  restant (95 %) est réparti entre le coureur (selon barème) et l’organisateur (solde non remboursé).
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
              <p className="text-sm text-neutral-800">
                <strong>Exemple :</strong> inscription 20 € → Tickrace conserve 1 € (5 %). Base remboursable 19 €. À J-10
                (50 %), le coureur reçoit 9,50 € et l’organisateur conserve 9,50 €.
              </p>
            </div>

            <p className="mt-4">
              Le remboursement peut prendre la forme d’un remboursement partiel et/ou d’un crédit Tickrace selon les
              fonctionnalités disponibles. Certaines prestations tierces (notamment le chronométrage) peuvent ne pas être
              remboursables si la prestation a déjà été engagée ; ces exclusions sont indiquées lors de l’inscription.
            </p>
          </Section>

          <Section id="responsa-tickrace" title="10. Responsabilité de Tickrace" icon={Shield}>
            <p>
              Tickrace est tenue à une obligation de moyens. Tickrace ne saurait être tenue responsable de l’annulation ou du
              report d’un événement, d’un accident survenu lors de l’événement, d’un litige entre participant et organisateur,
              ou d’une défaillance d’un prestataire tiers.
            </p>
          </Section>

          <Section id="donnees" title="11. Données personnelles" icon={Shield}>
            <p>
              Tickrace collecte et traite les données personnelles conformément au RGPD. Tickrace agit en qualité de
              responsable de traitement pour la plateforme et d’intermédiaire technique pour les données nécessaires à
              l’organisation des événements.
            </p>
          </Section>

          <Section id="suspension" title="12. Suspension et résiliation" icon={Shield}>
            <p>
              Tickrace se réserve le droit de suspendre ou supprimer un compte en cas de non-respect des présentes CGV,
              utilisation frauduleuse, ou atteinte au bon fonctionnement ou à l’image de Tickrace.
            </p>
          </Section>

          <Section id="modif" title="13. Modification des CGV" icon={Info}>
            <p>
              Tickrace se réserve le droit de modifier les présentes CGV à tout moment. Les CGV applicables sont celles en
              vigueur à la date d’utilisation de la plateforme par l’organisateur.
            </p>
          </Section>

          <Section id="droit" title="14. Droit applicable et juridiction" icon={Info}>
            <p>
              Les présentes CGV sont soumises au droit français. Tout litige relèvera de la compétence exclusive des tribunaux
              du ressort du siège de Tickrace.
            </p>
          </Section>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-700">
            <p className="font-semibold text-neutral-900">Informations légales</p>
            <p className="mt-2">
              Raison sociale / Nom : <strong>[à compléter]</strong> • SIRET : <strong>[à compléter]</strong> • Adresse :
              <strong> [à compléter]</strong> • Contact : <strong>[email]</strong>
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}

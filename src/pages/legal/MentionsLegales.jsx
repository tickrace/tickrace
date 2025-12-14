// src/pages/legal/MentionsLegales.jsx
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { FileText, Info, Building2, Mail, Shield, Gavel } from "lucide-react";

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
        <p className="text-sm text-neutral-600">Mentions légales – Tickrace V1</p>
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

export default function MentionsLegales() {
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
                  <FileText className="mr-2 inline h-4 w-4" />
                  Mentions légales
                </Pill>
                <Pill>
                  <Info className="mr-2 inline h-4 w-4" />
                  V1
                </Pill>
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Mentions légales</h1>

              <p className="max-w-3xl text-sm text-neutral-600">
                Dernière mise à jour : <span className="font-medium text-neutral-800">{lastUpdate}</span>. Remplis les champs
                “à compléter” dès que tu as ton statut final (micro / société).
              </p>
            </motion.div>
          </div>
        </Container>
      </div>

      <Container>
        <div className="py-10 space-y-6">
          <Card icon={Building2} title="1. Éditeur du site">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Nom / Raison sociale : <strong>[à compléter]</strong>
              </li>
              <li>
                Statut : <strong>[à compléter]</strong>
              </li>
              <li>
                SIRET : <strong>[à compléter]</strong>
              </li>
              <li>
                Adresse : <strong>[à compléter]</strong>
              </li>
              <li>
                Directeur de publication : <strong>[à compléter]</strong>
              </li>
            </ul>
          </Card>

          <Card icon={Mail} title="2. Contact">
            <p>
              Email : <strong>contact@tickrace.com</strong> (ou <strong>[à compléter]</strong>)
            </p>
          </Card>

          <Card icon={Shield} title="3. Hébergement">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Hébergeur : <strong>Vercel Inc.</strong>
              </li>
              <li>
                Adresse : <strong>340 S Lemon Ave #4133, Walnut, CA 91789, USA</strong> (à vérifier si besoin)
              </li>
              <li>
                Site : <strong>vercel.com</strong>
              </li>
            </ul>
          </Card>

          <Card icon={Gavel} title="4. Propriété intellectuelle">
            <p>
              Le site, la marque Tickrace, les éléments graphiques, textes, logos, interfaces et contenus sont protégés par
              le droit de la propriété intellectuelle. Toute reproduction ou utilisation non autorisée est interdite.
            </p>
          </Card>

          <Card icon={Info} title="5. Limitation de responsabilité">
            <p>
              Tickrace est une plateforme technique et un intermédiaire de paiement. Les événements sont organisés par des
              tiers. Tickrace ne saurait être tenue responsable du déroulement des événements, ni des décisions prises par
              les organisateurs ou prestataires.
            </p>
          </Card>
        </div>
      </Container>
    </div>
  );
}

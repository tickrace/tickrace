// src/components/Footer.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Instagram,
  Twitter,
  Youtube,
  Mail,
  ArrowUpRight,
  Shield,
  FileText,
  LifeBuoy,
} from "lucide-react";

const Container = ({ children }) => (
  <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
);

const FooterLink = ({ to, children }) => (
  <Link
    to={to}
    className="text-sm text-neutral-300 hover:text-white transition-colors inline-flex items-center gap-2"
  >
    {children}
    <ArrowUpRight className="h-4 w-4 opacity-70" />
  </Link>
);

const ExternalLink = ({ href, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="text-sm text-neutral-300 hover:text-white transition-colors inline-flex items-center gap-2"
  >
    {children}
    <ArrowUpRight className="h-4 w-4 opacity-70" />
  </a>
);

const IconBtn = ({ href, label, children }) => (
  <a
    href={href}
    aria-label={label}
    target="_blank"
    rel="noreferrer"
    className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-800 text-neutral-200 hover:bg-neutral-700 transition-colors"
  >
    {children}
  </a>
);

export default function Footer() {
  const year = new Date().getFullYear();
  const { pathname } = useLocation();

  const scrollTop = () => {
    // UX: remonte en haut quand on clique un lien du footer et qu'on est déjà sur la page
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const isActive = (p) => pathname === p;

  const activeClass = "text-white";
  const normalClass = "text-neutral-300 hover:text-white";

  return (
    <footer className="bg-neutral-900 text-neutral-200">
      {/* Top band */}
      <div className="border-b border-neutral-800">
        <Container>
          <div className="py-10 grid grid-cols-1 md:grid-cols-4 gap-10">
            {/* Brand */}
            <div className="space-y-4">
              <Link to="/" className="inline-flex items-center gap-3" onClick={scrollTop}>
                <img
                  src="/logo.png"
                  alt="Tickrace"
                  className="h-10 w-auto rounded-xl"
                  loading="lazy"
                />
                <span className="text-xl font-semibold tracking-tight">Tickrace</span>
              </Link>
              <p className="text-sm text-neutral-300 leading-6">
                La plateforme moderne pour créer, gérer et partager des événements sportifs —
                inscriptions, options, paiements et communauté.
              </p>

              <div className="flex items-center gap-2 pt-1">
                <IconBtn href="https://instagram.com" label="Instagram">
                  <Instagram className="h-5 w-5" />
                </IconBtn>
                <IconBtn href="https://twitter.com" label="X / Twitter">
                  <Twitter className="h-5 w-5" />
                </IconBtn>
                <IconBtn href="https://youtube.com" label="YouTube">
                  <Youtube className="h-5 w-5" />
                </IconBtn>
                <IconBtn href="mailto:contact@tickrace.com" label="Email">
                  <Mail className="h-5 w-5" />
                </IconBtn>
              </div>
            </div>

            {/* Navigation */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Navigation</h3>
              <div className="space-y-2">
                <Link
                  to="/"
                  onClick={scrollTop}
                  className={`text-sm inline-flex items-center gap-2 transition-colors ${
                    isActive("/") ? activeClass : normalClass
                  }`}
                >
                  Accueil <ArrowUpRight className="h-4 w-4 opacity-70" />
                </Link>
                <Link
                  to="/courses"
                  onClick={scrollTop}
                  className={`text-sm inline-flex items-center gap-2 transition-colors ${
                    isActive("/courses") ? activeClass : normalClass
                  }`}
                >
                  Courses <ArrowUpRight className="h-4 w-4 opacity-70" />
                </Link>
                <Link
                  to="/premium"
                  onClick={scrollTop}
                  className={`text-sm inline-flex items-center gap-2 transition-colors ${
                    isActive("/premium") ? activeClass : normalClass
                  }`}
                >
                  Premium <ArrowUpRight className="h-4 w-4 opacity-70" />
                </Link>
                <Link
                  to="/organisateur"
                  onClick={scrollTop}
                  className={`text-sm inline-flex items-center gap-2 transition-colors ${
                    isActive("/organisateur") ? activeClass : normalClass
                  }`}
                >
                  Espace organisateur <ArrowUpRight className="h-4 w-4 opacity-70" />
                </Link>
              </div>
            </div>

            {/* Support */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Support</h3>
              <div className="space-y-2">
                <FooterLink to="/faq" onClick={scrollTop}>
                  <LifeBuoy className="h-4 w-4 opacity-80" />
                  FAQ
                </FooterLink>
                <ExternalLink href="mailto:support@tickrace.com">
                  <Mail className="h-4 w-4 opacity-80" />
                  support@tickrace.com
                </ExternalLink>
                <ExternalLink href="mailto:contact@tickrace.com">
                  <Mail className="h-4 w-4 opacity-80" />
                  contact@tickrace.com
                </ExternalLink>
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-xl bg-neutral-800 p-2">
                    <Shield className="h-5 w-5 text-neutral-200" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Paiements sécurisés</p>
                    <p className="text-sm text-neutral-300">
                      Inscriptions et reversements automatisés via Stripe.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Legal */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Légal</h3>
              <div className="space-y-2">
                <FooterLink to="/cgv-coureurs" onClick={scrollTop}>
                  <FileText className="h-4 w-4 opacity-80" />
                  CGV Coureurs
                </FooterLink>
                <FooterLink to="/cgv-organisateurs" onClick={scrollTop}>
                  <FileText className="h-4 w-4 opacity-80" />
                  CGV Organisateurs
                </FooterLink>
                <FooterLink to="/remboursements" onClick={scrollTop}>
                  <FileText className="h-4 w-4 opacity-80" />
                  Politique de remboursement
                </FooterLink>
                <FooterLink to="/charte-organisateur" onClick={scrollTop}>
                  <FileText className="h-4 w-4 opacity-80" />
                  Charte organisateur & anti-fraude
                </FooterLink>

                {/* Bonus: placeholders utiles */}
                <FooterLink to="/mentions-legales" onClick={scrollTop}>
                  <FileText className="h-4 w-4 opacity-80" />
                  Mentions légales
                </FooterLink>
                <FooterLink to="/confidentialite" onClick={scrollTop}>
                  <FileText className="h-4 w-4 opacity-80" />
                  Confidentialité (RGPD)
                </FooterLink>
              </div>

              <p className="pt-3 text-xs text-neutral-400 leading-5">
                © {year} Tickrace. Tous droits réservés.
                <br />
                Tickrace est une plateforme technique : les événements sont organisés par des tiers.
              </p>
            </div>
          </div>
        </Container>
      </div>

      {/* Bottom band */}
      <div className="bg-neutral-950">
        <Container>
          <div className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-xs text-neutral-400">
              Version V1 • 5% plateforme sur inscriptions et options • Option prestataire chrono : 1,30€ / coureur
            </p>

            <button
              onClick={scrollTop}
              className="text-xs text-neutral-300 hover:text-white transition-colors inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 border border-neutral-800"
              type="button"
            >
              Retour en haut <ArrowUpRight className="h-4 w-4 opacity-70" />
            </button>
          </div>
        </Container>
      </div>
    </footer>
  );
}

// src/components/Footer.jsx
import React from "react";
import { Link } from "react-router-dom";
import {
  Instagram,
  Twitter,
  Youtube,
  Mail,
  ArrowRight,
} from "lucide-react";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-neutral-900 text-neutral-200">
      {/* Top band */}
      <div className="border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="inline-flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Tickrace"
                className="h-10 w-auto rounded-xl"
                loading="lazy"
              />
              <span className="text-xl font-semibold tracking-tight">Tickrace</span>
            </Link>
            <p className="text-sm text-neutral-400 leading-relaxed">
              La plateforme simple et rapide pour publier, découvrir et s’inscrire à des courses trail.
            </p>

            <div className="rounded-xl bg-neutral-800/60 p-4">
              <p className="text-sm font-semibold">Reversements</p>
              <p className="text-sm text-neutral-300">
                95% automatique à <span className="font-medium">J+1</span> <br />
                ou <span className="font-medium">Acompte</span> sur demande
              </p>
            </div>
          </div>

          {/* Organisateur */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-4">
              Organisateur
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href="https://www.tickrace.com/organisateur/mon-espace"
                  className="hover:text-white"
                >
                  Mon espace
                </a>
              </li>
              <li>
                <Link to="/organisateur/nouvelle-course" className="hover:text-white">
                  Publier une épreuve
                </Link>
              </li>
              <li>
                <Link to="/organisateur/liste-epreuves" className="hover:text-white">
                  Gérer mes épreuves
                </Link>
              </li>
              <li>
                <Link to="/premium" className="hover:text-white">
                  Tarifs & avantages
                </Link>
              </li>
            </ul>
          </div>

          {/* Coureur */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-4">
              Coureur
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/courses" className="hover:text-white">
                  Toutes les courses
                </Link>
              </li>
              <li>
                <Link to="/mesinscriptions" className="hover:text-white">
                  Mes inscriptions
                </Link>
              </li>
              <li>
                <Link to="/monprofil" className="hover:text-white">
                  Mon profil
                </Link>
              </li>
              <li>
                <Link to="/premium" className="hover:text-white">
                  Passer en Premium
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter + Réseaux */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-4">
              Rester informé
            </h3>

            <form
              className="flex w-full items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                // À relier à votre backend / Resend / Supabase Edge Function
                alert("Merci ! Vous serez tenu informé des nouveautés Tickrace.");
              }}
            >
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  type="email"
                  required
                  placeholder="Votre email"
                  className="w-full rounded-xl bg-neutral-800/70 pl-10 pr-12 py-3 text-sm outline-none ring-1 ring-transparent focus:ring-neutral-600 placeholder:text-neutral-500"
                />
                <button
                  type="submit"
                  className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/20"
                  aria-label="S'inscrire"
                >
                  <span>S’inscrire</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>

            <div className="mt-5 flex items-center gap-3">
              <a
                href="https://instagram.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-neutral-800/70 hover:bg-neutral-700"
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="https://twitter.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-neutral-800/70 hover:bg-neutral-700"
                aria-label="X (Twitter)"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="https://youtube.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-neutral-800/70 hover:bg-neutral-700"
                aria-label="YouTube"
              >
                <Youtube className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom band */}
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-xs text-neutral-400">
          © {year} Tickrace — Tous droits réservés.
        </p>
        <nav className="flex flex-wrap items-center gap-4 text-xs">
          <Link to="/conditions" className="hover:text-white">Conditions</Link>
          <span className="text-neutral-700">•</span>
          <Link to="/confidentialite" className="hover:text-white">Confidentialité</Link>
          <span className="text-neutral-700">•</span>
          <Link to="/contact" className="hover:text-white">Contact</Link>
          <span className="text-neutral-700">•</span>
          <Link to="/mentions-legales" className="hover:text-white">Mentions légales</Link>
        </nav>
      </div>
    </footer>
  );
}

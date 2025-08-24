// src/pages/index.jsx
import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Users, CreditCard, Clock, MessageSquare } from "lucide-react";

export default function Index() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="w-full bg-white shadow-md fixed top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <img src="/logo.png" alt="TickRace Logo" className="h-10 w-auto" />
          </Link>
          <nav className="space-x-6 font-semibold text-gray-700">
            <Link to="/courses" className="hover:text-orange-500">Courses</Link>
            <Link to="/organisateur" className="hover:text-orange-500">Organisateurs</Link>
            <Link to="/premium" className="hover:text-orange-500">Premium</Link>
            <Link to="/login" className="hover:text-orange-500">Connexion</Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex flex-col justify-center items-center text-center bg-gradient-to-b from-orange-100 to-white pt-32 pb-24">
        <img src="/logo.png" alt="TickRace Logo" className="h-24 w-auto mb-6" />
        <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900">
          Tick<span className="text-orange-500">Race</span>
        </h1>
        <p className="mt-4 text-lg md:text-xl text-gray-700 max-w-2xl">
          La plateforme gratuite pour les coureurs & organisateurs de trail.
        </p>
        <div className="mt-8 flex space-x-4">
          <Link
            to="/courses"
            className="px-6 py-3 bg-orange-500 text-white rounded-xl shadow-lg hover:bg-orange-600 transition flex items-center"
          >
            Voir les courses <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
          <Link
            to="/organisateur"
            className="px-6 py-3 border border-orange-500 text-orange-500 rounded-xl hover:bg-orange-50 transition"
          >
            Espace organisateur
          </Link>
        </div>
      </section>

      {/* Fonctionnalités */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-10 text-center">
          <div>
            <Users className="mx-auto h-12 w-12 text-orange-500" />
            <h3 className="mt-4 text-xl font-bold">Événements faciles</h3>
            <p className="text-gray-600">Crée ton épreuve en 2 minutes.</p>
          </div>
          <div>
            <CreditCard className="mx-auto h-12 w-12 text-orange-500" />
            <h3 className="mt-4 text-xl font-bold">Paiements sécurisés</h3>
            <p className="text-gray-600">Stripe gère toutes les transactions.</p>
          </div>
          <div>
            <Clock className="mx-auto h-12 w-12 text-orange-500" />
            <h3 className="mt-4 text-xl font-bold">Estimation chrono</h3>
            <p className="text-gray-600">Basée sur ta cote ITRA.</p>
          </div>
          <div>
            <MessageSquare className="mx-auto h-12 w-12 text-orange-500" />
            <h3 className="mt-4 text-xl font-bold">Communauté</h3>
            <p className="text-gray-600">Discute avec les autres coureurs.</p>
          </div>
        </div>
      </section>

      {/* Premium */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto text-center px-6">
          <h2 className="text-3xl font-bold text-gray-900">
            Passe au <span className="text-orange-500">Premium</span>
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Plans IA personnalisés, intégration Strava, exports vers ta montre, et plus encore.
          </p>
          <Link
            to="/premium"
            className="mt-6 inline-block px-8 py-3 bg-orange-500 text-white rounded-xl shadow hover:bg-orange-600 transition"
          >
            Découvrir Premium
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-10 mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center">
          <p>&copy; {new Date().getFullYear()} TickRace. Tous droits réservés.</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <Link to="/mentions" className="hover:text-white">Mentions légales</Link>
            <Link to="/contact" className="hover:text-white">Contact</Link>
            <Link to="/confidentialite" className="hover:text-white">Confidentialité</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

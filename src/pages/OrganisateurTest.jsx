// src/pages/OrganisateurTest.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function OrganisateurTest() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold">OrganisateurTest</h1>
      <p className="mt-2 text-neutral-600">
        Page de test désactivée (placeholder) pour éviter les erreurs de build.
      </p>
      <div className="mt-4">
        <Link to="/" className="text-sm underline text-neutral-700 hover:text-black">
          Retour accueil
        </Link>
      </div>
    </div>
  );
}

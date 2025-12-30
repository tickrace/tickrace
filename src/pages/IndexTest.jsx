// src/pages/IndexTest.jsx
import React from "react";
import { Link } from "react-router-dom";

const CardLink = ({ to, title, desc }) => (
  <Link
    to={to}
    className="block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:bg-neutral-50 transition"
  >
    <div className="text-lg font-semibold">{title}</div>
    <div className="mt-1 text-sm text-neutral-600">{desc}</div>
    <div className="mt-3 text-sm font-semibold text-neutral-900">Ouvrir →</div>
  </Link>
);

export default function IndexTest() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Index tests</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Pages de test “stables” pour vérifier rapidement le site après chaque modif.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardLink
          to="/admintest"
          title="AdminTest"
          desc="Diagnostics Supabase + checks DB (formats/justifs/options)."
        />
        <CardLink
          to="/organisateurtest"
          title="OrganisateurTest"
          desc="Charge une course + formats + compteurs, tests côté orga."
        />
        <CardLink
          to="/clienttest"
          title="ClientTest"
          desc="Flux client : sélection course/format + bloc justificatifs minimal."
        />
      </div>

      <div className="mt-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50 transition"
        >
          ← Retour accueil
        </Link>
      </div>
    </div>
  );
}

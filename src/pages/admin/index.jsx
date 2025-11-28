// src/pages/admin/index.jsx
import React from "react";
import { Link, Navigate } from "react-router-dom";
import useIsAdmin from "../../hooks/useIsAdmin";

export default function AdminHome() {
  const { isAdmin, loading } = useIsAdmin();

  if (loading) return <div className="p-6">Chargement...</div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Espace Administrateur</h1>
      <p className="text-gray-600 mb-6">
        Bienvenue dans l’interface d’administration. Sélectionnez une section ci-dessous :
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Link
          to="/admin/courses"
          className="p-4 rounded-xl border shadow-sm hover:shadow-md bg-white"
        >
          <h2 className="text-lg font-semibold">Courses</h2>
          <p className="text-sm text-gray-500">Gestion des courses et formats</p>
        </Link>

        <Link
          to="/admin/inscriptions"
          className="p-4 rounded-xl border shadow-sm hover:shadow-md bg-white"
        >
          <h2 className="text-lg font-semibold">Inscriptions</h2>
          <p className="text-sm text-gray-500">Liste et gestion des coureurs</p>
        </Link>

        <Link
          to="/admin/payouts"
          className="p-4 rounded-xl border shadow-sm hover:shadow-md bg-white"
        >
          <h2 className="text-lg font-semibold">Reversements</h2>
          <p className="text-sm text-gray-500">Paiements vers les organisateurs</p>
        </Link>

        <Link
          to="/admin/dashboard"
          className="p-4 rounded-xl border shadow-sm hover:shadow-md bg-white"
        >
          <h2 className="text-lg font-semibold">Dashboard</h2>
          <p className="text-sm text-gray-500">Vue globale des statistiques</p>
        </Link>

        <Link
          to="/admin/categories"
          className="p-4 rounded-xl border shadow-sm hover:shadow-md bg-white"
        >
          <h2 className="text-lg font-semibold">Catégories d&apos;âge</h2>
          <p className="text-sm text-gray-500">
            Gestion des catégories par fédération (FFA, cyclisme, etc.)
          </p>
        </Link>
      </div>
    </div>
  );
}

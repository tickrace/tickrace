// src/components/Navbar.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

export default function Navbar() {
  const navigate = useNavigate();
  const { session, roles, loading } = useUser();

  const handleLogout = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      console.warn("Aucune session à déconnecter.");
      navigate("/");
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Erreur de déconnexion :", error.message);
    } else {
      navigate("/");
    }
  };

  if (loading) {
    return (
      <nav className="bg-gray-800 text-white p-4">
        Chargement...
      </nav>
    );
  }

  return (
    <nav className="bg-gray-800 text-white p-4 flex flex-wrap gap-4 items-center">
      <Link to="/" className="hover:underline">Accueil</Link>
      <Link to="/courses" className="hover:underline">Épreuves</Link>

      {roles.includes("organisateur") && (
        <>
          <Link to="/organisateur/mon-espace" className="hover:underline">Mon espace organisateur</Link>
          <Link to="/organisateur/nouvelle-course" className="hover:underline">+ Nouvelle course</Link>
          <Link to="/monprofilorganisateur" className="hover:underline">Mon profil</Link>
        </>
      )}

      {roles.includes("coureur") && (
        <Link to="/monprofilcoureur" className="hover:underline">Mon profil coureur</Link>
      )}

      {roles.includes("admin") && (
        <Link to="/admin" className="hover:underline">Admin</Link>
      )}

      {!session ? (
        <>
          <Link to="/login" className="hover:underline">Connexion</Link>
          <Link to="/signup" className="hover:underline">Créer un compte</Link>
        </>
      ) : (
        <button onClick={handleLogout} className="hover:underline">Se déconnecter</button>
      )}
    </nav>
  );
}

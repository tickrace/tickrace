// src/components/Navbar.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import { supabase } from "../supabase";

export default function Navbar() {
  const { user, role } = useUser();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <nav className="bg-gray-800 text-white p-4 flex flex-wrap gap-4">
      <Link to="/" className="hover:underline">Accueil</Link>
      <Link to="/courses" className="hover:underline">Épreuves</Link>

      {role === "organisateur" && (
        <>
          <Link to="/organisateur/nouvelle-course" className="hover:underline">+ Nouvelle course</Link>
          <Link to="/organisateur/espace" className="hover:underline">Espace Organisateur</Link>
        </>
      )}

      {role === "coureur" && (
        <Link to="/coureur" className="hover:underline">Profil Coureur</Link>
      )}

      {role === "admin" && (
        <Link to="/admin" className="hover:underline">Admin</Link>
      )}

      {!user && (
        <>
          <Link to="/organisateur/login" className="hover:underline">Connexion</Link>
          <Link to="/organisateur/signup" className="hover:underline">Créer un compte</Link>
        </>
      )}

      {user && (
        <button
          onClick={handleLogout}
          className="ml-auto text-sm bg-red-500 hover:bg-red-600 px-3 py-1 rounded"
        >
          Se déconnecter
        </button>
      )}
    </nav>
  );
}

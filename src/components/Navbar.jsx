// src/components/Navbar.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

export default function Navbar() {
  const navigate = useNavigate();
  const { session, roles } = useUser();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <nav className="bg-gray-800 text-white p-4 flex flex-wrap gap-4">
      <Link to="/" className="hover:underline">Accueil</Link>
      <Link to="/courses" className="hover:underline">Épreuves</Link>

      {roles.includes("organisateur") && (
        <>
          <Link to="/organisateur/nouvelle-course" className="hover:underline">+ Nouvelle course</Link>
          <Link to="/organisateur/espace" className="hover:underline">Espace Organisateur</Link>
          <Link to="/monprofilorganisateur" className="hover:underline">Mon profil organisateur</Link>
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

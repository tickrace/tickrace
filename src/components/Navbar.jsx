import React from "react";
import { Link } from "react-router-dom";
import { useUserContext } from "../UserContext";

export default function Navbar() {
  const { user, logout, roles } = useUserContext();

  return (
    <nav className="bg-gray-800 text-white p-4 flex flex-wrap gap-4">
      <Link to="/" className="hover:underline">Accueil</Link>
      <Link to="/courses" className="hover:underline">Épreuves</Link>

      {roles.includes("organisateur") && (
        <>
          <Link to="/organisateur/nouvelle-course" className="hover:underline">+ Nouvelle course</Link>
          <Link to="/organisateur/espace" className="hover:underline">Espace Organisateur</Link>
        </>
      )}

      {roles.includes("coureur") && (
        <>
          <Link to="/profil" className="hover:underline">Mon profil</Link>
        </>
      )}

      {roles.includes("admin") && (
        <Link to="/admin" className="hover:underline">Admin</Link>
      )}

      {!user ? (
        <>
          <Link to="/login" className="hover:underline">Connexion</Link>
          <Link to="/signup" className="hover:underline">Créer un compte</Link>
        </>
      ) : (
        <button onClick={logout} className="hover:underline">Se déconnecter</button>
      )}
    </nav>
  );
}

import React from "react";
import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="bg-gray-800 text-white p-4 flex flex-wrap gap-4">
      <Link to="/" className="hover:underline">Accueil</Link>
      <Link to="/courses" className="hover:underline">Épreuves</Link>
      <Link to="/organisateur/nouvelle-course" className="hover:underline">+ Nouvelle course</Link>
      <Link to="/organisateur/espace" className="hover:underline">Espace Organisateur</Link>
      <Link to="/organisateur/login" className="hover:underline">Connexion</Link>
      <Link to="/organisateur/signup" className="hover:underline">Créer un compte</Link>
      <Link to="/formats" className="hover:underline">Formats</Link>
      <Link to="/coureur" className="hover:underline">Coureur</Link>
      <Link to="/profil" className="hover:underline">Mon profil</Link> {/* ✅ Lien ajouté */}
      <Link to="/admin" className="hover:underline">Admin</Link>
    </nav>
  );
}

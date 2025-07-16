
import React from "react";
import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="bg-gray-800 text-white p-4 flex gap-4">
      <Link to="/" className="hover:underline">Accueil</Link>
      <Link to="/courses" className="hover:underline">Épreuves</Link>
      <Link to="/organisateur" className="hover:underline">+ Nouvelle course</Link>
<Link to="/organisateur/login" className="hover:underline">Connexion</Link>
<Link to="/organisateur/espace" className="hover:underline">Mon espace</Link>
<Link to="/organisateur/signup" className="hover:underline">Créer un compte</Link>


    </nav>
  );
}

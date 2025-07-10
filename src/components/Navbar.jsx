import React from "react";
import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="bg-gray-800 text-white p-4 flex gap-4">
      <Link to="/" className="hover:underline">Accueil</Link>
      <Link to="/courses" className="hover:underline">Épreuves</Link>
      <Link to="/organisateur/nouvelle-course" className="hover:underline">+ Nouvelle course</Link>
      <Link to="/organisateur" className="hover:underline">Organisateur</Link>
      <Link to="/espaceorganisateur" className="hover:underline">Mon espace organisateur</Link>
      <Link to="/coureur" className="hover:underline">Coureur</Link>
      <Link to="/admin" className="hover:underline">Admin</Link>
    </nav>
  );
}

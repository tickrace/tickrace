import React from "react";
import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="bg-black text-white p-4 flex gap-4">
      <Link to="/">Accueil</Link>
      <Link to="/courses">Épreuves</Link>
      <Link to="/organisateur">Organisateur</Link>
      <Link to="/coureur">Coureur</Link>
      <Link to="/admin">Admin</Link>
    </nav>
  );
}

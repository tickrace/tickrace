import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserContext } from "../contexts/UserContext";
import { supabase } from "../supabase";

export default function Navbar() {
  const { user, setUser } = useContext(UserContext);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate("/login");
  };

  return (
    <nav className="bg-gray-800 text-white p-4 flex flex-wrap gap-4">
      <Link to="/" className="hover:underline">Accueil</Link>
      <Link to="/courses" className="hover:underline">Épreuves</Link>
      <Link to="/organisateur/nouvelle-course" className="hover:underline">+ Nouvelle course</Link>
      <Link to="/organisateur/espace" className="hover:underline">Espace Organisateur</Link>
      <Link to="/formats" className="hover:underline">Formats</Link>
      <Link to="/coureur" className="hover:underline">Coureur</Link>
      <Link to="/admin" className="hover:underline">Admin</Link>
      <Link to="/coureur/profil" className="hover:underline">Profil</Link>

      {!user ? (
        <>
          <Link to="/login" className="hover:underline">Connexion</Link>
          <Link to="/signup" className="hover:underline">Créer un compte</Link>
        </>
      ) : (
        <button
          onClick={handleLogout}
          className="hover:underline text-red-300"
        >
          Se déconnecter
        </button>
      )}
    </nav>
  );
}

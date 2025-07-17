import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { UserContext } from "../contexts/UserContext";

export default function Navbar() {
  const { user, roles, setUser, setRoles } = useContext(UserContext);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRoles([]);
    navigate("/");
  };

  return (
    <nav className="bg-gray-800 text-white p-4 flex flex-wrap gap-4">
      <Link to="/" className="hover:underline">Accueil</Link>
      <Link to="/courses" className="hover:underline">Épreuves</Link>

      {!user && (
        <>
          <Link to="/login" className="hover:underline">Connexion</Link>
          <Link to="/signup" className="hover:underline">Créer un compte</Link>
        </>
      )}

      {user && roles.includes("coureur") && (
        <Link to="/mon-profil-coureur" className="hover:underline">Mon profil coureur</Link>
      )}

      {user && roles.includes("organisateur") && (
        <>
          <Link to="/mon-profil-organisateur" className="hover:underline">Mon profil organisateur</Link>
          <Link to="/organisateur/nouvelle-course" className="hover:underline">+ Nouvelle course</Link>
          <Link to="/organisateur/espace" className="hover:underline">Espace Organisateur</Link>
        </>
      )}

      {user && roles.includes("admin") && (
        <Link to="/admin" className="hover:underline">Admin</Link>
      )}

      {user && (
        <button onClick={handleLogout} className="hover:underline text-red-400 ml-auto">
          Se déconnecter
        </button>
      )}
    </nav>
  );
}

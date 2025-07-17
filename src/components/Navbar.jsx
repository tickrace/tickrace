import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { UserContext } from "../contexts/UserContext";

export default function Navbar() {
  const { user, setUser } = useContext(UserContext);
  const navigate = useNavigate();

  const role = user?.session?.user?.user_metadata?.role;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate("/");
  };

  return (
    <nav className="bg-gray-800 text-white p-4 flex flex-wrap gap-4">
      <Link to="/" className="hover:underline">Accueil</Link>
      <Link to="/courses" className="hover:underline">Épreuves</Link>

      {role === "organisateur" && (
        <>
          <Link to="/organisateur/espace" className="hover:underline">Espace Organisateur</Link>
          <Link to="/monprofilorganisateur" className="hover:underline">Mon Profil Organisateur</Link>
        </>
      )}

      {role === "coureur" && (
        <>
          <Link to="/monprofilcoureur" className="hover:underline">Mon Profil Coureur</Link>
        </>
      )}

      {role === "admin" && (
        <Link to="/admin" className="hover:underline">Admin</Link>
      )}

      {!user && (
        <>
          <Link to="/login" className="hover:underline">Connexion</Link>
          <Link to="/signup" className="hover:underline">Créer un compte</Link>
        </>
      )}

      {user && (
        <button
          onClick={handleLogout}
          className="hover:underline text-red-300 ml-auto"
        >
          Se déconnecter
        </button>
      )}
    </nav>
  );
}

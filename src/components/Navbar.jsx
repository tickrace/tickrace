import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };

    fetchUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate("/"); // redirection vers l'accueil
  };

  return (
    <nav className="bg-gray-800 text-white p-4 flex flex-wrap gap-4">
      <Link to="/" className="hover:underline">Accueil</Link>
      <Link to="/courses" className="hover:underline">Épreuves</Link>
      <Link to="/organisateur/nouvelle-course" className="hover:underline">+ Nouvelle course</Link>
      <Link to="/organisateur/espace" className="hover:underline">Espace Organisateur</Link>

      {!user && (
        <>
          <Link to="/organisateur/login" className="hover:underline">Connexion</Link>
          <Link to="/organisateur/signup" className="hover:underline">Créer un compte</Link>
        </>
      )}

      <Link to="/formats" className="hover:underline">Formats</Link>
      <Link to="/coureur" className="hover:underline">Coureur</Link>

      {user && (
        <>
          <Link to="/profil" className="hover:underline">Mon profil</Link>
          <button onClick={handleLogout} className="hover:underline">Se déconnecter</button>
        </>
      )}

      <Link to="/admin" className="hover:underline">Admin</Link>
    </nav>
  );
}

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";

export default function Navbar() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };

    fetchUser();
  }, []);

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
      {user && (
        <Link to="/profil" className="hover:underline">Mon profil</Link>
      )}
      <Link to="/admin" className="hover:underline">Admin</Link>
    </nav>
  );
}

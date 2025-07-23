import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

export default function Navbar() {
  const navigate = useNavigate();
  const { session, currentRole, switchRole } = useUser();
  const [showRoleSelector, setShowRoleSelector] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleRoleChange = (e) => {
    const newRole = e.target.value;
    if (newRole) switchRole(newRole);
  };

  return (
    <nav className="bg-gray-800 text-white px-4 py-3 flex justify-between items-center">
      <div className="flex gap-4">
        <Link to="/" className="hover:underline">Accueil</Link>
        {session && currentRole === "coureur" && (
          <>
            <Link to="/monprofilcoureur" className="hover:underline">Mon Profil</Link>
          </>
        )}
        {session && currentRole === "organisateur" && (
          <>
            <Link to="/organisateur/mon-espace" className="hover:underline">Espace Organisateur</Link>
            <Link to="/organisateur/nouvelle-course" className="hover:underline">Nouvelle Course</Link>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        {session ? (
          <>
            {currentRole ? (
              <span className="text-sm bg-green-700 px-2 py-1 rounded">Rôle : {currentRole}</span>
            ) : (
              <>
                <select
                  onChange={handleRoleChange}
                  defaultValue=""
                  className="text-black text-sm px-2 py-1 rounded"
                >
                  <option value="">Choisir un rôle</option>
                  <option value="coureur">Coureur</option>
                  <option value="organisateur">Organisateur</option>
                </select>
              </>
            )}
            <button
              onClick={handleLogout}
              className="bg-red-600 px-3 py-1 rounded hover:bg-red-700"
            >
              Déconnexion
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="hover:underline">Connexion</Link>
            <Link to="/signup" className="hover:underline">Inscription</Link>
          </>
        )}
      </div>
    </nav>
  );
}

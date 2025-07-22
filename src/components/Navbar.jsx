// src/components/Navbar.jsx
import React, { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserContext } from "../contexts/UserContext";
import { supabase } from "../supabase";

export default function Navbar() {
  const navigate = useNavigate();
  const { session, profil, availableRoles, currentRole, switchRole, logout } = useContext(UserContext);
  const [openMenu, setOpenMenu] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    navigate("/login");
  };

  return (
    <nav className="bg-gray-800 text-white p-4 flex justify-between items-center">
      <Link to="/" className="text-lg font-bold">Tickrace</Link>

      <div className="flex items-center gap-4">
        {session && profil && (
          <>
            <span>Bonjour {profil.prenom} ({currentRole})</span>

            {availableRoles.length > 1 && (
              <select
                value={currentRole}
                onChange={(e) => switchRole(e.target.value)}
                className="text-black px-2 py-1 rounded"
              >
                {availableRoles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            )}

            {currentRole === "organisateur" && (
              <Link to="/organisateur" className="hover:underline">Espace organisateur</Link>
            )}

            {currentRole === "coureur" && (
              <Link to="/profil" className="hover:underline">Mon profil</Link>
            )}

            <button onClick={handleLogout} className="hover:underline">Déconnexion</button>
          </>
        )}

        {!session && (
          <>
            <Link to="/login" className="hover:underline">Connexion</Link>
            <Link to="/signup" className="hover:underline">Créer un compte</Link>
          </>
        )}
      </div>
    </nav>
  );
}

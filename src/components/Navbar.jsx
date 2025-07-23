// src/components/Navbar.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import { supabase } from "../supabase";

export default function Navbar() {
  const { session, profil, currentRole, switchRole } = useUser();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <nav className="bg-gray-800 text-white px-6 py-4 flex justify-between items-center">
      <Link to="/" className="text-xl font-bold">
        Tickrace
      </Link>

      <div className="flex gap-4 items-center">
        {/* Sélecteur de rôle si plusieurs rôles */}
        {profil?.length > 1 && (
          <select
            value={currentRole}
            onChange={(e) => switchRole(e.target.value)}
            className="bg-gray-700 text-white px-2 py-1 rounded"
          >
            {profil.map((p) => (
              <option key={p.role} value={p.role}>
                {p.role}
              </option>
            ))}
          </select>
        )}

        {/* Liens selon le rôle */}
        {session && currentRole === "organisateur" && (
          <>
            <Link to="/organisateur/mon-espace" className="hover:underline">
              Mon espace
            </Link>
            <Link to="/organisateur/nouvelle-course" className="hover:underline">
              Nouvelle épreuve
            </Link>
            <button onClick={handleLogout} className="hover:underline">
              Déconnexion
            </button>
          </>
        )}

        {session && currentRole === "coureur" && (
          <>
            <Link to="/monprofilcoureur" className="hover:underline">
              Mon profil
            </Link>
            <button onClick={handleLogout} className="hover:underline">
              Déconnexion
            </button>
          </>
        )}

        {!session && (
          <>
            <Link to="/login" className="hover:underline">
              Connexion
            </Link>
            <Link to="/signup" className="hover:underline">
              Inscription
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

// src/components/Navbar.jsx
import React, { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { UserContext } from "../contexts/UserContext";

export default function Navbar() {
  const navigate = useNavigate();
  const { session, profil, currentRole, switchRole } = useContext(UserContext);
  const [roleChoiceVisible, setRoleChoiceVisible] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <nav className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between">
      <Link to="/" className="text-xl font-bold">
        Tickrace
      </Link>

      {session && (
        <div className="flex items-center space-x-4">
          {/* Menu selon le rôle */}
          {currentRole === "coureur" && (
            <>
              <Link to="/monprofilcoureur" className="hover:underline">
                Mon profil coureur
              </Link>
              <Link to="/courses" className="hover:underline">
                Courses
              </Link>
            </>
          )}

          {currentRole === "organisateur" && (
            <>
              <Link to="/organisateur/mon-espace" className="hover:underline">
                Espace organisateur
              </Link>
              <Link to="/organisateur/nouvelle-course" className="hover:underline">
                Nouvelle épreuve
              </Link>
            </>
          )}

          {/* Sélecteur de rôle visible même si currentRole défini */}
          {profil && (
            <select
              value={currentRole || ""}
              onChange={(e) => switchRole(e.target.value)}
              className="text-black px-2 py-1 rounded"
            >
              <option value="">Choisir un rôle</option>
              {[...new Set(profil.map((p) => p.role))].map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleLogout}
            className="bg-red-600 px-3 py-1 rounded hover:bg-red-700"
          >
            Déconnexion
          </button>
        </div>
      )}

      {!session && (
        <div className="space-x-3">
          <Link to="/login" className="hover:underline">
            Connexion
          </Link>
          <Link to="/signup" className="hover:underline">
            Inscription
          </Link>
        </div>
      )}
    </nav>
  );
}

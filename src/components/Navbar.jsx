// src/components/Navbar.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";

export default function Navbar() {
  const navigate = useNavigate();
  const { session, profil, currentRole, switchRole } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <nav className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
      <Link to="/" className="text-xl font-bold">
        Tickrace
      </Link>

      <div className="hidden md:flex items-center gap-4">
        {session && currentRole === "coureur" && (
          <>
            <Link to="/courses" className="hover:underline">
              Épreuves
            </Link>
            <Link to="/mon-profil" className="hover:underline">
              Mon Profil
            </Link>
          </>
        )}

        {session && currentRole === "organisateur" && (
          <>
            <Link to="/organisateur" className="hover:underline">
              Mon espace organisateur
            </Link>
          </>
        )}

        {session && profil && profil.length > 1 && (
          <select
            value={currentRole}
            onChange={(e) => switchRole(e.target.value)}
            className="bg-gray-800 text-white border border-gray-600 px-2 py-1 rounded"
          >
            {profil.map((p) => (
              <option key={p.role} value={p.role}>
                {p.role}
              </option>
            ))}
          </select>
        )}

        {session ? (
          <button onClick={handleLogout} className="bg-red-600 px-3 py-1 rounded hover:bg-red-700">
            Déconnexion
          </button>
        ) : (
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

      {/* Menu mobile */}
      <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
        ☰
      </button>
      {menuOpen && (
        <div className="absolute top-14 right-4 bg-gray-800 border border-gray-600 rounded-md p-4 flex flex-col gap-2 md:hidden">
          {session && currentRole === "coureur" && (
            <>
              <Link to="/courses" onClick={() => setMenuOpen(false)}>
                Épreuves
              </Link>
              <Link to="/mon-profil" onClick={() => setMenuOpen(false)}>
                Mon Profil
              </Link>
            </>
          )}
          {session && currentRole === "organisateur" && (
            <>
              <Link to="/organisateur" onClick={() => setMenuOpen(false)}>
                Mon espace organisateur
              </Link>
            </>
          )}
          {session && profil && profil.length > 1 && (
            <select
              value={currentRole}
              onChange={(e) => switchRole(e.target.value)}
              className="bg-gray-700 text-white border border-gray-600 px-2 py-1 rounded"
            >
              {profil.map((p) => (
                <option key={p.role} value={p.role}>
                  {p.role}
                </option>
              ))}
            </select>
          )}
          {session ? (
            <button onClick={handleLogout} className="bg-red-600 px-3 py-1 rounded hover:bg-red-700">
              Déconnexion
            </button>
          ) : (
            <>
              <Link to="/login" onClick={() => setMenuOpen(false)}>
                Connexion
              </Link>
              <Link to="/signup" onClick={() => setMenuOpen(false)}>
                Inscription
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}

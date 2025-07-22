// src/components/Navbar.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import { supabase } from "../supabase";

export default function Navbar() {
  const { session, roles, activeRole, setActiveRole, nom, prenom } = useUser();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleRoleChange = (e) => {
    setActiveRole(e.target.value);
  };

  return (
    <nav className="bg-gray-800 text-white p-4 flex justify-between items-center">
      <Link to="/" className="text-lg font-bold">Tickrace</Link>

      <div className="flex items-center gap-4">
        {session ? (
          <>
            <span className="hidden sm:block">{prenom} {nom}</span>

            {roles.length > 1 && (
              <select
                value={activeRole}
                onChange={handleRoleChange}
                className="bg-gray-700 text-white px-2 py-1 rounded"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            )}

            {activeRole === "organisateur" && (
              <Link to="/organisateur/mon-espace" className="hover:underline">Mon espace</Link>
            )}
            {activeRole === "coureur" && (
              <Link to="/profil" className="hover:underline">Mon profil</Link>
            )}
            {activeRole === "admin" && (
              <Link to="/admin/dashboard" className="hover:underline">Admin</Link>
            )}
            {activeRole === "benevole" && (
              <Link to="/benevole/mes-missions" className="hover:underline">Bénévole</Link>
            )}

            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded"
            >
              Déconnexion
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="hover:underline">Connexion</Link>
            <Link to="/signup" className="hover:underline">Créer un compte</Link>
          </>
        )}
      </div>
    </nav>
  );
}

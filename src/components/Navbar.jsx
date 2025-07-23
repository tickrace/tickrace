import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import toast from "react-hot-toast";

export default function Navbar() {
  const navigate = useNavigate();
  const { session, profil, currentRole, switchRole } = useUser();
  const [menuVisible, setMenuVisible] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnexion réussie");
    navigate("/login");
  };

  const handleChangeRole = (e) => {
    const newRole = e.target.value;
    switchRole(newRole);
    toast.success(`Rôle changé : ${newRole}`);
  };

  return (
    <nav className="bg-black text-white px-4 py-2 flex justify-between items-center">
      <Link to="/" className="font-bold text-xl">
        Tickrace
      </Link>

      {session && (
        <div className="flex items-center space-x-4">
          {/* Sélecteur de rôle */}
          {profil && (profil.length > 1 || currentRole === null) && (
            <select
              value={currentRole || ""}
              onChange={handleChangeRole}
              className="text-black px-2 py-1 rounded"
            >
              <option value="">Sélectionner un rôle</option>
              {profil.map((p) => (
                <option key={p.role} value={p.role}>
                  {p.role}
                </option>
              ))}
            </select>
          )}

          {/* Menu selon le rôle */}
          {currentRole === "coureur" && (
            <>
              <Link to="/monprofilcoureur">Mon Profil Coureur</Link>
            </>
          )}
          {currentRole === "organisateur" && (
            <>
              <Link to="/organisateur/mon-espace">Espace Organisateur</Link>
              <Link to="/organisateur/nouvelle-course">Nouvelle Course</Link>
            </>
          )}
          {currentRole === "admin" && (
            <>
              <Link to="/admin">Admin</Link>
            </>
          )}

          {/* Déconnexion */}
          <button onClick={handleLogout} className="bg-red-500 px-3 py-1 rounded">
            Déconnexion
          </button>
        </div>
      )}

      {!session && (
        <div className="space-x-4">
          <Link to="/login">Connexion</Link>
          <Link to="/signup">Inscription</Link>
        </div>
      )}
    </nav>
  );
}

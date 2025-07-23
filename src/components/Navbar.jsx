// src/components/Navbar.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import toast from "react-hot-toast";

export default function Navbar() {
  const navigate = useNavigate();
  const { session, profil, currentRole, switchRole } = useUser();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleRoleSelect = (e) => {
    const selectedRole = e.target.value;
    switchRole(selectedRole);
    toast.success(`Rôle sélectionné : ${selectedRole}`);
  };

  return (
    <nav style={{ padding: "10px", borderBottom: "1px solid #ccc" }}>
      <Link to="/" style={{ marginRight: "15px" }}>🏃 Tickrace</Link>

      {currentRole === "organisateur" && (
        <>
          <Link to="/organisateur/mon-espace" style={{ marginRight: "10px" }}>Mon espace organisateur</Link>
          <Link to="/organisateur/nouvelle-course" style={{ marginRight: "10px" }}>Nouvelle course</Link>
        </>
      )}

      {currentRole === "coureur" && (
        <>
          <Link to="/monprofilcoureur" style={{ marginRight: "10px" }}>Mon profil coureur</Link>
        </>
      )}

      {/* Si profil existe mais aucun rôle défini */}
      {profil && !currentRole && (
        <select onChange={handleRoleSelect} defaultValue="">
          <option value="" disabled>Choisir un rôle</option>
          {profil.map((p) => (
            <option key={p.role} value={p.role}>
              {p.role}
            </option>
          ))}
        </select>
      )}

      {session && (
        <button onClick={handleLogout} style={{ float: "right" }}>
          Déconnexion
        </button>
      )}
    </nav>
  );
}

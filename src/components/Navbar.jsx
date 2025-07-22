// src/components/Navbar.jsx
import React from "react";
import { Link } from "react-router-dom";
import { useUser } from "../contexts/UserContext";

export default function Navbar() {
  const { session, profil, currentRole, switchRole } = useUser();

  const roles = profil?.map((p) => p.role);

  return (
    <nav className="bg-gray-900 text-white px-4 py-2 flex justify-between items-center">
      <div className="flex space-x-4">
        <Link to="/" className="font-bold text-xl">Tickrace</Link>

        {currentRole === "coureur" && (
          <>
            <Link to="/courses">Courses</Link>
            <Link to="/mon-profil">Mon Profil</Link>
          </>
        )}

        {currentRole === "organisateur" && (
          <>
            <Link to="/organisateur">Espace Organisateur</Link>
            <Link to="/nouvelle-course">Nouvelle course</Link>
          </>
        )}

        {currentRole === "admin" && (
          <>
            <Link to="/admin">Admin</Link>
          </>
        )}
      </div>

      {session && (
        <div className="flex items-center space-x-4">
          {roles?.length > 1 && (
            <select
              value={currentRole}
              onChange={(e) => switchRole(e.target.value)}
              className="text-black rounded p-1"
            >
              {roles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          )}

          <span>{session.user.email}</span>
          <Link to="/logout" className="text-red-400 hover:underline">Déconnexion</Link>
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

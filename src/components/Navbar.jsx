// src/components/Navbar.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import toast from "react-hot-toast";

export default function Navbar() {
  const { session, currentRole, roles, changeRole, logout } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleRoleChange = async (e) => {
    const newRole = e.target.value;
    await changeRole(newRole);
    toast.success(`Rôle changé : ${newRole}`);
    navigate("/"); // recharge une page adaptée si nécessaire
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <nav className="bg-white shadow-md p-4 flex flex-col md:flex-row justify-between items-center">
      <div className="flex justify-between w-full md:w-auto items-center">
        <Link to="/" className="text-xl font-bold text-blue-600">
          Tickrace
        </Link>
        <button
          className="md:hidden text-gray-600"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          ☰
        </button>
      </div>

      <div
        className={`${
          menuOpen ? "block" : "hidden"
        } md:flex flex-col md:flex-row items-center w-full md:w-auto mt-2 md:mt-0`}
      >
        <Link to="/courses" className="md:mx-2 my-1 md:my-0">
          Épreuves
        </Link>

        {session && currentRole === "coureur" && (
          <>
            <Link to="/monprofilcoureur" className="md:mx-2 my-1 md:my-0">
              Mon profil coureur
            </Link>
          </>
        )}

        {session && currentRole === "organisateur" && (
          <>
            <Link to="/organisateur/mon-espace" className="md:mx-2 my-1 md:my-0">
              Mon espace organisateur
            </Link>
            <Link to="/organisateur/nouvelle-course" className="md:mx-2 my-1 md:my-0">
              Nouvelle course
            </Link>
          </>
        )}

        {session && (
          <>
            {roles.length > 1 && (
              <select
                value={currentRole || ""}
                onChange={handleRoleChange}
                className="md:mx-2 my-1 md:my-0 border px-2 py-1 rounded"
              >
                <option value="" disabled>
                  Sélectionner un rôle
                </option>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={handleLogout}
              className="md:mx-2 my-1 md:my-0 text-red-600 hover:underline"
            >
              Déconnexion
            </button>
          </>
        )}

        {!session && (
          <>
            <Link to="/login" className="md:mx-2 my-1 md:my-0">
              Connexion
            </Link>
            <Link to="/signup" className="md:mx-2 my-1 md:my-0">
              Inscription
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

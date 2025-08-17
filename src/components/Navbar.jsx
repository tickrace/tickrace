import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import toast from "react-hot-toast";
import { useUser } from "../contexts/UserContext";

export default function Navbar() {
  const { session, currentRole, switchRole } = useUser();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnecté !");
    navigate("/login");
  };

  const handleRoleChange = (e) => {
    const selectedRole = e.target.value;
    switchRole(selectedRole);
  };

  // Avatar lettre (première lettre de l'email)
  const avatarLetter = session?.user?.email
    ? session.user.email.charAt(0).toUpperCase()
    : "?";

  return (
    <nav className="bg-black text-white px-4 py-3 flex items-center justify-between flex-wrap">
      {/* Logo */}
      <Link to="/" className="text-xl font-bold tracking-wide">
        Tickrace
      </Link>

      {/* Bouton hamburger (mobile) */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="lg:hidden text-white focus:outline-none"
      >
        ☰
      </button>

      {/* Menu */}
      <div
        className={`w-full lg:flex lg:items-center lg:w-auto ${
          isMenuOpen ? "block" : "hidden"
        }`}
      >
        <div className="mt-2 lg:mt-0 lg:flex lg:space-x-4">
          {/* Lien commun */}
          <Link
            to="/courses"
            className="block px-3 py-2 hover:bg-gray-800 rounded"
          >
            Courses
          </Link>

          {/* Menu coureur */}
          {session && currentRole === "coureur" && (
            <>
              <Link
                to="/monprofilcoureur"
                className="block px-3 py-2 hover:bg-gray-800 rounded"
              >
                Mon Profil
              </Link>
              <Link
                to="/mesinscriptions"
                className="block px-3 py-2 hover:bg-gray-800 rounded"
              >
                Mes Inscriptions
              </Link>
            </>
          )}

          {/* Menu organisateur */}
          {session && currentRole === "organisateur" && (
            <>
              <Link
                to="/organisateur/mon-espace"
                className="block px-3 py-2 hover:bg-gray-800 rounded"
              >
                Mon espace
              </Link>
              <Link
                to="/organisateur/nouvelle-course"
                className="block px-3 py-2 hover:bg-gray-800 rounded"
              >
                Créer une course
              </Link>
              <Link
                to="/monprofilorganisateur"
                className="block px-3 py-2 hover:bg-gray-800 rounded"
              >
                Mon Profil
              </Link>
            </>
          )}

          {/* Menu admin */}
          {session && currentRole === "admin" && (
            <>
              <Link
                to="/admin"
                className="block px-3 py-2 hover:bg-gray-800 rounded"
              >
                Admin
              </Link>
              <Link
                to="/admin/payouts"
                className="block px-3 py-2 hover:bg-gray-800 rounded"
              >
                Reversements
              </Link>
              <Link
                to="/admin/courses"
                className="block px-3 py-2 hover:bg-gray-800 rounded"
              >
                Courses Admin
              </Link>
            </>
          )}
        </div>

        {/* Section droite : role + email + avatar + auth */}
        <div className="mt-3 lg:mt-0 lg:ml-4 flex flex-col lg:flex-row lg:items-center lg:space-x-4">
          {session && (
            <>
              {/* Sélecteur de rôle */}
              <select
                onChange={handleRoleChange}
                value={currentRole}
                className="text-black px-2 py-1 rounded"
              >
                <option value="coureur">Coureur</option>
                <option value="organisateur">Organisateur</option>
                <option value="admin">Admin</option>
              </select>

              {/* Avatar + email */}
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-full text-white font-bold">
                  {avatarLetter}
                </div>
                <span className="text-gray-300 text-sm truncate max-w-[150px]">
                  {session.user?.email}
                </span>
              </div>
            </>
          )}

          {!session ? (
            <>
              <Link
                to="/login"
                className="block px-3 py-2 hover:bg-gray-800 rounded"
              >
                Connexion
              </Link>
              <Link
                to="/signup"
                className="block px-3 py-2 hover:bg-gray-800 rounded"
              >
                Inscription
              </Link>
            </>
          ) : (
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded"
            >
              Déconnexion
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

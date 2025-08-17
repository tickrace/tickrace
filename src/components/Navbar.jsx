// src/components/Navbar.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import toast from "react-hot-toast";
import { useUser } from "../contexts/UserContext";

export default function Navbar() {
  const { session, currentRole, switchRole, setCurrentRole } = useUser();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isLoggedIn = !!session;
  const isAdmin = !!session?.user?.app_metadata?.roles?.includes?.("admin");

  const setRole = (role) => {
    if (typeof switchRole === "function") switchRole(role);
    else if (typeof setCurrentRole === "function") setCurrentRole(role);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnecté !");
    navigate("/login");
  };

  // Menus par rôle (hors admin)
  const coureurMenu = [
    { to: "/courses", label: "Courses", pub: true },
    { to: "/monprofilcoureur", label: "Mon Profil", priv: true },
    { to: "/mesinscriptions", label: "Mes Inscriptions", priv: true },
  ];

  const organisateurMenu = [
    { to: "/organisateur/mon-espace", label: "Mon espace", priv: true },
    { to: "/organisateur/nouvelle-course", label: "Créer une course", priv: true },
    { to: "/formats", label: "Formats", priv: true },
    { to: "/monprofilorganisateur", label: "Mon Profil", priv: true },
  ];

  const activeMenu = currentRole === "organisateur" ? organisateurMenu : coureurMenu;

  return (
    <nav className="bg-black text-white px-4 py-3 flex items-center justify-between flex-wrap">
      <Link to="/" className="text-xl font-bold tracking-wide">Tickrace</Link>

      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="lg:hidden text-white focus:outline-none"
        aria-label="Ouvrir le menu"
      >
        ☰
      </button>

      <div className={`w-full lg:flex lg:items-center lg:w-auto ${isMenuOpen ? "block" : "hidden"}`}>
        {/* Switch Coureur / Organisateur */}
        {isLoggedIn && (
          <div className="mt-2 lg:mt-0 lg:mr-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRole("coureur")}
              className={`px-3 py-1 rounded ${currentRole === "coureur" ? "bg-white text-black" : "bg-gray-800"}`}
            >
              Coureur
            </button>
            <button
              type="button"
              onClick={() => setRole("organisateur")}
              className={`px-3 py-1 rounded ${currentRole === "organisateur" ? "bg-white text-black" : "bg-gray-800"}`}
            >
              Organisateur
            </button>
          </div>
        )}

        {/* Liens principaux */}
        <div className="mt-2 lg:mt-0 lg:flex lg:space-x-4">
          {/* Lien Courses toujours visible */}
          <Link to="/courses" className="block px-3 py-2 hover:bg-gray-800 rounded">Courses</Link>

          {activeMenu
            .filter(item => (item.pub || (item.priv && isLoggedIn)))
            .map((item) => (
              <Link key={item.to} to={item.to} className="block px-3 py-2 hover:bg-gray-800 rounded">
                {item.label}
              </Link>
            ))}

          {/* Espace Admin (visible uniquement si admin via app_metadata) */}
          {isAdmin && (
            <>
              <Link to="/admin" className="block px-3 py-2 hover:bg-gray-800 rounded">Admin</Link>
              <Link to="/admin/payouts" className="block px-3 py-2 hover:bg-gray-800 rounded">Reversements</Link>
            </>
          )}
        </div>

        {/* Connexion / Déconnexion */}
        <div className="mt-3 lg:mt-0 lg:ml-4 flex flex-col lg:flex-row lg:items-center lg:space-x-4">
          {!isLoggedIn ? (
            <>
              <Link to="/login" className="block px-3 py-2 hover:bg-gray-800 rounded">Connexion</Link>
              <Link to="/signup" className="block px-3 py-2 hover:bg-gray-800 rounded">Inscription</Link>
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

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import toast from "react-hot-toast";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const navigate = useNavigate();
  const { session, profil, currentRole, switchRole } = useUser();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnexion réussie");
    navigate("/login");
  };

  const handleChangeRole = (e) => {
    const newRole = e.target.value;
    switchRole(newRole);
    toast.success(`Rôle changé : ${newRole}`);
    setIsMenuOpen(false); // Fermer le menu mobile après changement
  };

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <nav className="bg-black text-white px-4 py-2 flex items-center justify-between relative">
      <Link to="/" className="text-xl font-bold">
        Tickrace
      </Link>

      {/* Menu Hamburger - Mobile */}
      <button onClick={toggleMenu} className="md:hidden">
        {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Menu principal */}
      <div
        className={`${
          isMenuOpen ? "block" : "hidden"
        } absolute top-full left-0 w-full bg-black text-white md:static md:flex md:items-center md:space-x-4 md:w-auto md:bg-transparent`}
      >
        {session && (
          <div className="flex flex-col md:flex-row md:items-center md:space-x-4 p-4 md:p-0">
            {/* Sélecteur de rôle */}
            {profil && profil.length > 0 && (
              <select
                value={currentRole || ""}
                onChange={handleChangeRole}
                className="text-black px-2 py-1 rounded mb-2 md:mb-0"
              >
                <option value="">Sélectionner un rôle</option>
                {profil.map((p) => (
                  <option key={p.role} value={p.role}>
                    {p.role}
                  </option>
                ))}
              </select>
            )}

            {/* Menu dynamique selon rôle */}
            {currentRole === "coureur" && (
              <Link to="/monprofilcoureur" onClick={() => setIsMenuOpen(false)}>
                Mon Profil Coureur
              </Link>
            )}

            {currentRole === "organisateur" && (
              <>
                <Link to="/organisateur/mon-espace" onClick={() => setIsMenuOpen(false)}>
                  Espace Organisateur
                </Link>
                <Link to="/organisateur/nouvelle-course" onClick={() => setIsMenuOpen(false)}>
                  Nouvelle Course
                </Link>
              </>
            )}

            {currentRole === "admin" && (
              <Link to="/admin" onClick={() => setIsMenuOpen(false)}>
                Admin
              </Link>
            )}

            {/* Déconnexion */}
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-3 py-1 rounded mt-2 md:mt-0"
            >
              Déconnexion
            </button>
          </div>
        )}

        {!session && (
          <div className="flex flex-col md:flex-row md:items-center md:space-x-4 p-4 md:p-0">
            <Link to="/login" onClick={() => setIsMenuOpen(false)}>
              Connexion
            </Link>
            <Link to="/signup" onClick={() => setIsMenuOpen(false)}>
              Inscription
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}

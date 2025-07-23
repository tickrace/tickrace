import React, { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import toast from "react-hot-toast";
import { useUser } from "../contexts/UserContext";

export default function Navbar() {
  const { session, currentRole, switchRole } = useContext(useUser);
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnecté !");
    navigate("/login");
  };

  const handleRoleChange = (e) => {
    switchRole(e.target.value);
  };

  return (
    <nav className="bg-black text-white px-4 py-3 flex items-center justify-between flex-wrap">
      <Link to="/" className="text-xl font-bold tracking-wide">Tickrace</Link>

      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="lg:hidden text-white focus:outline-none"
      >
        ☰
      </button>

      <div className={`w-full lg:flex lg:items-center lg:w-auto ${isMenuOpen ? "block" : "hidden"}`}>
        <div className="mt-2 lg:mt-0 lg:flex lg:space-x-4">
          <Link to="/courses" className="block px-3 py-2 hover:bg-gray-800 rounded">Courses</Link>

          {session && currentRole === "coureur" && (
            <Link to="/monprofilcoureur" className="block px-3 py-2 hover:bg-gray-800 rounded">Mon Profil</Link>
          )}

          {session && currentRole === "organisateur" && (
            <>
              <Link to="/organisateur/mon-espace" className="block px-3 py-2 hover:bg-gray-800 rounded">Mon espace</Link>
              <Link to="/organisateur/nouvelle-course" className="block px-3 py-2 hover:bg-gray-800 rounded">Créer une course</Link>
            </>
          )}
        </div>

        <div className="mt-3 lg:mt-0 lg:ml-4 flex flex-col lg:flex-row lg:items-center lg:space-x-4">
          <select
            onChange={handleRoleChange}
            value={currentRole || ""}
            className="text-black px-2 py-1 rounded"
          >
            <option value="">Sélectionner un rôle</option>
            <option value="coureur">Coureur</option>
            <option value="organisateur">Organisateur</option>
          </select>

          {!session ? (
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

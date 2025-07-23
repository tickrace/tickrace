// src/components/Navbar.jsx
import React, { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import toast from "react-hot-toast";
import { UserContext } from "../contexts/UserContext";

export default function Navbar() {
  const { session, currentRole, setCurrentRole, profil } = useContext(UserContext);
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnecté !");
    navigate("/login");
  };

  const handleRoleChange = async (e) => {
    const selectedRole = e.target.value;
    setCurrentRole(selectedRole);

    const { error } = await supabase
      .from("profils_utilisateurs")
      .update({ role: selectedRole })
      .eq("user_id", session.user.id)
      .eq("role", selectedRole);

    if (error) {
      toast.error("Erreur lors du changement de rôle");
      console.error(error);
    } else {
      toast.success(`Rôle changé : ${selectedRole}`);
    }
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

          {session && currentRole === "admin" && (
            <Link to="/admin" className="block px-3 py-2 hover:bg-gray-800 rounded">Admin</Link>
          )}
        </div>

        <div className="mt-3 lg:mt-0 lg:ml-4 flex flex-col lg:flex-row lg:items-center lg:space-x-4">
          {session && profil && profil.length > 1 && (
            <select
              onChange={handleRoleChange}
              value={currentRole || ""}
              className="text-black px-2 py-1 rounded"
            >
              {profil.map(({ role }) => (
                <option key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </option>
              ))}
            </select>
          )}

          {!session ? (
            <>
              <Link to="/login" className="block px-3 py-2 hover:bg-gray-800 rounded">Connexion</Link>
              <Link to="/signup" className="block px-3 py-2 hover:bg-gray-800 rounded">Inscription</Link>
            </>
          ) : (
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded mt-2 lg:mt-0"
            >
              Déconnexion
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

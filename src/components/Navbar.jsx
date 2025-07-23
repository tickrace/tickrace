import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { UserContext } from "../contexts/UserContext";
import toast from "react-hot-toast";

export default function Navbar() {
  const { session, currentRole, setCurrentRole, profils, setProfils } = useContext(UserContext);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleRoleChange = async (e) => {
    const newRole = e.target.value;

    if (!session || !session.user) return;

    const { error } = await supabase
      .from("profils_utilisateurs")
      .upsert({ user_id: session.user.id, role: newRole })
      .eq("user_id", session.user.id);

    if (error) {
      toast.error("Erreur lors de la mise à jour du rôle.");
      return;
    }

    setCurrentRole(newRole);
    toast.success(`Rôle défini : ${newRole}`);
  };

  return (
    <nav className="bg-gray-900 text-white p-4 flex items-center justify-between">
      <Link to="/" className="text-xl font-bold">
        Tickrace
      </Link>

      {session && (
        <div className="flex items-center space-x-4">
          {/* Menu dynamique en fonction du rôle */}
          {currentRole === "coureur" && (
            <>
              <Link to="/monprofilcoureur">Mon profil coureur</Link>
              <Link to="/courses">Courses</Link>
            </>
          )}

          {currentRole === "organisateur" && (
            <>
              <Link to="/monprofilorganisateur">Mon profil organisateur</Link>
              <Link to="/organisateur/mon-espace">Mes épreuves</Link>
            </>
          )}

          {currentRole === "admin" && (
            <>
              <Link to="/admin">Admin</Link>
            </>
          )}

          {/* Sélecteur si le rôle est NULL */}
          {currentRole === null && (
            <select
              onChange={handleRoleChange}
              defaultValue=""
              className="bg-white text-black rounded px-2 py-1"
            >
              <option value="" disabled>
                Choisir un rôle
              </option>
              <option value="coureur">Coureur</option>
              <option value="organisateur">Organisateur</option>
            </select>
          )}

          {/* Sélecteur de rôle même après définition */}
          {currentRole && (
            <select
              value={currentRole}
              onChange={handleRoleChange}
              className="bg-white text-black rounded px-2 py-1"
            >
              <option value="coureur">Coureur</option>
              <option value="organisateur">Organisateur</option>
              <option value="admin">Admin</option>
            </select>
          )}

          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded"
          >
            Déconnexion
          </button>
        </div>
      )}
    </nav>
  );
}

// src/components/Navbar.jsx
import React, { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { UserContext } from "../contexts/UserContext";
import toast from "react-hot-toast";

export default function Navbar() {
  const { session, currentRole, setCurrentRole, roles, setRoles } = useContext(UserContext);
  const [availableRoles, setAvailableRoles] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (session) {
      fetchRoles();
    }
  }, [session]);

  const fetchRoles = async () => {
    const { data, error } = await supabase
      .from("profils_utilisateurs")
      .select("role")
      .eq("user_id", session.user.id);

    if (data) {
      const roleList = data.map((r) => r.role);
      setRoles(roleList);
      setAvailableRoles(roleList);
      if (!currentRole && roleList.length > 0) setCurrentRole(roleList[0]);
    }
  };

  const handleRoleChange = async (e) => {
    const newRole = e.target.value;
    if (!roles.includes(newRole)) {
      const { error } = await supabase.from("profils_utilisateurs").insert([
        {
          user_id: session.user.id,
          role: newRole,
        },
      ]);
      if (error) {
        toast.error("Erreur lors de l'ajout du rôle");
        return;
      }
      toast.success(`Rôle "${newRole}" ajouté avec succès`);
      setRoles((prev) => [...prev, newRole]);
    }
    setCurrentRole(newRole);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <nav className="flex justify-between items-center bg-black text-white px-4 py-3">
      <Link to="/" className="text-xl font-bold">
        Tickrace
      </Link>

      <div className="flex items-center space-x-4">
        {currentRole === "coureur" && (
          <Link to="/monprofilcoureur" className="hover:underline">
            Mon profil coureur
          </Link>
        )}
        {currentRole === "organisateur" && (
          <>
            <Link to="/organisateur/mon-espace" className="hover:underline">
              Espace Organisateur
            </Link>
            <Link to="/organisateur/nouvelle-course" className="hover:underline">
              Nouvelle Course
            </Link>
          </>
        )}

        {roles.length > 0 && (
          <select
            value={currentRole || ""}
            onChange={handleRoleChange}
            className="text-black px-2 py-1 rounded"
          >
            <option disabled>Choisir un rôle</option>
            {["coureur", "organisateur"].map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
        >
          Déconnexion
        </button>
      </div>
    </nav>
  );
}

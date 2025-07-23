import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useUser } from "../contexts/UserContext";
import toast from "react-hot-toast";

export default function Navbar() {
  const { session, currentRole, switchRole } = useUser();
  const [_, setForceUpdate] = useState(0);
  const navigate = useNavigate();

  // 🔄 Forcer le re-render quand currentRole change
  useEffect(() => {
    setForceUpdate(prev => prev + 1);
  }, [currentRole]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnexion réussie");
    navigate("/login");
  };

  return (
    <nav style={{ padding: "1rem", borderBottom: "1px solid #ccc" }}>
      <Link to="/" style={{ marginRight: "1rem" }}>Accueil</Link>

      {session && currentRole === "coureur" && (
        <>
          <Link to="/monprofilcoureur" style={{ marginRight: "1rem" }}>Mon profil coureur</Link>
        </>
      )}

      {session && currentRole === "organisateur" && (
        <>
          <Link to="/organisateur/mon-espace" style={{ marginRight: "1rem" }}>Mon espace organisateur</Link>
        </>
      )}

      {session && currentRole === null && (
        <>
          <span style={{ marginRight: "1rem" }}>Choisissez votre rôle :</span>
          <button onClick={() => switchRole("coureur")} style={{ marginRight: "0.5rem" }}>Coureur</button>
          <button onClick={() => switchRole("organisateur")}>Organisateur</button>
        </>
      )}

      {!session && (
        <>
          <Link to="/login" style={{ marginRight: "1rem" }}>Connexion</Link>
          <Link to="/signup">Inscription</Link>
        </>
      )}

      {session && (
        <button onClick={handleLogout} style={{ marginLeft: "1rem" }}>Déconnexion</button>
      )}
    </nav>
  );
}

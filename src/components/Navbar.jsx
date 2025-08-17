import React, { useEffect, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import { supabase } from "../supabase";

// Util: classes conditionnelles
function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function Navbar() {
  const { session, currentRole, switchRole, setCurrentRole } = useUser();
  const isLoggedIn = !!session;
  const isAdmin = !!session?.user?.app_metadata?.roles?.includes?.("admin");
  const location = useLocation();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);

  // Ferme le menu mobile à chaque changement de route
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const setRole = (role) => {
    if (typeof switchRole === "function") switchRole(role);
    else if (typeof setCurrentRole === "function") setCurrentRole(role);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // Menus selon le rôle (hors admin)
  const menuCoureur = [
    { to: "/courses", label: "Courses", pub: true },
    { to: "/mesinscriptions", label: "Mes inscriptions", priv: true },
    { to: "/monprofilcoureur", label: "Mon profil", priv: true },
  ];
  const menuOrganisateur = [
    { to: "/organisateur/mon-espace", label: "Mon espace", priv: true },
    { to: "/organisateur/nouvelle-course", label: "Créer une course", priv: true },
    { to: "/formats", label: "Formats", priv: true },
    { to: "/monprofilorganisateur", label: "Mon profil", priv: true },
  ];
  const activeMenu = currentRole === "organisateur" ? menuOrganisateur : menuCoureur;

  const LinkItem = ({ to, children }) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "px-3 py-2 rounded-lg text-sm transition",
          isActive ? "bg-gray-900 text-white" : "hover:bg-gray-100"
        )
      }
    >
      {children}
    </NavLink>
  );

  return (
    <header className="sticky top-0 z-50 bg-white/85 backdrop-blur border-b">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-3">
        {/* Left: Logo + Desktop nav */}
        <div className="flex items-center gap-3">
          <Link to="/" className="font-semibold text-lg tracking-tight">
            Tickrace
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            <LinkItem to="/courses">Courses</LinkItem>
            {activeMenu
              .filter((i) => i.pub || (i.priv && isLoggedIn))
              .map((i) => (
                <LinkItem key={i.to} to={i.to}>
                  {i.label}
                </LinkItem>
              ))}
            {isAdmin && (
              <>
                <LinkItem to="/admin">Admin</LinkItem>
                <LinkItem to="/admin/payouts">Reversements</LinkItem>
              </>
            )}
          </nav>
        </div>

        {/* Middle: Role switch (desktop) */}
        <div className="hidden md:flex items-center p-1 rounded-xl border">
          <button
            type="button"
            onClick={() => setRole("coureur")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm",
              currentRole === "coureur" ? "bg-gray-900 text-white" : "hover:bg-gray-100"
            )}
          >
            Coureur
          </button>
          <button
            type="button"
            onClick={() => setRole("organisateur")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm",
              currentRole === "organisateur" ? "bg-gray-900 text-white" : "hover:bg-gray-100"
            )}
          >
            Organisateur
          </button>
        </div>

        {/* Right: Auth + mobile toggler */}
        <div className="flex items-center gap-2">
          {!isLoggedIn ? (
            <>
              <Link
                to="/login"
                className="hidden md:inline-block px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-sm"
              >
                Connexion
              </Link>
              <Link
                to="/signup"
                className="hidden md:inline-block px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-sm"
              >
                Inscription
              </Link>
            </>
          ) : (
            <button
              onClick={handleLogout}
              className="hidden md:inline-block px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-sm"
            >
              Déconnexion
            </button>
          )}

          {/* Burger */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
            onClick={() => setOpen((v) => !v)}
            aria-label="Ouvrir le menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {open && (
        <div className="md:hidden border-t bg-white">
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-2">
            {/* Switch mobile */}
            {isLoggedIn && (
              <div className="flex items-center p-1 rounded-xl border w-full max-w-xs">
                <button
                  onClick={() => setRole("coureur")}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-lg text-sm text-center",
                    currentRole === "coureur" ? "bg-gray-900 text-white" : "hover:bg-gray-100"
                  )}
                >
                  Coureur
                </button>
                <button
                  onClick={() => setRole("organisateur")}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-lg text-sm text-center",
                    currentRole === "organisateur" ? "bg-gray-900 text-white" : "hover:bg-gray-100"
                  )}
                >
                  Organisateur
                </button>
              </div>
            )}

            {/* Liens */}
            <LinkItem to="/courses">Courses</LinkItem>
            {activeMenu
              .filter((i) => i.pub || (i.priv && isLoggedIn))
              .map((i) => (
                <LinkItem key={i.to} to={i.to}>
                  {i.label}
                </LinkItem>
              ))}
            {isAdmin && (
              <>
                <LinkItem to="/admin">Admin</LinkItem>
                <LinkItem to="/admin/payouts">Reversements</LinkItem>
              </>
            )}

            {/* Auth */}
            {!isLoggedIn ? (
              <div className="mt-2 flex gap-2">
                <Link to="/login" className="flex-1 px-3 py-2 rounded-lg border text-center">
                  Connexion
                </Link>
                <Link to="/signup" className="flex-1 px-3 py-2 rounded-lg border text-center">
                  Inscription
                </Link>
              </div>
            ) : (
              <button
                onClick={handleLogout}
                className="mt-2 w-full px-3 py-2 rounded-lg border text-center"
              >
                Déconnexion
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

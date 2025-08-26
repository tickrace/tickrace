// src/components/Navbar.jsx
import React, { useEffect, useRef, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import { supabase } from "../supabase";
import useIsAdmin from "../hooks/useIsAdmin";
import logo from "../assets/logo.png";

function cn(...cls) {
  return cls.filter(Boolean).join(" ");
}

const DeskItem = ({ to, children }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      cn(
        "relative px-3 py-2 rounded-xl text-sm font-medium transition",
        "hover:bg-gray-100",
        isActive && "text-gray-900"
      )
    }
  >
    {({ isActive }) => (
      <>
        <span className="inline-flex items-center gap-2">{children}</span>
        <span
          className={cn(
            "absolute left-2 right-2 -bottom-[6px] h-[2px] rounded-full bg-orange-500 transition-opacity",
            isActive ? "opacity-100" : "opacity-0"
          )}
        />
      </>
    )}
  </NavLink>
);

export default function Navbar() {
  const { session, currentRole, switchRole, setCurrentRole } = useUser();
  const isLoggedIn = !!session;
  const { isAdmin } = useIsAdmin();

  const navigate = useNavigate();
  const location = useLocation();

  const [openMobile, setOpenMobile] = useState(false);
  const [openUserMenu, setOpenUserMenu] = useState(false);

  const userMenuRef = useRef(null);
  useEffect(() => {
    setOpenMobile(false);
    setOpenUserMenu(false);
  }, [location.pathname]);

  useEffect(() => {
    const onClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setOpenUserMenu(false);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const setRole = (role) => {
    if (typeof switchRole === "function") switchRole(role);
    else if (typeof setCurrentRole === "function") setCurrentRole(role);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // Liens
  const baseLeftItems = [
    { to: "/", label: "Accueil" },
    { to: "/fonctionnalites", label: "Fonctionnalités" },
    { to: "/courses", label: "Courses" },
  ];

  const rightCoureurItems = [
    { to: "/mesinscriptions", label: "Mes inscriptions", priv: true },
    { to: "/monprofilcoureur", label: "Mon profil", priv: true },
  ];

  const rightOrgaItems = [
    { to: "/organisateur/mon-espace", label: "Mon espace", priv: true },
    { to: "/organisateur/nouvelle-course", label: "Créer une course", priv: true, forceOrg: true },
    { to: "/monprofilorganisateur", label: "Mon profil", priv: true },
  ];

  const rightItems = currentRole === "organisateur" ? rightOrgaItems : rightCoureurItems;

  const avatarLetter = session?.user?.email?.[0]?.toUpperCase?.() || "U";
  const email = session?.user?.email || "";

  // Petit badge PRO
  const ProBadge = () => (
    <span className="text-[10px] leading-none px-2 py-0.5 rounded-full bg-gray-900 text-white">
      PRO
    </span>
  );

  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
        {/* GAUCHE : Logo + Accueil/Fonctionnalités/Courses */}
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Aller à l’accueil">
            <img src={logo} alt="TickRace" className="h-8 w-auto" />
            <span className="font-extrabold tracking-tight">
              <span className="text-orange-600">Tick</span>Race
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-2">
            {baseLeftItems.map((i) => (
              <DeskItem key={i.to} to={i.to}>
                {i.label}
              </DeskItem>
            ))}
          </nav>
        </div>

        {/* DROITE : selon mode (coureur/organisateur) */}
        <div className="hidden md:flex items-center gap-3">
          <nav className="flex items-center gap-1">
            {rightItems
              .filter((i) => (i.priv ? isLoggedIn : true))
              .map((i) =>
                i.forceOrg ? (
                  <button
                    key={i.to}
                    type="button"
                    onClick={() => {
                      setRole("organisateur");
                      navigate(i.to);
                    }}
                    className="relative px-3 py-2 rounded-xl text-sm font-medium transition hover:bg-gray-100"
                  >
                    <span className="inline-flex items-center gap-2">
                      {i.label}
                      {currentRole === "organisateur" && <ProBadge />}
                    </span>
                  </button>
                ) : (
                  <DeskItem key={i.to} to={i.to}>
                    <>
                      {i.label}
                      {currentRole === "organisateur" && <ProBadge />}
                    </>
                  </DeskItem>
                )
              )}

            {isAdmin && (
              <DeskItem to="/admin">
                <>
                  Admin <ProBadge />
                </>
              </DeskItem>
            )}
          </nav>

          {/* Auth / user + sélecteur de mode dans le menu utilisateur */}
          {!isLoggedIn ? (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-3 py-1.5 rounded-xl border text-sm font-medium hover:bg-gray-50"
              >
                Connexion
              </Link>
              <Link
                to="/signup"
                className="px-3 py-1.5 rounded-xl border text-sm font-medium bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200"
              >
                Inscription
              </Link>
            </div>
          ) : (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setOpenUserMenu((v) => !v)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-100"
              >
                <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold">
                  {avatarLetter}
                </div>
                <div className="text-left">
                  <div className="text-xs text-gray-500 leading-none">Connecté</div>
                  <div className="text-sm leading-none max-w-[180px] truncate">{email}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 20 20" className="opacity-60">
                  <path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>

              {openUserMenu && (
                <div className="absolute right-0 top-12 w-72 rounded-2xl border bg-white shadow-lg p-2">
                  <div className="px-3 py-2">
                    <div className="text-xs text-gray-500">Connecté en tant que</div>
                    <div className="text-sm font-medium truncate">{email}</div>
                  </div>

                  {/* Sélecteur de mode */}
                  <div className="mx-2 my-2 p-1 rounded-2xl bg-gray-50 border flex">
                    <button
                      className={cn(
                        "flex-1 px-3 py-1.5 rounded-xl text-sm",
                        currentRole === "coureur"
                          ? "bg-gray-900 text-white"
                          : "hover:bg-white"
                      )}
                      onClick={() => setRole("coureur")}
                    >
                      Coureur
                    </button>
                    <button
                      className={cn(
                        "flex-1 px-3 py-1.5 rounded-xl text-sm",
                        currentRole === "organisateur"
                          ? "bg-gray-900 text-white"
                          : "hover:bg-white"
                      )}
                      onClick={() => setRole("organisateur")}
                    >
                      Organisateur
                    </button>
                  </div>

                  <div className="my-1 h-px bg-gray-100" />
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-gray-50"
                  >
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Burger mobile */}
        <button
          className="md:hidden p-2 rounded-xl hover:bg-gray-100"
          onClick={() => setOpenMobile((v) => !v)}
          aria-label="Ouvrir le menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
      </div>

      {/* Drawer mobile */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-40 transition",
          openMobile ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/20 transition-opacity",
            openMobile ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setOpenMobile(false)}
        />
        <div
          className={cn(
            "absolute right-0 top-0 h-full w-80 max-w-[85%] bg-white border-l shadow-xl p-4 transition-transform",
            openMobile ? "translate-x-0" : "translate-x-full"
          )}
        >
          {/* Header drawer */}
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2" onClick={() => setOpenMobile(false)}>
              <img src={logo} alt="TickRace" className="h-7 w-auto" />
              <span className="font-extrabold tracking-tight">
                <span className="text-orange-600">Tick</span>Race
              </span>
            </Link>
            <button
              className="p-2 rounded-xl hover:bg-gray-100"
              onClick={() => setOpenMobile(false)}
              aria-label="Fermer"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>

          {/* Bloc user + sélecteur de mode */}
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold">
                {avatarLetter}
              </div>
              <div className="text-sm">{isLoggedIn ? email : "Invité"}</div>
            </div>
            {isLoggedIn && (
              <div className="mt-3 p-1 rounded-2xl bg-gray-50 border flex">
                <button
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-xl text-sm",
                    currentRole === "coureur" ? "bg-gray-900 text-white" : "hover:bg-white"
                  )}
                  onClick={() => setRole("coureur")}
                >
                  Coureur
                </button>
                <button
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-xl text-sm",
                    currentRole === "organisateur" ? "bg-gray-900 text-white" : "hover:bg-white"
                  )}
                  onClick={() => setRole("organisateur")}
                >
                  Organisateur
                </button>
              </div>
            )}
          </div>

          {/* Liens */}
          <div className="mt-5 grid">
            {/* Gauche */}
            {baseLeftItems.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                onClick={() => setOpenMobile(false)}
                className={({ isActive }) =>
                  cn(
                    "px-3 py-2 rounded-xl text-sm font-medium",
                    isActive ? "bg-orange-50 text-orange-700" : "hover:bg-gray-100"
                  )
                }
              >
                {i.label}
              </NavLink>
            ))}

            {/* Droite selon rôle (avec badge PRO si organisateur) */}
            {rightItems
              .filter((i) => (i.priv ? isLoggedIn : true))
              .map((i) =>
                i.forceOrg ? (
                  <button
                    key={i.to}
                    onClick={() => {
                      setRole("organisateur");
                      navigate(i.to);
                      setOpenMobile(false);
                    }}
                    className="text-left px-3 py-2 rounded-xl text-sm font-medium hover:bg-gray-100"
                  >
                    <span className="inline-flex items-center gap-2">
                      {i.label}
                      {currentRole === "organisateur" && <ProBadge />}
                    </span>
                  </button>
                ) : (
                  <NavLink
                    key={i.to}
                    to={i.to}
                    onClick={() => setOpenMobile(false)}
                    className={({ isActive }) =>
                      cn(
                        "px-3 py-2 rounded-xl text-sm font-medium",
                        isActive ? "bg-orange-50 text-orange-700" : "hover:bg-gray-100"
                      )
                    }
                  >
                    <span className="inline-flex items-center gap-2">
                      {i.label}
                      {currentRole === "organisateur" && <ProBadge />}
                    </span>
                  </NavLink>
                )
              )}

            {/* Admin */}
            {isAdmin && (
              <>
                <div className="mt-3 mb-1 text-xs uppercase tracking-wide text-gray-500">
                  Administration
                </div>
                <NavLink
                  to="/admin"
                  onClick={() => setOpenMobile(false)}
                  className={({ isActive }) =>
                    cn(
                      "px-3 py-2 rounded-xl text-sm font-medium",
                      isActive ? "bg-orange-50 text-orange-700" : "hover:bg-gray-100"
                    )
                  }
                >
                  <span className="inline-flex items-center gap-2">
                    Admin <ProBadge />
                  </span>
                </NavLink>
                <NavLink
                  to="/admin/courses"
                  onClick={() => setOpenMobile(false)}
                  className="px-3 py-2 rounded-xl text-sm font-medium hover:bg-gray-100"
                >
                  Courses Admin
                </NavLink>
                <NavLink
                  to="/admin/payouts"
                  onClick={() => setOpenMobile(false)}
                  className="px-3 py-2 rounded-xl text-sm font-medium hover:bg-gray-100"
                >
                  Reversements
                </NavLink>
                <NavLink
                  to="/admin/inscriptions"
                  onClick={() => setOpenMobile(false)}
                  className="px-3 py-2 rounded-xl text-sm font-medium hover:bg-gray-100"
                >
                  Inscriptions
                </NavLink>
              </>
            )}
          </div>

          {/* Auth actions */}
          <div className="mt-6">
            {!isLoggedIn ? (
              <div className="grid gap-2">
                <Link
                  to="/login"
                  onClick={() => setOpenMobile(false)}
                  className="px-3 py-2 rounded-xl border text-center hover:bg-gray-50"
                >
                  Connexion
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setOpenMobile(false)}
                  className="px-3 py-2 rounded-xl border text-center bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700"
                >
                  Inscription
                </Link>
              </div>
            ) : (
              <button
                onClick={async () => {
                  await handleLogout();
                  setOpenMobile(false);
                }}
                className="w-full px-3 py-2 rounded-xl border text-center hover:bg-gray-50"
              >
                Déconnexion
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

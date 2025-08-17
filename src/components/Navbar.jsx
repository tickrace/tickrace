import React, { useEffect, useRef, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import { supabase } from "../supabase";

function cn(...cls) { return cls.filter(Boolean).join(" "); }

export default function Navbar() {
  const { session, currentRole, switchRole, setCurrentRole } = useUser();
  const isLoggedIn = !!session;
  const isAdmin = !!session?.user?.app_metadata?.roles?.includes?.("admin");
  const navigate = useNavigate();
  const location = useLocation();

  const [openMobile, setOpenMobile] = useState(false);
  const [openUser, setOpenUser] = useState(false);

  const userMenuRef = useRef(null);
  useEffect(() => { setOpenMobile(false); setOpenUser(false); }, [location.pathname]);
  useEffect(() => {
    const onClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setOpenUser(false);
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

  // Menus selon rôle (hors “Courses” affiché à part)
  const menuCoureur = [
    { to: "/mesinscriptions", label: "Mes inscriptions", priv: true },
    { to: "/monprofilcoureur", label: "Mon profil", priv: true },
  ];

  const menuOrganisateur = [
    { to: "/organisateur/mon-espace", label: "Mon espace", priv: true },
    { to: "/organisateur/nouvelle-course", label: "Créer une course", priv: true, forceOrg: true },
    { to: "/monprofilorganisateur", label: "Mon profil", priv: true },
  ];

  const activeMenu = currentRole === "organisateur" ? menuOrganisateur : menuCoureur;

  const LinkItem = ({ to, children }) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "px-3 py-2 rounded-xl text-sm transition",
          isActive ? "bg-gray-900 text-white shadow" : "hover:bg-gray-100"
        )
      }
    >
      {children}
    </NavLink>
  );

  const RoleAwareItem = ({ item }) => {
    if (item.forceOrg) {
      return (
        <button
          type="button"
          onClick={() => { setRole("organisateur"); navigate(item.to); }}
          className="px-3 py-2 rounded-xl text-sm hover:bg-gray-100"
        >
          {item.label}
        </button>
      );
    }
    return <LinkItem to={item.to}>{item.label}</LinkItem>;
  };

  const avatarLetter = session?.user?.email?.[0]?.toUpperCase?.() || "U";
  const email = session?.user?.email || "";

  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
        {/* Left: Logo + main nav (desktop) */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center font-bold">T</div>
            <span className="font-semibold tracking-tight">Tickrace</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-2">
            <LinkItem to="/courses">Courses</LinkItem>
            {activeMenu
              .filter(i => i.priv ? isLoggedIn : true)
              .map(i => <RoleAwareItem key={i.to} item={i} />)}
            {isAdmin && (
              <>
                <LinkItem to="/admin">Admin</LinkItem>
                <LinkItem to="/admin/courses">Courses Admin</LinkItem>
                <LinkItem to="/admin/payouts">Reversements</LinkItem>
              </>
            )}
          </nav>
        </div>

        {/* Middle: Role pills (desktop) */}
        <div className="hidden md:flex items-center p-1 rounded-2xl border">
          <button
            type="button"
            onClick={() => setRole("coureur")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-sm",
              currentRole === "coureur" ? "bg-gray-900 text-white shadow" : "hover:bg-gray-100"
            )}
          >
            Coureur
          </button>
          <button
            type="button"
            onClick={() => setRole("organisateur")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-sm",
              currentRole === "organisateur" ? "bg-gray-900 text-white shadow" : "hover:bg-gray-100"
            )}
          >
            Organisateur
          </button>
        </div>

        {/* Right: Auth + user menu + burger */}
        <div className="flex items-center gap-2">
          {!isLoggedIn ? (
            <div className="hidden md:flex items-center gap-2">
              <Link to="/login" className="px-3 py-1.5 rounded-xl border text-sm hover:bg-gray-50">Connexion</Link>
              <Link to="/signup" className="px-3 py-1.5 rounded-xl border text-sm hover:bg-gray-50">Inscription</Link>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-3" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setOpenUser(v => !v)}
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
              {openUser && (
                <div className="absolute right-4 top-14 w-64 rounded-2xl border bg-white shadow-lg p-2">
                  <div className="px-3 py-2">
                    <div className="text-xs text-gray-500">Connecté en tant que</div>
                    <div className="text-sm font-medium truncate">{email}</div>
                  </div>
                  <div className="my-1 h-px bg-gray-100" />
                  <button
                    onClick={() => setRole("coureur")}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-gray-50",
                      currentRole === "coureur" && "bg-gray-100"
                    )}
                  >
                    Mode coureur
                  </button>
                  <button
                    onClick={() => setRole("organisateur")}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-gray-50",
                      currentRole === "organisateur" && "bg-gray-100"
                    )}
                  >
                    Mode organisateur
                  </button>
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

          {/* Burger */}
          <button
            className="md:hidden p-2 rounded-xl hover:bg-gray-100"
            onClick={() => setOpenMobile(v => !v)}
            aria-label="Ouvrir le menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Drawer mobile */}
      <div className={cn(
        "md:hidden fixed inset-0 z-40 transition",
        openMobile ? "pointer-events-auto" : "pointer-events-none"
      )}>
        {/* Overlay */}
        <div
          className={cn(
            "absolute inset-0 bg-black/20 transition-opacity",
            openMobile ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setOpenMobile(false)}
        />
        {/* Panel */}
        <div
          className={cn(
            "absolute right-0 top-0 h-full w-80 max-w-[85%] bg-white border-l shadow-xl p-4 transition-transform",
            openMobile ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold">
                {avatarLetter}
              </div>
              <div className="text-sm">{isLoggedIn ? email : "Invité"}</div>
            </div>
            <button className="p-2 rounded-xl hover:bg-gray-100" onClick={() => setOpenMobile(false)} aria-label="Fermer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>

          {/* Switch role (mobile) */}
          {isLoggedIn && (
            <div className="mt-3 p-1 rounded-2xl border flex">
              <button
                className={cn(
                  "flex-1 px-3 py-1.5 rounded-xl text-sm",
                  currentRole === "coureur" ? "bg-gray-900 text-white" : "hover:bg-gray-100"
                )}
                onClick={() => setRole("coureur")}
              >
                Coureur
              </button>
              <button
                className={cn(
                  "flex-1 px-3 py-1.5 rounded-xl text-sm",
                  currentRole === "organisateur" ? "bg-gray-900 text-white" : "hover:bg-gray-100"
                )}
                onClick={() => setRole("organisateur")}
              >
                Organisateur
              </button>
            </div>
          )}

          <div className="mt-4 grid gap-1">
            <LinkItem to="/courses">Courses</LinkItem>
            {activeMenu
              .filter(i => i.priv ? isLoggedIn : true)
              .map(i => (
                <RoleAwareItem key={i.to} item={i} />
              ))}
            {isAdmin && (
              <>
                <LinkItem to="/admin">Admin</LinkItem>
                <LinkItem to="/admin/courses">Courses Admin</LinkItem>
                <LinkItem to="/admin/payouts">Reversements</LinkItem>
              </>
            )}
          </div>

          <div className="mt-4">
            {!isLoggedIn ? (
              <div className="grid gap-2">
                <Link to="/login" className="px-3 py-2 rounded-xl border text-center hover:bg-gray-50">Connexion</Link>
                <Link to="/signup" className="px-3 py-2 rounded-xl border text-center hover:bg-gray-50">Inscription</Link>
              </div>
            ) : (
              <button onClick={handleLogout} className="w-full px-3 py-2 rounded-xl border text-center hover:bg-gray-50">
                Déconnexion
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

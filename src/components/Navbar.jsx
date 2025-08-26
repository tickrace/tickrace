// src/components/Navbar.jsx
import React, { useEffect, useRef, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import { supabase } from "../supabase";
import useIsAdmin from "../hooks/useIsAdmin";
import logo from "../assets/logo.png";
import {
  Home,
  ListChecks,
  PlusCircle,
  User,
  LayoutDashboard,
  Menu,
  X,
  ChevronDown,
  LogOut,
} from "lucide-react";

function cn(...cls) {
  return cls.filter(Boolean).join(" ");
}

export default function Navbar() {
  const { session, currentRole, switchRole, setCurrentRole } = useUser();
  const isLoggedIn = !!session;
  const { isAdmin } = useIsAdmin();

  const navigate = useNavigate();
  const location = useLocation();

  const [openMobileDrawer, setOpenMobileDrawer] = useState(false);
  const [openUser, setOpenUser] = useState(false);

  // Fermer menus au changement de page
  useEffect(() => {
    setOpenMobileDrawer(false);
    setOpenUser(false);
  }, [location.pathname]);

  // Click-away du menu user
  const userMenuRef = useRef(null);
  useEffect(() => {
    const onClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setOpenUser(false);
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

  // Menus dynamiques
  const menuCoureur = [
    { to: "/courses", label: "Courses" },
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
          onClick={() => {
            setRole("organisateur");
            navigate(item.to);
          }}
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
    <>
      {/* TOP BAR (desktop + mobile) */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
          {/* Left: Logo + nav desktop */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <img src={logo} alt="TickRace" className="h-8 w-auto" />
              <span className="font-extrabold tracking-tight">
                <span className="text-orange-600">Tick</span>Race
              </span>
            </Link>

            {/* Desktop primary nav */}
            <nav className="hidden md:flex items-center gap-1 ml-2">
              <LinkItem to="/courses">Courses</LinkItem>
              {activeMenu
                .filter((i) => (i.priv ? isLoggedIn : true))
                .map((i) => (
                  <RoleAwareItem key={i.to} item={i} />
                ))}
              {isAdmin && <LinkItem to="/admin">Admin</LinkItem>}
            </nav>
          </div>

          {/* Right: role switch + user */}
          <div className="flex items-center gap-2">
            {/* Desktop role switch (pill) */}
            {isLoggedIn && (
              <div className="hidden md:flex border rounded-2xl p-1">
                <button
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-sm",
                    currentRole === "coureur" ? "bg-gray-900 text-white" : "hover:bg-gray-100"
                  )}
                  onClick={() => setRole("coureur")}
                >
                  Coureur
                </button>
                <button
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-sm",
                    currentRole === "organisateur" ? "bg-gray-900 text-white" : "hover:bg-gray-100"
                  )}
                  onClick={() => setRole("organisateur")}
                >
                  Organisateur
                </button>
              </div>
            )}

            {/* Desktop user menu */}
            <div className="hidden md:flex items-center gap-2" ref={userMenuRef}>
              {!isLoggedIn ? (
                <>
                  <Link to="/login" className="px-3 py-1.5 rounded-xl border text-sm hover:bg-gray-50">
                    Connexion
                  </Link>
                  <Link to="/signup" className="px-3 py-1.5 rounded-xl border text-sm hover:bg-gray-50">
                    Inscription
                  </Link>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setOpenUser((v) => !v)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-100"
                    aria-haspopup="menu"
                    aria-expanded={openUser}
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-900 text-white grid place-items-center text-sm font-bold">
                      {avatarLetter}
                    </div>
                    <div className="text-left">
                      <div className="text-xs text-gray-500 leading-none">Connecté</div>
                      <div className="text-sm leading-none max-w-[180px] truncate">{email}</div>
                    </div>
                    <ChevronDown className="w-4 h-4 opacity-70" />
                  </button>
                  {openUser && (
                    <div
                      role="menu"
                      className="absolute right-4 top-14 w-64 rounded-2xl border bg-white shadow-lg p-2"
                    >
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
                        role="menuitem"
                      >
                        Mode coureur
                      </button>
                      <button
                        onClick={() => setRole("organisateur")}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-gray-50",
                          currentRole === "organisateur" && "bg-gray-100"
                        )}
                        role="menuitem"
                      >
                        Mode organisateur
                      </button>
                      <div className="my-1 h-px bg-gray-100" />
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-gray-50"
                        role="menuitem"
                      >
                        <span className="inline-flex items-center gap-2">
                          <LogOut className="w-4 h-4" /> Déconnexion
                        </span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-xl hover:bg-gray-100"
              onClick={() => setOpenMobileDrawer((v) => !v)}
              aria-label="Ouvrir le menu"
            >
              {openMobileDrawer ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE DRAWER (actions avancées) */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-40 transition",
          openMobileDrawer ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/20 transition-opacity",
            openMobileDrawer ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setOpenMobileDrawer(false)}
        />
        <div
          className={cn(
            "absolute right-0 top-0 h-full w-80 max-w-[85%] bg-white border-l shadow-xl p-4 transition-transform",
            openMobileDrawer ? "translate-x-0" : "translate-x-full"
          )}
        >
          {/* Rôle quick switch */}
          {isLoggedIn && (
            <div className="p-1 rounded-2xl border flex">
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

          {/* Liens détaillés */}
          <div className="mt-4 grid gap-1">
            {/* Invariante */}
            <MobileLink to="/courses" onClick={() => setOpenMobileDrawer(false)}>
              Courses
            </MobileLink>

            {/* Contextuels selon rôle */}
            {activeMenu
              .filter((i) => (i.priv ? isLoggedIn : true))
              .map((i) =>
                i.forceOrg ? (
                  <button
                    key={i.to}
                    onClick={() => {
                      setRole("organisateur");
                      navigate(i.to);
                      setOpenMobileDrawer(false);
                    }}
                    className="text-left px-3 py-2 rounded-xl text-sm hover:bg-gray-100"
                  >
                    {i.label}
                  </button>
                ) : (
                  <MobileLink key={i.to} to={i.to} onClick={() => setOpenMobileDrawer(false)}>
                    {i.label}
                  </MobileLink>
                )
              )}

            {/* Admin section */}
            {isAdmin && (
              <>
                <div className="mt-2 text-xs uppercase tracking-wide text-gray-500 px-2">Admin</div>
                <MobileLink to="/admin" onClick={() => setOpenMobileDrawer(false)}>
                  Dashboard admin
                </MobileLink>
                <MobileLink to="/admin/courses" onClick={() => setOpenMobileDrawer(false)}>
                  Courses Admin
                </MobileLink>
                <MobileLink to="/admin/payouts" onClick={() => setOpenMobileDrawer(false)}>
                  Reversements
                </MobileLink>
                <MobileLink to="/admin/inscriptions" onClick={() => setOpenMobileDrawer(false)}>
                  Inscriptions
                </MobileLink>
              </>
            )}
          </div>

          <div className="mt-4">
            {!isLoggedIn ? (
              <div className="grid gap-2">
                <MobileLink to="/login" onClick={() => setOpenMobileDrawer(false)}>
                  Connexion
                </MobileLink>
                <MobileLink to="/signup" onClick={() => setOpenMobileDrawer(false)}>
                  Inscription
                </MobileLink>
              </div>
            ) : (
              <button
                onClick={() => {
                  handleLogout();
                  setOpenMobileDrawer(false);
                }}
                className="w-full px-3 py-2 rounded-xl border text-center hover:bg-gray-50"
              >
                Déconnexion
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM TAB BAR (façon Strava) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto max-w-7xl grid grid-cols-4">
          <TabButton to="/" label="Accueil" active={location.pathname === "/"} Icon={Home} />
          <TabButton to="/courses" label="Courses" active={location.pathname.startsWith("/courses")} Icon={ListChecks} />
          {currentRole === "organisateur" ? (
            <TabButton
              to="/organisateur/mon-espace"
              label="Mon espace"
              active={location.pathname.startsWith("/organisateur")}
              Icon={LayoutDashboard}
            />
          ) : (
            <TabButton
              to="/mesinscriptions"
              label="Mes inscr."
              active={location.pathname.startsWith("/mesinscriptions")}
              Icon={PlusCircle}
            />
          )}
          <TabButton
            to={currentRole === "organisateur" ? "/monprofilorganisateur" : "/monprofilcoureur"}
            label="Profil"
            active={
              location.pathname.startsWith("/monprofilorganisateur") ||
              location.pathname.startsWith("/monprofilcoureur")
            }
            Icon={User}
          />
        </div>
      </nav>

      {/* Spacer for bottom bar (mobile) */}
      <div className="md:hidden h-14" />
    </>
  );
}

/* === Petits sous-composants === */

function MobileLink({ to, children, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
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
}

function TabButton({ to, label, Icon, active }) {
  return (
    <NavLink
      to={to}
      className={cn(
        "flex flex-col items-center justify-center py-2 text-xs font-medium",
        active ? "text-gray-900" : "text-gray-500 hover:text-gray-800"
      )}
    >
      <Icon className={cn("w-5 h-5 mb-0.5", active ? "opacity-100" : "opacity-80")} />
      <span className="leading-none">{label}</span>
    </NavLink>
  );
}

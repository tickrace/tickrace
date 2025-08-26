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

function LinkItem({ to, children, className = "" }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "px-3 py-2 rounded-xl text-sm transition",
          isActive ? "bg-gray-900 text-white shadow" : "hover:bg-gray-100",
          className
        )
      }
    >
      {children}
    </NavLink>
  );
}

// Style spécial "Créer une course" : souligné orange (ancienne version)
function OrangeUnderlineLinkItem({ to, onClick, children }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "px-3 py-2 rounded-xl text-sm transition underline underline-offset-[6px] decoration-2",
          isActive
            ? "decoration-orange-600 text-gray-900 bg-gray-50"
            : "decoration-orange-500 hover:bg-gray-50"
        )
      }
    >
      {children}
    </NavLink>
  );
}

export default function Navbar() {
  const { session, currentRole, switchRole, setCurrentRole } = useUser();
  const isLoggedIn = !!session;
  const { isAdmin } = useIsAdmin();

  const navigate = useNavigate();
  const location = useLocation();

  const [openMobile, setOpenMobile] = useState(false);
  const [openUser, setOpenUser] = useState(false);

  const userMenuRef = useRef(null);

  useEffect(() => {
    setOpenMobile(false);
    setOpenUser(false);
  }, [location.pathname]);

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

  // Menus
  const commonLeft = [
    { to: "/", label: "Accueil" },
    { to: "/fonctionnalites", label: "Fonctionnalités" }, // ✅ route corrigée
    { to: "/courses", label: "Courses" },
  ];

  const menuCoureur = [
    { to: "/mesinscriptions", label: "Mes inscriptions", priv: true },
    { to: "/monprofilcoureur", label: "Mon profil", priv: true },
  ];

  const menuOrganisateur = [
    { to: "/organisateur/mon-espace", label: "Mon espace", priv: true },
    {
      to: "/organisateur/nouvelle-course",
      label: "Créer une course",
      priv: true,
      forceOrg: true,
      orange: true, // ✅ indicateur style orange
    },
    { to: "/monprofilorganisateur", label: "Mon profil", priv: true },
  ];

  const roleMenu = currentRole === "organisateur" ? menuOrganisateur : menuCoureur;

  // Rend un item en tenant compte du rôle + style "orange" pour Créer une course
  const RoleAwareItem = ({ item }) => {
    const onClick = item.forceOrg
      ? () => {
          setRole("organisateur");
          navigate(item.to);
        }
      : undefined;

    if (item.orange) {
      return (
        <OrangeUnderlineLinkItem to={item.to} onClick={onClick}>
          {item.label}
        </OrangeUnderlineLinkItem>
      );
    }
    return <LinkItem to={item.to}>{item.label}</LinkItem>;
  };

  const avatarLetter = session?.user?.email?.[0]?.toUpperCase?.() || "U";
  const email = session?.user?.email || "";

  return (
    <header className="sticky top-0 z-50 border-b bg-white shadow-sm md:bg-white/80 md:backdrop-blur supports-[backdrop-filter]:md:bg-white/70">
      <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
        {/* Left: Logo + nav (desktop) */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2" aria-label="Accueil">
            <img src={logo} alt="TickRace" className="h-8 w-auto" />
            <span className="font-bold tracking-tight">
              <span className="text-orange-600">Tick</span>Race
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-2">
            {commonLeft.map((item) => (
              <LinkItem key={item.to} to={item.to}>
                {item.label}
              </LinkItem>
            ))}

            {roleMenu
              .filter((i) => (i.priv ? isLoggedIn : true))
              .map((i) => (
                <RoleAwareItem key={i.to} item={i} />
              ))}

            {isAdmin && <LinkItem to="/admin">Admin</LinkItem>}
          </nav>
        </div>

        {/* Right: User (desktop) + Burger */}
        <div className="flex items-center gap-2">
          {!isLoggedIn ? (
            <div className="hidden md:flex items-center gap-2">
              <Link
                to="/login"
                className="px-3 py-1.5 rounded-xl border text-sm hover:bg-gray-50"
              >
                Connexion
              </Link>
              <Link
                to="/signup"
                className="px-3 py-1.5 rounded-xl border text-sm hover:bg-gray-50"
              >
                Inscription
              </Link>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-3" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setOpenUser((v) => !v)}
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
                  {/* Switch rôle (dans le menu user) */}
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
            "absolute inset-0 bg-black/50 transition-opacity",
            openMobile ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setOpenMobile(false)}
        />
        <div
          className={cn(
            "absolute right-0 top-0 h-full w-80 max-w-[85%] bg-white border-l shadow-2xl p-4 transition-transform",
            openMobile ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2" onClick={() => setOpenMobile(false)}>
              <img src={logo} alt="TickRace" className="h-7 w-auto" />
              <span className="font-bold tracking-tight">
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

          {/* User bloc */}
          <div className="mt-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold">
              {avatarLetter}
            </div>
            <div className="text-sm">{isLoggedIn ? email : "Invité"}</div>
          </div>

          {/* Liens communs */}
          <div className="mt-4 grid gap-1">
            {commonLeft.map((item) => (
              <LinkItem key={item.to} to={item.to} className="text-base">
                {item.label}
              </LinkItem>
            ))}

            {/* Liens rôle */}
            {roleMenu
              .filter((i) => (i.priv ? isLoggedIn : true))
              .map((i) =>
                i.orange ? (
                  <OrangeUnderlineLinkItem
                    key={i.to}
                    to={i.to}
                    onClick={
                      i.forceOrg
                        ? () => {
                            setRole("organisateur");
                            navigate(i.to);
                          }
                        : undefined
                    }
                  >
                    {i.label}
                  </OrangeUnderlineLinkItem>
                ) : (
                  <RoleAwareItem key={i.to} item={i} />
                )
              )}

            {/* Admin */}
            {isAdmin && (
              <>
                <LinkItem to="/admin">Admin</LinkItem>
                <LinkItem to="/admin/courses">Courses Admin</LinkItem>
                <LinkItem to="/admin/payouts">Reversements</LinkItem>
                <LinkItem to="/admin/inscriptions">Inscriptions</LinkItem>
              </>
            )}
          </div>

          {/* Auth + Switch rôle (mobile) */}
          <div className="mt-4 grid gap-2">
            {!isLoggedIn ? (
              <>
                <Link
                  to="/login"
                  className="px-3 py-2 rounded-xl border text-center hover:bg-gray-50"
                  onClick={() => setOpenMobile(false)}
                >
                  Connexion
                </Link>
                <Link
                  to="/signup"
                  className="px-3 py-2 rounded-xl border text-center hover:bg-gray-50"
                  onClick={() => setOpenMobile(false)}
                >
                  Inscription
                </Link>
              </>
            ) : (
              <>
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

                <button
                  onClick={handleLogout}
                  className="w-full px-3 py-2 rounded-xl border text-center hover:bg-gray-50"
                >
                  Déconnexion
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

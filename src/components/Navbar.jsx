// src/components/Navbar.jsx
import React, { useEffect, useRef, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import { supabase } from "../supabase";
import useIsAdmin from "../hooks/useIsAdmin";
import {
  Home, Map, PlusCircle, Users2, UserCircle2, Menu, X
} from "lucide-react";

function cn(...cls) { return cls.filter(Boolean).join(" "); }

export default function Navbar() {
  const { session, currentRole, switchRole, setCurrentRole } = useUser();
  const isLoggedIn = !!session;
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const location = useLocation();

  const [openMobile, setOpenMobile] = useState(false);
  const [openUser, setOpenUser] = useState(false);

  const setRole = (role) => {
    if (typeof switchRole === "function") switchRole(role);
    else if (typeof setCurrentRole === "function") setCurrentRole(role);
  };

  useEffect(() => { setOpenMobile(false); setOpenUser(false); }, [location.pathname]);

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/login"); };
  const avatarLetter = session?.user?.email?.[0]?.toUpperCase?.() || "U";
  const email = session?.user?.email || "";

  // --- MENUS
  const menuCoureur = [
    { to: "/courses", label: "Courses" },
    { to: "/mesinscriptions", label: "Mes inscriptions", priv: true },
    { to: "/monprofilcoureur", label: "Mon profil", priv: true },
  ];
  const menuOrganisateur = [
    { to: "/organisateur/mon-espace", label: "Mon espace", priv: true },
    { to: "/organisateur/nouvelle-course", label: "Créer une course", priv: true, forceOrg: true },
    { to: "/monprofilorganisateur", label: "Mon profil orga", priv: true },
  ];
  const activeMenu = currentRole === "organisateur" ? menuOrganisateur : menuCoureur;

  const LinkItem = ({ to, children }) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "px-3 py-2 rounded-xl text-sm transition",
          isActive ? "bg-black text-white shadow" : "hover:bg-gray-100"
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

  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
        {/* Left: logo + desktop nav */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <img src="/assets/logo.png" alt="TickRace" className="h-8 w-8 rounded-md" />
            <span className="font-extrabold tracking-tight">TickRace</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-2">
            <LinkItem to="/courses">Courses</LinkItem>
            {activeMenu
              .filter((i) => (i.priv ? isLoggedIn : true))
              .map((i) => <RoleAwareItem key={i.to} item={i} />)}
            {isAdmin && <LinkItem to="/admin">Admin</LinkItem>}
            <LinkItem to="/fonctionnalites">Fonctionnalités</LinkItem>
          </nav>
        </div>

        {/* Right: auth buttons desktop */}
        <div className="hidden md:flex items-center gap-2">
          {!isLoggedIn ? (
            <>
              <Link to="/login" className="px-3 py-1.5 rounded-xl border text-sm hover:bg-gray-50">Connexion</Link>
              <Link to="/signup" className="px-3 py-1.5 rounded-xl bg-black text-white text-sm hover:brightness-110">Inscription</Link>
            </>
          ) : (
            <Link to="/monprofilcoureur" className="inline-flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-100">
              <div className="w-8 h-8 rounded-full bg-gray-900 text-white grid place-items-center text-sm font-bold">{avatarLetter}</div>
              <div className="hidden lg:block text-sm max-w-[220px] truncate">{email}</div>
            </Link>
          )}
        </div>

        {/* Mobile: burger */}
        <button
          className="md:hidden p-2 rounded-xl hover:bg-gray-100"
          onClick={() => setOpenMobile((v) => !v)}
          aria-label="Ouvrir le menu"
        >
          {openMobile ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      <div className={cn(
        "md:hidden fixed inset-0 z-40 transition",
        openMobile ? "pointer-events-auto" : "pointer-events-none"
      )}>
        <div
          className={cn("absolute inset-0 bg-black/30 transition-opacity",
            openMobile ? "opacity-100" : "opacity-0")}
          onClick={() => setOpenMobile(false)}
        />
        <div className={cn(
          "absolute right-0 top-0 h-full w-[92%] max-w-[380px] bg-white border-l shadow-xl p-4 transition-transform",
          openMobile ? "translate-x-0" : "translate-x-full"
        )}>
          {/* Header drawer */}
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src="/assets/logo.png" alt="TickRace" className="h-8 w-8 rounded-md" />
              <span className="font-extrabold">TickRace</span>
            </Link>
            <button onClick={() => setOpenMobile(false)} className="p-2 rounded-xl hover:bg-gray-100" aria-label="Fermer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick role switch */}
          <div className="mt-3 p-1 rounded-2xl border flex">
            <button
              className={cn("flex-1 px-3 py-1.5 rounded-xl text-sm",
                currentRole === "coureur" ? "bg-black text-white" : "hover:bg-gray-100")}
              onClick={() => setRole("coureur")}
            >
              Coureur
            </button>
            <button
              className={cn("flex-1 px-3 py-1.5 rounded-xl text-sm",
                currentRole === "organisateur" ? "bg-black text-white" : "hover:bg-gray-100")}
              onClick={() => setRole("organisateur")}
            >
              Organisateur
            </button>
          </div>

          {/* Nav items large touch targets */}
          <div className="mt-4 grid gap-2">
            <NavLink to="/courses" className="px-4 py-3 rounded-xl bg-gray-50 border hover:bg-gray-100">🗺️ Explorer les courses</NavLink>
            {activeMenu
              .filter((i) => (i.priv ? isLoggedIn : true))
              .map((i) => (
                i.forceOrg ? (
                  <button
                    key={i.to}
                    onClick={() => { setRole("organisateur"); navigate(i.to); }}
                    className="text-left px-4 py-3 rounded-xl bg-gray-50 border hover:bg-gray-100"
                  >
                    ⚑ {i.label}
                  </button>
                ) : (
                  <NavLink key={i.to} to={i.to} className="px-4 py-3 rounded-xl bg-gray-50 border hover:bg-gray-100">
                    {i.label}
                  </NavLink>
                )
              ))}
            {isAdmin && <NavLink to="/admin" className="px-4 py-3 rounded-xl bg-gray-50 border hover:bg-gray-100">🛡️ Admin</NavLink>}
            <NavLink to="/fonctionnalites" className="px-4 py-3 rounded-xl bg-gray-50 border hover:bg-gray-100">✨ Fonctionnalités</NavLink>
          </div>

          {/* Auth actions */}
          <div className="mt-5">
            {!isLoggedIn ? (
              <div className="grid gap-2">
                <Link to="/login" className="px-4 py-3 rounded-xl border text-center hover:bg-gray-50">Connexion</Link>
                <Link to="/signup" className="px-4 py-3 rounded-xl bg-black text-white text-center hover:brightness-110">Inscription</Link>
              </div>
            ) : (
              <button onClick={handleLogout} className="w-full px-4 py-3 rounded-xl border text-center hover:bg-gray-50">
                Déconnexion
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Tab Bar (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-white">
        <div className="mx-auto max-w-7xl grid grid-cols-5">
          <Tab to="/" Icon={Home} label="Accueil" />
          <Tab to="/courses?view=map" Icon={Map} label="Carte" />
          <CenterCTA
            onClick={() => { setRole("organisateur"); navigate("/organisateur/nouvelle-course"); }}
            Icon={PlusCircle}
            label="Créer"
          />
          <Tab to="/community" Icon={Users2} label="Communauté" />
          <Tab to={isLoggedIn ? "/monprofilcoureur" : "/login"} Icon={UserCircle2} label="Profil" />
        </div>
      </nav>
    </header>
  );
}

function Tab({ to, Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn("flex flex-col items-center justify-center py-2 text-xs",
          "hover:bg-gray-50",
          isActive ? "text-orange-600" : "text-gray-700")
      }
    >
      <Icon className="w-5 h-5" />
      <span className="mt-0.5">{label}</span>
    </NavLink>
  );
}

function CenterCTA({ onClick, Icon, label }) {
  return (
    <button
      onClick={onClick}
      className="relative -mt-6 mx-auto grid place-items-center w-14 h-14 rounded-full bg-orange-600 text-white shadow-lg active:translate-y-px"
      aria-label={label}
      title={label}
    >
      <Icon className="w-6 h-6" />
    </button>
  );
}

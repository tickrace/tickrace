// src/components/Navbar.jsx
import React, { useState, useEffect } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { Menu, X, UserCircle2, ChevronDown } from "lucide-react";
import { useUser } from "../contexts/UserContext";

const navItemBase =
  "inline-flex items-center rounded-xl px-3.5 py-2 text-sm font-medium transition-colors select-none";
const navItemIdle = "text-gray-700 hover:bg-gray-100";
const navItemActive = "bg-gray-900 text-white hover:bg-gray-900";

function NavItem({ to, children, onClick }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [navItemBase, isActive ? navItemActive : navItemIdle].join(" ")
      }
      onClick={onClick}
    >
      {children}
    </NavLink>
  );
}

/**
 * Props:
 * - mode: "coureur" | "organisateur"
 * - setMode: (m) => void
 * - showAdmin: boolean
 */
export default function Navbar({ mode = "coureur", setMode, showAdmin = false }) {
  const [open, setOpen] = useState(false);
  const { user: ctxUser, session } = useUser(); // <— récupère aussi session
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  const isOrganisateur = mode === "organisateur";

  // Email robuste selon ce que fournit ton UserContext (Supabase)
  const email =
    ctxUser?.email ??
    ctxUser?.user_metadata?.email ??
    session?.user?.email ??
    null;

  // Liens communs (gauche)
  const leftLinks = [
    { to: "/", label: "Accueil" },
    { to: "/fonctionnalites", label: "Fonctionnalités" },
    { to: "/courses", label: "Courses" },
  ];

  // Liens selon mode
  const rightLinksCoureur = [
    { to: "/mesinscriptions", label: "Mes inscriptions" },
    { to: "/monprofilcoureur", label: "Mon profil" },
  ];

  const rightLinksOrganisateur = [
    { to: "/organisateur/mon-espace", label: "Mon espace" },
    { to: "/organisateur/nouvelle-course", label: "Créer une course" },
    { to: "/monprofilorganisateur", label: "Mon profil" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <nav className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo + gauche */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="Tickrace" className="h-8 w-auto" />
            </Link>
            <div className="hidden md:flex md:items-center md:gap-1">
              {leftLinks.map((item) => (
                <NavItem key={item.to} to={item.to}>
                  {item.label}
                </NavItem>
              ))}
            </div>
          </div>

          {/* Droite desktop */}
          <div className="hidden md:flex md:items-center md:gap-3 md:flex-nowrap">
            {(isOrganisateur ? rightLinksOrganisateur : rightLinksCoureur).map(
              (item) => (
                <NavItem key={item.to} to={item.to}>
                  {item.label}
                </NavItem>
              )
            )}

            {showAdmin && (
              <div className="relative group">
                <button type="button" className={[navItemBase, navItemIdle].join(" ")}>
                  Admin
                  <ChevronDown className="ml-1 h-4 w-4" />
                </button>
                <div className="invisible absolute right-0 mt-2 w-48 rounded-xl border border-gray-200 bg-white p-2 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
                  <Link
                    to="/admin"
                    className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Accueil admin
                  </Link>
                  <Link
                    to="/admin/dashboard"
                    className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/admin/courses"
                    className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Courses
                  </Link>
                  <Link
                    to="/admin/inscriptions"
                    className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Inscriptions
                  </Link>
                  <Link
                    to="/admin/payouts"
                    className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Payouts
                  </Link>
                </div>
              </div>
            )}

            {/* ——— Bloc email + sélecteur de mode (desktop) ——— */}
            {email ? (
              <div className="flex flex-col items-end shrink-0">
                <span
                  className="max-w-[260px] truncate text-sm text-gray-700"
                  title={email}
                >
                  {email}
                </span>
                <div className="mt-1 flex gap-2">
                  <button
                    onClick={() => setMode?.("coureur")}
                    className={`px-2 py-1 rounded-md text-xs ${
                      mode === "coureur"
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Coureur
                  </button>
                  <button
                    onClick={() => setMode?.("organisateur")}
                    className={`px-2 py-1 rounded-md text-xs ${
                      mode === "organisateur"
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Organisateur
                  </button>
                </div>
              </div>
            ) : (
              <Link
                to="/login"
                className={[navItemBase, navItemIdle, "shrink-0"].join(" ")}
                title="Se connecter"
              >
                <UserCircle2 className="h-5 w-5" />
              </Link>
            )}
          </div>

          {/* Burger mobile */}
          <button
            className="inline-flex items-center justify-center rounded-xl p-2 text-gray-700 hover:bg-gray-100 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Ouvrir le menu"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Panel mobile */}
        {open && (
          <div className="md:hidden">
            <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-lg">
              {[...leftLinks, ...(isOrganisateur ? rightLinksOrganisateur : rightLinksCoureur)].map(
                (item) => (
                  <NavItem key={item.to} to={item.to} onClick={() => setOpen(false)}>
                    {item.label}
                  </NavItem>
                )
              )}

              {showAdmin && (
                <>
                  <div className="mt-1 border-t border-gray-200" />
                  <Link
                    to="/admin"
                    onClick={() => setOpen(false)}
                    className={[navItemBase, navItemIdle, "w-full"].join(" ")}
                  >
                    Admin
                  </Link>
                </>
              )}

              {/* ——— Bloc email + sélecteur (mobile) ——— */}
              <div className="mt-2 border-t border-gray-200 pt-2">
                {email ? (
                  <>
                    <span className="block text-sm text-gray-700 mb-2 truncate" title={email}>
                      {email}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setMode?.("coureur");
                          setOpen(false);
                        }}
                        className={`flex-1 px-2 py-1 rounded-md text-xs ${
                          mode === "coureur"
                            ? "bg-gray-900 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        Coureur
                      </button>
                      <button
                        onClick={() => {
                          setMode?.("organisateur");
                          setOpen(false);
                        }}
                        className={`flex-1 px-2 py-1 rounded-md text-xs ${
                          mode === "organisateur"
                            ? "bg-gray-900 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        Organisateur
                      </button>
                    </div>
                  </>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setOpen(false)}
                    className={[navItemBase, navItemIdle, "w-full"].join(" ")}
                  >
                    <UserCircle2 className="mr-2 h-5 w-5" />
                    Se connecter
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

// src/App.jsx
import Fonctionnalites from "./pages/Fonctionnalites";

import React from "react";
import Home from "./pages/Home";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import NouvelleCourse from "./pages/NouvelleCourse";
import ErrorBoundary from "./components/ErrorBoundary";
import ModifierCourse from "./pages/ModifierCourse";
import ListeFormats from "./pages/ListeFormats";
import InscriptionCourse from "./pages/InscriptionCourse";
import ProfilCoureur from "./pages/ProfilCoureur";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import MonProfilCoureur from "./pages/MonProfilCoureur";
import MonProfilOrganisateur from "./pages/MonProfilOrganisateur";
import { UserProvider, useUser } from "./contexts/UserContext";
import MonEspaceOrganisateur from "./pages/MonEspaceOrganisateur";
import ListeInscriptions from "./pages/ListeInscriptions";
import AuthRedirectWrapper from "./components/AuthRedirectWrapper";
import { Toaster } from "react-hot-toast";
import DetailsCoureur from "./pages/DetailsCoureur";
import ResetPassword from "./pages/ResetPassword";
import ForgotPassword from "./pages/ForgotPassword";
import MonInscription from "./pages/MonInscription";
import MesInscriptions from "./pages/MesInscriptions";
import Merci from "./pages/Merci";
import PaiementAnnule from "./pages/PaiementAnnule";
import CGVOrganisateurs from "./pages/legal/CGVOrganisateurs";
import Remboursements from "./pages/legal/Remboursements";
import CharteOrganisateur from "./pages/legal/CharteOrganisateur";

import AdminRoute from "./components/AdminRoute";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminCourses from "./pages/admin/AdminCourses";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminInscriptions from "./pages/admin/AdminInscriptions";
import Payouts from "./pages/admin/Payouts";
import AdminHome from "./pages/admin";

// ✅ protège les routes pour utilisateurs connectés
import ProtectedRoute from "./components/ProtectedRoute";

function AppContent() {
  const { currentRole } = useUser();
  const location = useLocation();

  // Routes qui basculent en mode organisateur dans la Navbar
  const isOrganisateurRoute = /^\/(organisateur|modifier-course|admin)/.test(location.pathname);

  // Si tu as un vrai flag admin dans ton UserContext, remplace par le bon test.
  const showAdmin = currentRole === "admin";

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        key={currentRole}
        mode={isOrganisateurRoute ? "organisateur" : "coureur"}
        showAdmin={showAdmin}
      />
      <main className="flex-1">
        <Routes>
          {/* Public */}
          <Route path="/fonctionnalites" element={<Fonctionnalites />} />

          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<AdminHome />} />

          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/formats" element={<ListeFormats />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/merci" element={<Merci />} />
          <Route path="/paiement-annule" element={<PaiementAnnule />} />

          {/* Légal */}
          <Route path="/legal/cgv-organisateurs" element={<CGVOrganisateurs />} />
          <Route path="/legal/remboursements" element={<Remboursements />} />
          <Route path="/legal/charte-organisateur" element={<CharteOrganisateur />} />

          {/* Protégées */}
          <Route
            path="/inscription/:courseId"
            element={<ProtectedRoute><InscriptionCourse /></ProtectedRoute>}
          />
          <Route
            path="/mon-inscription/:id"
            element={<ProtectedRoute><MonInscription /></ProtectedRoute>}
          />
          <Route
            path="/mesinscriptions"
            element={<ProtectedRoute><MesInscriptions /></ProtectedRoute>}
          />
          <Route
            path="/monprofilcoureur"
            element={<ProtectedRoute><MonProfilCoureur /></ProtectedRoute>}
          />
          <Route
            path="/monprofilorganisateur"
            element={<ProtectedRoute><MonProfilOrganisateur /></ProtectedRoute>}
          />
          <Route
            path="/organisateur/mon-espace"
            element={<ProtectedRoute><MonEspaceOrganisateur /></ProtectedRoute>}
          />
          <Route
            path="/mon-espace-organisateur"
            element={<ProtectedRoute><MonEspaceOrganisateur /></ProtectedRoute>}
          />
          <Route
            path="/organisateur/inscriptions/:format_id"
            element={<ProtectedRoute><ListeInscriptions /></ProtectedRoute>}
          />
          <Route
            path="/organisateur/nouvelle-course"
            element={<ProtectedRoute><NouvelleCourse /></ProtectedRoute>}
          />
          <Route
            path="/modifier-course/:id"
            element={<ProtectedRoute><ModifierCourse /></ProtectedRoute>}
          />
          <Route
            path="/details-coureur/:id"
            element={<ProtectedRoute><DetailsCoureur /></ProtectedRoute>}
          />
          <Route
            path="/coureur"
            element={<ProtectedRoute><ProfilCoureur /></ProtectedRoute>}
          />

          {/* Admin */}
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <AdminLayout><AdminDashboard /></AdminLayout>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/courses"
            element={
              <AdminRoute>
                <AdminLayout><AdminCourses /></AdminLayout>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/payouts"
            element={
              <AdminRoute>
                <AdminLayout><Payouts /></AdminLayout>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/inscriptions"
            element={
              <AdminRoute>
                <AdminLayout><AdminInscriptions /></AdminLayout>
              </AdminRoute>
            }
          />

          {/* Fallback */}
          <Route
            path="*"
            element={
              <div style={{ padding: 24 }}>
                <h2>Page non trouvée</h2>
                <p>Cette URL ne correspond à aucune route connue.</p>
              </div>
            }
          />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
(Le reste de ton fichier App reste identique.)

2) Navbar.jsx alignée sur tes routes (même design partout)
Remplace ta Navbar.jsx par ceci pour matcher exactement tes chemins et garder le même style pour tous les boutons (sans souligné) :

jsx
Copier
Modifier
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
 * Props externes:
 * - mode: "coureur" | "organisateur"
 * - showAdmin: boolean
 */
export default function Navbar({ mode = "coureur", showAdmin = false }) {
  const [open, setOpen] = useState(false);
  const { user } = useUser();
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  const isOrganisateur = mode === "organisateur";

  // Liens communs (gauche)
  const leftLinks = [
    { to: "/", label: "Accueil" },
    { to: "/fonctionnalites", label: "Fonctionnalités" },
    { to: "/courses", label: "Courses" },
  ];

  // Liens de droite selon mode
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
                <NavItem key={item.to} to={item.to}>{item.label}</NavItem>
              ))}
            </div>
          </div>

          {/* Droite desktop */}
          <div className="hidden md:flex md:items-center md:gap-1">
            {(isOrganisateur ? rightLinksOrganisateur : rightLinksCoureur).map(
              (item) => (
                <NavItem key={item.to} to={item.to}>{item.label}</NavItem>
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

            <Link
              to={isOrganisateur ? "/monprofilorganisateur" : "/monprofilcoureur"}
              title="Mon profil"
              className={[navItemBase, navItemIdle].join(" ")}
            >
              <UserCircle2 className="h-5 w-5" />
            </Link>
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
                    Accueil admin
                  </Link>
                  <Link
                    to="/admin/dashboard"
                    onClick={() => setOpen(false)}
                    className={[navItemBase, navItemIdle, "w-full"].join(" ")}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/admin/courses"
                    onClick={() => setOpen(false)}
                    className={[navItemBase, navItemIdle, "w-full"].join(" ")}
                  >
                    Courses
                  </Link>
                  <Link
                    to="/admin/inscriptions"
                    onClick={() => setOpen(false)}
                    className={[navItemBase, navItemIdle, "w-full"].join(" ")}
                  >
                    Inscriptions
                  </Link>
                  <Link
                    to="/admin/payouts"
                    onClick={() => setOpen(false)}
                    className={[navItemBase, navItemIdle, "w-full"].join(" ")}
                  >
                    Payouts
                  </Link>
                </>
              )}

              <div className="mt-1 border-t border-gray-200" />
              <Link
                to={isOrganisateur ? "/monprofilorganisateur" : "/monprofilcoureur"}
                onClick={() => setOpen(false)}
                className={[navItemBase, navItemIdle, "w-full"].join(" ")}
              >
                <UserCircle2 className="mr-2 h-5 w-5" />
                Mon profil
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
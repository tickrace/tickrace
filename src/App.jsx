// src/App.jsx
import Fonctionnalites from "./pages/Fonctionnalites";
import BenevoleInscription from "./pages/BenevoleInscription";

import React, { useEffect, useMemo, useState } from "react";
import Home from "./pages/Home";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
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

import ProtectedRoute from "./components/ProtectedRoute";

function AppContent() {
  const { currentRole } = useUser();
  const location = useLocation();

  // --- Gestion du mode (coureur | organisateur) avec persistance ---
  const initialMode = useMemo(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("tickraceMode") : null;
    if (saved === "coureur" || saved === "organisateur") return saved;
    // défaut: coureur
    return "coureur";
  }, []);

  const [mode, setMode] = useState(initialMode);

  useEffect(() => {
    try {
      localStorage.setItem("tickraceMode", mode);
    } catch {}
  }, [mode]);

  // Si tu veux forcer automatiquement le mode selon la route, dé-commente:
  // useEffect(() => {
  //   const isOrga = /^\/(organisateur|modifier-course|admin)/.test(location.pathname);
  //   setMode(isOrga ? "organisateur" : "coureur");
  // }, [location.pathname]);

  const showAdmin = currentRole === "admin";

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        key={`${currentRole}-${mode}`}
        mode={mode}
        setMode={setMode}
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
<Route path="/benevoles/:courseId" element={<BenevoleInscription />} />

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
          {/* Alias anti-404 */}
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

          {/* Édition protégée */}
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

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <AuthRedirectWrapper>
          <Toaster position="top-right" />
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </AuthRedirectWrapper>
      </BrowserRouter>
    </UserProvider>
  );
}

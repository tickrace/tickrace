// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import Contact from "./pages/Contact";

import { UserProvider, useUser } from "./contexts/UserContext";
import AuthRedirectWrapper from "./components/AuthRedirectWrapper";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ErrorBoundary from "./components/ErrorBoundary";
import { Toaster } from "react-hot-toast";

import Home from "./pages/Home";
import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import ListeFormats from "./pages/ListeFormats";
import InscriptionCourse from "./pages/InscriptionCourse";
import ProfilCoureur from "./pages/ProfilCoureur";
import DetailsCoureur from "./pages/DetailsCoureur";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import ForgotPassword from "./pages/ForgotPassword";
import MonInscription from "./pages/MonInscription";
import MesInscriptions from "./pages/MesInscriptions";
import MonProfilCoureur from "./pages/MonProfilCoureur";
import MonProfilOrganisateur from "./pages/MonProfilOrganisateur";
import MonEspaceOrganisateur from "./pages/MonEspaceOrganisateur";
import ListeInscriptions from "./pages/ListeInscriptions";
import UpsertCourse from "./pages/UpsertCourse";
import Fonctionnalites from "./pages/Fonctionnalites";
import BenevoleInscription from "./pages/BenevoleInscription";
import ListeBenevoles from "./pages/ListeBenevoles";
import Merci from "./pages/Merci";
import PaiementAnnule from "./pages/PaiementAnnule";

import CGVOrganisateurs from "./pages/legal/CGVOrganisateurs";
import CGVCoureurs from "./pages/legal/CGVCoureurs";
import Remboursements from "./pages/legal/Remboursements";
import CharteOrganisateur from "./pages/legal/CharteOrganisateur";
import MentionsLegales from "./pages/legal/MentionsLegales";
import Confidentialite from "./pages/legal/Confidentialite";
import CreerUneCourse from "./pages/help/CreerUneCourse";

import FAQ from "./pages/legal/FAQ";

import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCourses from "./pages/admin/AdminCourses";
import AdminInscriptions from "./pages/admin/AdminInscriptions";
import Payouts from "./pages/admin/Payouts";
import AdminHome from "./pages/admin";
import AdminCategories from "./pages/admin/AdminCategories";

import MemberDetails from "./pages/MemberDetails";
import MonInscriptionEquipe from "./pages/MonInscriptionEquipe";
// En haut du fichier, avec les autres imports de pages
import ClassementArrivees from "./pages/ClassementArrivees";

function AppContent() {
  const { currentRole } = useUser();
  const location = useLocation();

  // --- Gestion du mode (coureur | organisateur) avec persistance ---
  const initialMode = useMemo(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("tickraceMode") : null;
    if (saved === "coureur" || saved === "organisateur") return saved;
    return "coureur";
  }, []);

  const [mode, setMode] = useState(initialMode);

  useEffect(() => {
    try {
      localStorage.setItem("tickraceMode", mode);
    } catch {}
  }, [mode]);

  const showAdmin = currentRole === "admin";

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar key={`${currentRole}-${mode}`} mode={mode} setMode={setMode} showAdmin={showAdmin} />
      <main className="flex-1">
        <Routes>
          {/* Public */}
          <Route path="/contact" element={<Contact />} />

          <Route path="/" element={<Home />} />
          <Route path="/fonctionnalites" element={<Fonctionnalites />} />
          <Route path="/help/creer-une-course" element={<CreerUneCourse />} />
<Route path="/help" element={<Navigate to="/help/creer-une-course" replace />} />

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
          <Route path="/organisateur/benevoles" element={<ListeBenevoles />} />


          {/* Légal */}
          <Route path="/legal/cgv-organisateurs" element={<CGVOrganisateurs />} />
          <Route path="/legal/cgv-coureurs" element={<CGVCoureurs />} />
          <Route path="/legal/remboursements" element={<Remboursements />} />
          <Route path="/legal/charte-organisateur" element={<CharteOrganisateur />} />
<Route path="/legal/mentions-legales" element={<MentionsLegales />} />
<Route path="/legal/confidentialite" element={<Confidentialite />} />
<Route path="/legal/faq" element={<FAQ />} />

          

          {/* Protégées */}
          <Route
  path="/member-details/:courseId/:formatId/:teamIdx/:memberIdx"
  element={
    <ProtectedRoute>
      
      <MemberDetails />
    </ProtectedRoute>
  }
/>


          <Route
            path="/inscription/:courseId"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <InscriptionCourse />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/mon-inscription/:id"
            element={
              <ProtectedRoute>
                <MonInscription />
              </ProtectedRoute>
            }
          />
        <Route
  path="/mon-inscription-equipe/:groupeId"
  element={
    <ProtectedRoute>
      <MonInscriptionEquipe />
    </ProtectedRoute>
  }
/>

          <Route
            path="/mesinscriptions"
            element={
              <ProtectedRoute>
                <MesInscriptions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/monprofilcoureur"
            element={
              <ProtectedRoute>
                <MonProfilCoureur />
              </ProtectedRoute>
            }
          />
          <Route
            path="/monprofilorganisateur"
            element={
              <ProtectedRoute>
                <MonProfilOrganisateur />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organisateur/mon-espace"
            element={
              <ProtectedRoute>
                <MonEspaceOrganisateur />
              </ProtectedRoute>
            }
          />
          {/* Alias anti-404 */}
          <Route
            path="/mon-espace-organisateur"
            element={
              <ProtectedRoute>
                <MonEspaceOrganisateur />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organisateur/inscriptions/:format_id"
            element={
              <ProtectedRoute>
                <ListeInscriptions />
              </ProtectedRoute>
            }
          />

          {/* Création/édition protégées */}
          <Route
            path="/organisateur/creer-course"
            element={
              <ProtectedRoute>
                <UpsertCourse />
              </ProtectedRoute>
            }
          />
          <Route
            path="/modifier-course/:id"
            element={
              <ProtectedRoute>
                <UpsertCourse />
              </ProtectedRoute>
            }
          />
          <Route
  path="/organisateur/classement/:courseId"
  element={
    <ProtectedRoute>
      <ClassementArrivees />
    </ProtectedRoute>
  }
/>
          {/* Redirection propre depuis ancienne URL */}
          <Route path="/organisateur/nouvelle-course" element={<Navigate to="/organisateur/creer-course" replace />} />

          <Route
            path="/details-coureur/:id"
            element={
              <ProtectedRoute>
                <DetailsCoureur />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coureur"
            element={
              <ProtectedRoute>
                <ProfilCoureur />
              </ProtectedRoute>
            }
          />

          {/* Admin */}
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <AdminLayout>
                  <AdminDashboard />
                </AdminLayout>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/courses"
            element={
              <AdminRoute>
                <AdminLayout>
                  <AdminCourses />
                </AdminLayout>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/payouts"
            element={
              <AdminRoute>
                <AdminLayout>
                  <Payouts />
                </AdminLayout>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/inscriptions"
            element={
              <AdminRoute>
                <AdminLayout>
                  <AdminInscriptions />
                </AdminLayout>
              </AdminRoute>
            }
          />
                    <Route
            path="/admin/categories"
            element={
              <AdminRoute>
                <AdminLayout>
                  <AdminCategories />
                </AdminLayout>
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

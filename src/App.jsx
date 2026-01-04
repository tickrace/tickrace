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

/* ----------------------------- Pages ----------------------------- */
// Public

import Home from "./pages/Home";
import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import ListeFormats from "./pages/ListeFormats";
import Fonctionnalites from "./pages/Fonctionnalites";
import CreerUneCourse from "./pages/help/CreerUneCourse";
//TEST 
import IndexTest from "./pages/IndexTest";
import AdminTest from "./pages/AdminTest";
import OrganisateurTest from "./pages/OrganisateurTest";
import ClientTest from "./pages/ClientTest";
// Auth
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import ForgotPassword from "./pages/ForgotPassword";
import AuthCallback from "./pages/AuthCallback";

// Parcours utilisateur
import InscriptionCourse from "./pages/InscriptionCourse";
import MonInscription from "./pages/MonInscription";
import MonInscriptionEquipe from "./pages/MonInscriptionEquipe";
import MesInscriptions from "./pages/MesInscriptions";
import ProfilCoureur from "./pages/ProfilCoureur";
import DetailsCoureur from "./pages/DetailsCoureur";
import MemberDetails from "./pages/MemberDetails";
import Tirage from "./pages/Tirage";


// Organisateur
import OrganisateurLoterieCourse from "./pages/OrganisateurLoterieCourse";
import TirageAuSort from "./pages/TirageAuSort";
import MonProfilOrganisateur from "./pages/MonProfilOrganisateur";
import MonEspaceOrganisateur from "./pages/MonEspaceOrganisateur";
import UpsertCourse from "./pages/UpsertCourse";
import ListeInscriptions from "./pages/ListeInscriptions";
import ReglementAssistant from "./pages/ReglementAssistant";
import ChecklistAssistant from "./pages/ChecklistAssistant";
import ClassementArrivees from "./pages/ClassementArrivees";
import Compta from "./pages/organisateur/Compta";
import WaitlistAccept from "./pages/WaitlistAccept";

// ✅ NOUVEAU : Partenaires / Sponsors (page organisateur)
import CoursePartenaires from "./pages/CoursePartenaires";


// Bénévoles
import BenevoleInscription from "./pages/BenevoleInscription";
import ListeBenevoles from "./pages/ListeBenevoles";
import EspaceBenevole from "./pages/EspaceBenevole";
import PlanningBenevoles from "./pages/PlanningBenevoles";

// Paiements
import Merci from "./pages/Merci";
import PaiementAnnule from "./pages/PaiementAnnule";

// Légal
import CGVOrganisateurs from "./pages/legal/CGVOrganisateurs";
import CGVCoureurs from "./pages/legal/CGVCoureurs";
import Remboursements from "./pages/legal/Remboursements";
import CharteOrganisateur from "./pages/legal/CharteOrganisateur";
import MentionsLegales from "./pages/legal/MentionsLegales";
import Confidentialite from "./pages/legal/Confidentialite";
import FAQ from "./pages/legal/FAQ";

// Admin
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCourses from "./pages/admin/AdminCourses";
import AdminInscriptions from "./pages/admin/AdminInscriptions";
import Payouts from "./pages/admin/Payouts";
import AdminHome from "./pages/admin";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminContact from "./pages/admin/AdminContact";
import AdminALaUne from "./pages/admin/AdminALaUne";

// Profils
import MonProfilCoureur from "./pages/MonProfilCoureur";

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
          {/* ============================= PUBLIC ============================= */}
          <Route path="/waitlist/accept/*" element={<WaitlistAccept />} />
<Route path="/tirage/:formatId" element={<Tirage />} />

          <Route path="/" element={<Home />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/formats" element={<ListeFormats />} />
          <Route path="/fonctionnalites" element={<Fonctionnalites />} />
          <Route path="/contact" element={<Contact />} />
<Route path="/benevole/:courseId" element={<EspaceBenevole />} />
          {/* Help */}
          <Route path="/help/creer-une-course" element={<CreerUneCourse />} />
          <Route path="/help" element={<Navigate to="/help/creer-une-course" replace />} />

          {/* Pages paiement */}
          <Route path="/merci" element={<Merci />} />
          <Route path="/paiement-annule" element={<PaiementAnnule />} />

          {/* Bénévoles (public) */}
          <Route path="/test" element={<IndexTest />} />
<Route path="/admintest" element={<AdminTest />} />
<Route path="/organisateurtest" element={<OrganisateurTest />} />
<Route path="/clienttest" element={<ClientTest />} />

          <Route path="/benevoles/:courseId" element={<BenevoleInscription />} />

          {/* ============================== AUTH ============================== */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* =============================== LEGAL ============================ */}
          <Route path="/legal/cgv-organisateurs" element={<CGVOrganisateurs />} />
          <Route path="/legal/cgv-coureurs" element={<CGVCoureurs />} />
          <Route path="/legal/remboursements" element={<Remboursements />} />
          <Route path="/legal/charte-organisateur" element={<CharteOrganisateur />} />
          <Route path="/legal/mentions-legales" element={<MentionsLegales />} />
          <Route path="/legal/confidentialite" element={<Confidentialite />} />
          <Route path="/legal/faq" element={<FAQ />} />

          {/* ============================ PROTEGEES =========================== */}
          {/* Détails membre équipe */}
          <Route
            path="/member-details/:courseId/:formatId/:teamIdx/:memberIdx"
            element={
              <ProtectedRoute>
                <MemberDetails />
              </ProtectedRoute>
            }
          />

          {/* Tunnel inscription 
          <Route
            path="/inscription/:courseId"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <InscriptionCourse />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />*/}

          {/* Mon inscription */}
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

          {/* Mes inscriptions */}
          <Route
            path="/mesinscriptions"
            element={
           //   <ProtectedRoute>
                <MesInscriptions />
             // </ProtectedRoute>
            }
          />

          {/* Profils */}
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

          {/* ============================ ORGANISATEUR ======================== */}
          
<Route
  path="/organisateur/inscriptions/:courseId"
  element={
    <ProtectedRoute>
      <ListeInscriptions />
    </ProtectedRoute>
  }
/>

          <Route
  path="/organisateur/loterie/:courseId"
  element={
    <ProtectedRoute>
      <OrganisateurLoterieCourse />
    </ProtectedRoute>
  }
/>
          <Route
  path="/organisateur/tirage/:formatId"
  element={
    <ProtectedRoute>
      <TirageAuSort />
    </ProtectedRoute>
  }
/>

          <Route
  path="/organisateur/planning-benevoles/:courseId"
  element={
    <ProtectedRoute>
      <PlanningBenevoles />
    </ProtectedRoute>
  }
/><Route
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

          <Route path="/inscription/:courseId" element={<InscriptionCourse />} />


          {/* Création/édition */}
          <Route
            path="/organisateur/creer-course"
            element={
              <ProtectedRoute>
                <UpsertCourse />
              </ProtectedRoute>
            }
          />
          <Route path="/organisateur/nouvelle-course" element={<Navigate to="/organisateur/creer-course" replace />} />
          <Route
            path="/modifier-course/:id"
            element={
              <ProtectedRoute>
                <UpsertCourse />
              </ProtectedRoute>
            }
          />

          {/* Outils organisateur */}
          <Route
            path="/organisateur/classement/:courseId"
            element={
              <ProtectedRoute>
                <ClassementArrivees />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organisateur/reglement/:courseId"
            element={
              <ProtectedRoute>
                <ReglementAssistant />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organisateur/checklist/:courseId"
            element={
              <ProtectedRoute>
                <ChecklistAssistant />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organisateur/compta"
            element={
              <ProtectedRoute>
                <Compta />
              </ProtectedRoute>
            }
          />

          {/* ✅ NOUVEAU : Partenaires / Sponsors */}
          <Route
  path="/organisateur/partenaires/:courseId"
  element={
    <ProtectedRoute>
      <CoursePartenaires />
    </ProtectedRoute>
  }
/>

          {/* Bénévoles (organisateur) */}
          <Route
            path="/organisateur/benevoles"
            element={
              <ProtectedRoute>
                <ListeBenevoles />
              </ProtectedRoute>
            }
          />

          {/* ================================ ADMIN =========================== */}
          <Route path="/admin" element={<AdminHome />} />
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
            path="/admin/contact"
            element={
              <AdminRoute>
                <AdminLayout>
                  <AdminContact />
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
          <Route
            path="/admin/a-la-une"
            element={
              <AdminRoute>
                <AdminLayout>
                  <AdminALaUne />
                </AdminLayout>
              </AdminRoute>
            }
          />

          {/* ============================== FALLBACK ========================== */}
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

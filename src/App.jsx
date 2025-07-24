import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import NouvelleCourse from "./pages/NouvelleCourse";
import ModifierCourse from "./pages/ModifierCourse";
import ListeFormats from "./pages/ListeFormats";
import InscriptionCourse from "./pages/InscriptionCourse";
import ProfilCoureur from "./pages/ProfilCoureur";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Admin from "./pages/Admin";
import MonProfilCoureur from "./pages/MonProfilCoureur";
import MonProfilOrganisateur from "./pages/MonProfilOrganisateur";
import { UserProvider, useUser } from "./contexts/UserContext";
import MonEspaceOrganisateur from "./pages/MonEspaceOrganisateur";
import ListeInscriptions from "./pages/ListeInscriptions";
import AuthRedirectWrapper from "./components/AuthRedirectWrapper";
import { Toaster } from "react-hot-toast";
import DetailsCoureur from "./pages/DetailsCoureur";

function AppContent() {
  const { currentRole } = useUser(); // 👈 récupération du rôle
  return (
    <>
      <Navbar key={currentRole} /> {/* 👈 force le re-render */}
      <Routes>
        <Route path="/" element={<Courses />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/:id" element={<CourseDetail />} />
        <Route path="/organisateur/nouvelle-course" element={<NouvelleCourse />} />
        <Route path="/organisateur/modifier-course/:id" element={<ModifierCourse />} />
        <Route path="/formats" element={<ListeFormats />} />
        <Route path="/inscription/:courseId" element={<InscriptionCourse />} />
        <Route path="/coureur" element={<ProfilCoureur />} />
        <Route path="/monprofilcoureur" element={<MonProfilCoureur />} />
        <Route path="/monprofilorganisateur" element={<MonProfilOrganisateur />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/organisateur/mon-espace" element={<MonEspaceOrganisateur />} />
        <Route path="/organisateur/inscriptions/:format_id" element={<ListeInscriptions />} />
        <Route path="/details-coureur/:id" element={<DetailsCoureur />} />
      

</Routes>
    </>
  );
}

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <AuthRedirectWrapper>
          <Toaster position="top-right" />
          <AppContent />
        </AuthRedirectWrapper>
      </BrowserRouter>
    </UserProvider>
  );
}

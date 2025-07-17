import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Courses from "./pages/Courses";
import Organisateur from "./pages/Organisateur";
import LoginOrganisateur from "./pages/LoginOrganisateur";
import SignupOrganisateur from "./pages/SignupOrganisateur";
import EspaceOrganisateur from "./pages/EspaceOrganisateur";
import NouvelleCourse from "./pages/NouvelleCourse";

import ListeFormats from "./pages/ListeFormats";
import CoursePage from "./pages/CoursePage"; // en haut avec les autres imports
import ModifierCourse from "./pages/ModifierCourse";
import CourseDetail from "./pages/CourseDetail"; // 🔹 Ajout en haut
import InscriptionCourse from "./pages/InscriptionCourse";

export default function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/organisateur" element={<Organisateur />} />
        <Route path="/organisateur/login" element={<LoginOrganisateur />} />
        <Route path="/organisateur/signup" element={<SignupOrganisateur />} />
        <Route path="/organisateur/espace" element={<EspaceOrganisateur />} />
        <Route path="/organisateur/nouvelle-course" element={<NouvelleCourse />} />
        <Route path="/formats" element={<ListeFormats />} />
        <Route path="/course/:id" element={<CoursePage />} />
        <Route path="/organisateur/modifier-course/:id" element={<ModifierCourse />} />
        <Route path="/courses/:id" element={<CourseDetail />} />
        <Route path="/courses/:id/inscription" element={<InscriptionCourse />} />

      </Routes>
    </Router>
  );
}

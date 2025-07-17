// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import NouvelleCourse from "./pages/NouvelleCourse";
import EspaceOrganisateur from "./pages/EspaceOrganisateur";
import ModifierCourse from "./pages/ModifierCourse";
import ListeFormats from "./pages/ListeFormats";
import InscriptionCourse from "./pages/InscriptionCourse";
import ProfilCoureur from "./pages/ProfilCoureur";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Admin from "./pages/Admin";

import { UserProvider } from "./contexts/UserContext";


export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<Courses />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/organisateur/nouvelle-course" element={<NouvelleCourse />} />
          <Route path="/organisateur/espace" element={<EspaceOrganisateur />} />
          <Route path="/organisateur/modifier-course/:id" element={<ModifierCourse />} />
          <Route path="/organisateur/login" element={<Login />} />
          <Route path="/organisateur/signup" element={<Signup />} />
          <Route path="/formats" element={<ListeFormats />} />
          <Route path="/inscription/:courseId" element={<InscriptionCourse />} />
          <Route path="/coureur" element={<ProfilCoureur />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Routes>
      </BrowserRouter>
    </UserProvider>
  );
}

import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Courses from "./pages/Courses";
import Organisateur from "./pages/Organisateur";
import EspaceOrganisateur from "./pages/EspaceOrganisateur";
import NouvelleCourse from "./pages/NouvelleCourse";
import Signup from "./pages/Signup";
import CourseDetail from "./pages/CourseDetail";
import InscriptionCourse from "./pages/InscriptionCourse";
import ProfilCoureur from "./pages/ProfilCoureur";
import ListeFormats from "./pages/ListeFormats";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import { UserProvider } from "./UserContext";

export default function App() {
  return (
    <UserProvider>
      <Router>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/inscription/:courseId" element={<InscriptionCourse />} />
          <Route path="/organisateur" element={<Organisateur />} />
         
          <Route path="/organisateur/nouvelle-course" element={<NouvelleCourse />} />
          <Route path="/organisateur/espace" element={<EspaceOrganisateur />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profil" element={<ProfilCoureur />} />
          <Route path="/formats" element={<ListeFormats />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Router>
    </UserProvider>
  );
}

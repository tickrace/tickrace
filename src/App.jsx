import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Courses from "./pages/Courses";
import Organisateur from "./pages/Organisateur";
import SignupOrganisateur from "./pages/SignupOrganisateur";
import EspaceOrganisateur from "./pages/EspaceOrganisateur";
import Coureur from "./pages/Coureur";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/organisateur" element={<Organisateur />} />
        <Route path="/organisateur/signup" element={<SignupOrganisateur />} />
        <Route path="/organisateur/espace" element={<EspaceOrganisateur />} />
        <Route path="/coureur" element={<Coureur />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Router>
  );
}

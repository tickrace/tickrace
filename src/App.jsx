import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Courses from "./pages/Courses"; // ✅ Ajout de l'import
import Organisateur from "./pages/Organisateur";
import LoginOrganisateur from "./pages/LoginOrganisateur";

export default function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/courses" element={<Courses />} /> {/* ✅ Ajout de la route */}
<Route path="/organisateur" element={<Organisateur />} />

<Route path="/organisateur/login" element={<LoginOrganisateur />} />


      </Routes>
    </Router>
  );
}

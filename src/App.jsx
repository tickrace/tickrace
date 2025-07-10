import SignupOrganisateur from "./pages/SignupOrganisateur";

<Route path="/signup-organisateur" element={<SignupOrganisateur />} />
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import Coureur from "./pages/Coureur";
import Organisateur from "./pages/Organisateur";
import Courses from "./pages/Courses";
import NewCourse from "./pages/NewCourse";
import Navbar from "./components/Navbar";

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/coureur" element={<Coureur />} />
        <Route path="/organisateur" element={<Organisateur />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/organisateur/nouvelle-course" element={<NewCourse />} />
      </Routes>
    </BrowserRouter>
  );
}
git config --global user.name "Nicolas Izard"
git config --global user.email "tickrace.contact@gmail.com"


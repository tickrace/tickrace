// src/components/AuthRedirectWrapper.jsx
import { useEffect } from "react";
import { useUser } from "../contexts/UserContext";
import { useNavigate, useLocation } from "react-router-dom";

export default function AuthRedirectWrapper({ children }) {
  const { session } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Si l'utilisateur vient de se connecter depuis /login ou /signup
    const fromAuthPage = ["/login", "/signup"].includes(location.pathname);
    if (session && fromAuthPage) {
      navigate("/courses");
    }
  }, [session, location, navigate]);

  return children;
}

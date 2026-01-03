// src/components/AuthRedirectWrapper.jsx
import { useEffect } from "react";
import { useUser } from "../contexts/UserContext";
import { useNavigate, useLocation } from "react-router-dom";

function getSafeNext(search) {
  try {
    const sp = new URLSearchParams(search || "");
    const nextRaw = sp.get("next");
    if (!nextRaw) return null;

    // next peut être encodé (encodeURIComponent)
    const next = decodeURIComponent(nextRaw);

    // Sécurité : on n'accepte que des routes internes
    if (!next.startsWith("/")) return null;
    if (next.startsWith("//")) return null; // évite protocol-relative
    if (next.toLowerCase().startsWith("/http")) return null;

    return next;
  } catch {
    return null;
  }
}

export default function AuthRedirectWrapper({ children }) {
  const { session } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fromAuthPage = location.pathname === "/login" || location.pathname === "/signup";
    if (!session || !fromAuthPage) return;

    const next = getSafeNext(location.search);

    // remplace l'historique pour éviter "retour" -> /login
    navigate(next || "/courses", { replace: true });
  }, [session, location.pathname, location.search, navigate]);

  return children;
}

// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "../contexts/UserContext";

/**
 * Protège une route : si l'utilisateur n'est pas connecté, redirige vers /login
 * en conservant la cible initiale dans l'état de navigation (state.from).
 */
export default function ProtectedRoute({ children }) {
  const { session } = useUser();
  const location = useLocation();

  if (!session?.user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

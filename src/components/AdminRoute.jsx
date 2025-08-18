import React from "react";
import { Navigate } from "react-router-dom";
import useIsAdmin from "../hooks/useIsAdmin";

export default function AdminRoute({ children }) {
  const { isAdmin, loading } = useIsAdmin();

  if (loading) return null;            // tu peux mettre un loader si tu veux
  if (!isAdmin) return <Navigate to="/" replace />;

  return children;
}

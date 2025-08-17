import React from "react";
import { Navigate } from "react-router-dom";
import useRequireAdmin from "../hooks/useRequireAdmin";

export default function AdminRoute({ children }) {
  const { loading, allowed } = useRequireAdmin();

  if (loading) return null;                 // ou un loader si tu veux
  if (!allowed) return <Navigate to="/404" replace />;

  return children;
}

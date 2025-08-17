// src/components/AdminRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import useRequireAdmin from "../hooks/useRequireAdmin";

export default function AdminRoute({ children }) {
  const { loading, allowed } = useRequireAdmin();
  if (loading) return null;
  if (!allowed) return <Navigate to="/" replace />;
  return children;
}

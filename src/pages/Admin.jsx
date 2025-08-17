import React from "react";
import AdminLayout from "./admin/AdminLayout";
import AdminDashboard from "./admin/AdminDashboard";

export default function Admin() {
  return (
    <AdminLayout>
      <AdminDashboard />
    </AdminLayout>
  );
}

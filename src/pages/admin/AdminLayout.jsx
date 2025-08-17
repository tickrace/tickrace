import React from "react";

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr]">
      <aside className="border-r p-4">
        <div className="font-bold text-xl mb-4">Tickrace • Admin</div>
        <nav className="grid gap-2 text-sm">
          <a href="/admin" className="hover:underline">Dashboard</a>
          <a href="/admin/courses" className="hover:underline">Courses</a>
          <a href="/admin/inscriptions" className="hover:underline">Inscriptions</a>
          <a href="/admin/paiements" className="hover:underline">Paiements</a>
        </nav>
      </aside>
      <main className="p-6">{children}</main>
    </div>
  );
}

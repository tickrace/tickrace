import { NavLink, Outlet } from "react-router-dom";

export default function AdminLayout({ children }) {
  return (
    <div className="flex min-h-[60vh]">
      <aside className="w-56 border-r p-4 space-y-2">
        <NavLink to="/admin/dashboard" className="block">Dashboard</NavLink>

        <NavLink to="/admin/courses" className="block">Courses</NavLink>
        <NavLink to="/admin/inscriptions" className="block">Inscriptions</NavLink>
        <NavLink to="/admin/payouts" className="block">Paiements</NavLink>
      </aside>
      <main className="flex-1">
        {children ?? <Outlet />}
      </main>
    </div>
  );
}

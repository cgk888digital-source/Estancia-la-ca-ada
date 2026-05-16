import React, { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, ArrowDownCircle, ArrowUpCircle,
  Users, BarChart3, Menu, X, Hotel, LogOut, UtensilsCrossed
} from 'lucide-react'

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={20} />, end: true },
  { to: '/admin/ingresos', label: 'Ingresos', icon: <ArrowDownCircle size={20} /> },
  { to: '/admin/egresos', label: 'Egresos', icon: <ArrowUpCircle size={20} /> },
  { to: '/admin/empleados', label: 'Empleados', icon: <Users size={20} /> },
  { to: '/admin/reportes', label: 'Reportes', icon: <BarChart3 size={20} /> },
  { to: '/admin/menu', label: 'Menú Semanal', icon: <UtensilsCrossed size={20} /> },
]

const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      {/* Sidebar overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 flex flex-col w-64 bg-[#3D2B1F] text-white transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
          <div className="w-9 h-9 bg-[#C5A059] rounded-xl flex items-center justify-center">
            <Hotel size={20} className="text-[#3D2B1F]" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">La Cañada</p>
            <p className="text-[10px] text-white/40 uppercase tracking-widest">Administración</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-white/40 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                ${isActive
                  ? 'bg-[#C5A059] text-[#3D2B1F]'
                  : 'text-white/60 hover:text-white hover:bg-white/5'}`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-6 border-t border-white/10 pt-4">
          <a
            href="/"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/40 hover:text-white hover:bg-white/5 transition-all"
          >
            <LogOut size={20} />
            Ver App Huésped
          </a>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#C5A059]/20 rounded-full flex items-center justify-center text-[#C5A059] font-bold text-sm">
              A
            </div>
            <span className="text-sm text-gray-600 font-medium hidden sm:block">Admin</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout

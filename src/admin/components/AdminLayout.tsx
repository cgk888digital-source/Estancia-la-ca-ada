import React, { useState, useEffect, useMemo } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ArrowDownCircle, ArrowUpCircle,
  Users, BarChart3, Menu, X, LogOut, UtensilsCrossed, Calendar, DollarSign, ClipboardList, Mail, ContactRound
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import LoginPage from './LoginPage'

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={20} />, end: true, roles: ['propiedad'] },
  { to: '/admin/reservas', label: 'Planner Reservas', icon: <Calendar size={20} />, roles: ['propiedad', 'administracion'] },
  { to: '/admin/clientes', label: 'Clientes', icon: <ContactRound size={20} />, roles: ['propiedad', 'administracion'] },
  { to: '/admin/ingresos', label: 'Ingresos & Propinas', icon: <ArrowDownCircle size={20} />, roles: ['propiedad', 'administracion'] },
  { to: '/admin/egresos', label: 'Egresos', icon: <ArrowUpCircle size={20} />, roles: ['propiedad', 'administracion'] },
  { to: '/admin/email-marketing', label: 'Email Marketing', icon: <Mail size={20} />, roles: ['propiedad', 'administracion'] },
  { to: '/admin/menu', label: 'Menú Restaurante', icon: <UtensilsCrossed size={20} />, roles: ['propiedad', 'restaurante'] },
  { to: '/admin/comandas', label: 'Comandas POS', icon: <ClipboardList size={20} />, roles: ['propiedad', 'restaurante'] },
  { to: '/admin/empleados', label: 'Empleados & Nómina', icon: <Users size={20} />, roles: ['propiedad'] },
  { to: '/admin/reportes', label: 'Reportes Analíticos', icon: <BarChart3 size={20} />, roles: ['propiedad'] },
  { to: '/admin/tarifas', label: 'Tarifas y Descuentos', icon: <DollarSign size={20} />, roles: ['propiedad'] },
]

const roleLabels: Record<string, string> = {
  propiedad: 'La Propiedad',
  administracion: 'Administración',
  restaurante: 'Restaurante & Cocina'
}

const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { role, sessionReady, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const allowedNavItems = useMemo(() => {
    return role ? navItems.filter(item => item.roles.includes(role)) : []
  }, [role])

  useEffect(() => {
    if (!role) return
    const currentItem = navItems.find(i => i.to === location.pathname || (i.to === '/admin' && location.pathname === '/admin'))
    const isUnauthorized = currentItem && !currentItem.roles.includes(role)
    const isDashboardForbidden = location.pathname === '/admin' && role !== 'propiedad'
    
    if (isUnauthorized || isDashboardForbidden) {
      const target = allowedNavItems[0]?.to || '/admin/comandas'
      navigate(target, { replace: true })
    }
  }, [role, location.pathname, allowedNavItems, navigate])

  if (!role) {
    return <LoginPage />
  }

  if (!sessionReady) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100">
        <div className="w-10 h-10 border-4 border-[#C5A059] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden print:h-auto print:overflow-visible">
      {/* Sidebar overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 flex flex-col w-64 bg-[#3D2B1F] text-white transition-transform duration-300 print:hidden
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
          <img 
            src="/assets/logo-nuevo.png" 
            alt="Logo Estancia La Cañada" 
            className="w-9 h-9 object-contain bg-white/95 p-1 rounded-xl shadow-inner border border-white/10"
          />
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
          {allowedNavItems.map((item) => (
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
        <div className="px-3 pb-6 border-t border-white/10 pt-4 flex flex-col gap-2">
          <button
            onClick={() => {
              logout()
              navigate('/admin')
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-all text-left"
          >
            <LogOut size={20} />
            Cerrar Sesión
          </button>
          <a
            href="/"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/40 hover:text-white hover:bg-white/5 transition-all"
          >
            Ver App Huésped
          </a>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shrink-0 print:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#C5A059]/20 rounded-full flex items-center justify-center text-[#C5A059] font-bold text-sm">
              {role === 'propiedad' ? 'P' : role === 'administracion' ? 'A' : 'R'}
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#C5A059]/15 text-[#3D2B1F] uppercase tracking-wider">
              {roleLabels[role] || role}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-[#F9F9F9] p-4 md:p-6 lg:p-8 print:overflow-visible print:p-0 print:bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout

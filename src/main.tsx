import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import AdminLayout from './admin/components/AdminLayout.tsx'
import Dashboard from './admin/components/Dashboard.tsx'
import TransactionsPage from './admin/components/TransactionsPage.tsx'
import EmployeesPage from './admin/components/EmployeesPage.tsx'
import ReportsPage from './admin/components/ReportsPage.tsx'
import MenuPage from './admin/components/MenuPage.tsx'
import BookingsPage from './admin/components/BookingsPage.tsx'
import RatesPage from './admin/components/RatesPage.tsx'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Admin panel */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="reservas" element={<BookingsPage />} />
          <Route path="ingresos" element={<TransactionsPage typeFilter="ingreso" />} />
          <Route path="egresos" element={<TransactionsPage typeFilter="egreso" />} />
          <Route path="empleados" element={<EmployeesPage />} />
          <Route path="reportes" element={<ReportsPage />} />
          <Route path="menu" element={<MenuPage />} />
          <Route path="tarifas" element={<RatesPage />} />
        </Route>
        {/* Guest mobile app */}
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)

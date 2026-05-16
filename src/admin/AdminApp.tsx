import React from 'react'
import { Routes, Route } from 'react-router-dom'
import AdminLayout from './components/AdminLayout'
import Dashboard from './components/Dashboard'
import TransactionsPage from './components/TransactionsPage'
import EmployeesPage from './components/EmployeesPage'
import ReportsPage from './components/ReportsPage'

const AdminApp: React.FC = () => (
  <Routes>
    <Route path="/admin" element={<AdminLayout />}>
      <Route index element={<Dashboard />} />
      <Route path="ingresos" element={<TransactionsPage typeFilter="ingreso" />} />
      <Route path="egresos" element={<TransactionsPage typeFilter="egreso" />} />
      <Route path="empleados" element={<EmployeesPage />} />
      <Route path="reportes" element={<ReportsPage />} />
    </Route>
  </Routes>
)

export default AdminApp

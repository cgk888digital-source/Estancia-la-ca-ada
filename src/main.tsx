import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import { AuthProvider } from './admin/context/AuthContext.tsx'

const App = lazy(() => import('./App.tsx'))
const AdminLayout = lazy(() => import('./admin/components/AdminLayout.tsx'))
const Dashboard = lazy(() => import('./admin/components/Dashboard.tsx'))
const TransactionsPage = lazy(() => import('./admin/components/TransactionsPage.tsx'))
const EmployeesPage = lazy(() => import('./admin/components/EmployeesPage.tsx'))
const ReportsPage = lazy(() => import('./admin/components/ReportsPage.tsx'))
const MenuPage = lazy(() => import('./admin/components/MenuPage.tsx'))
const BookingsPage = lazy(() => import('./admin/components/BookingsPage.tsx'))
const RatesPage = lazy(() => import('./admin/components/RatesPage.tsx'))
const ComandasPage = lazy(() => import('./admin/components/ComandasPage.tsx'))

registerSW({ immediate: true })

const LoadingFallback = () => (
  <div className="flex h-screen w-full items-center justify-center bg-[#121212] text-[#C5A059]">
    <div className="animate-pulse flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-[#C5A059] border-t-transparent rounded-full animate-spin"></div>
      <p className="font-serif">Cargando...</p>
    </div>
  </div>
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Admin panel — AuthProvider solo aquí */}
          <Route path="/admin" element={
            <AuthProvider>
              <AdminLayout />
            </AuthProvider>
          }>
            <Route index element={<Dashboard />} />
            <Route path="reservas" element={<BookingsPage />} />
            <Route path="ingresos" element={<TransactionsPage typeFilter="ingreso" />} />
            <Route path="egresos" element={<TransactionsPage typeFilter="egreso" />} />
            <Route path="empleados" element={<EmployeesPage />} />
            <Route path="reportes" element={<ReportsPage />} />
            <Route path="menu" element={<MenuPage />} />
            <Route path="comandas" element={<ComandasPage />} />
            <Route path="tarifas" element={<RatesPage />} />
          </Route>
          {/* Guest mobile app — sin AuthProvider */}
          <Route path="/*" element={<App />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)

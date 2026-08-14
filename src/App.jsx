import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ProductsPage from './pages/ProductsPage'
import CustomersPage from './pages/CustomersPage'
import PriceListsPage from './pages/PriceListsPage'
import ForecastPage from './pages/ForecastPage'
import ReportPage from './pages/ReportPage'
import RotationsPage from './pages/RotationsPage'
import SettingsPage from './pages/SettingsPage'
import ArchivePage from './pages/ArchivePage'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"  element={<DashboardPage />} />
          <Route path="products"   element={<ProductsPage />} />
          <Route path="customers"  element={<CustomersPage />} />
          <Route path="pricelists" element={<PriceListsPage />} />
          <Route path="forecast"   element={<ForecastPage />} />
          <Route path="rotations"  element={<RotationsPage />} />
          <Route path="report"     element={<ReportPage />} />
          <Route path="archive"    element={<ArchivePage />} />
          <Route path="settings"   element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { ToastProvider } from './components/Toast'
import { I18nProvider } from './i18n'
import { StoreProvider, useStore } from './store/store'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { Partners } from './pages/Partners'
import { Signup } from './pages/Signup'
import { ProviderSignup } from './pages/ProviderSignup'
import { NotificationsPage } from './pages/Notifications'
import { CustomerHome } from './pages/customer/CustomerHome'
import { BookService } from './pages/customer/BookService'
import { CustomerBookingDetail } from './pages/customer/BookingDetail'
import { TechHome } from './pages/technician/TechHome'
import { TechJobDetail } from './pages/technician/JobDetail'
import { ProviderHome } from './pages/provider/ProviderHome'
import { ProviderBookingDetail } from './pages/provider/BookingDetail'
import { ProviderBilling } from './pages/provider/Billing'
import { AdminOverview } from './pages/admin/AdminOverview'
import { AdminBookings, AdminBookingDetail } from './pages/admin/AdminBookings'
import { AdminCustomers, AdminTechnicians } from './pages/admin/AdminPeople'
import {
  AdminPricing,
  AdminReviews,
  AdminDiscounts,
  AdminReports,
} from './pages/admin/AdminOps'
import { CustomerLayout, TechLayout, AdminLayout, ProviderLayout } from './pages/layouts'

const ProviderControlTower = lazy(() =>
  import('./pages/provider/ControlTower').then((m) => ({ default: m.ProviderControlTower })),
)

function TowerFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="rounded-2xl bg-teal-50 px-5 py-3 text-sm font-semibold text-teal-800 animate-[pulse-soft_1.4s_ease-in-out_infinite]">
        Control Tower…
      </div>
    </div>
  )
}

function NotificationsRedirect() {
  const { currentUser } = useStore()
  if (!currentUser) return <Navigate to="/login" replace />
  const base =
    currentUser.role === 'admin'
      ? '/admin'
      : currentUser.role === 'technician'
        ? '/tech'
        : currentUser.role === 'provider'
          ? '/provider'
          : '/app'
  return <Navigate to={`${base}/notifications`} replace />
}

export default function App() {
  return (
    <StoreProvider>
      <I18nProvider>
        <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/signup/provider" element={<ProviderSignup />} />

            <Route
              path="/app"
              element={
                <RequireAuth roles={['customer']}>
                  <CustomerLayout />
                </RequireAuth>
              }
            >
              <Route index element={<CustomerHome />} />
              <Route path="book" element={<BookService />} />
              <Route path="bookings/:id" element={<CustomerBookingDetail />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            <Route
              path="/tech"
              element={
                <RequireAuth roles={['technician']}>
                  <TechLayout />
                </RequireAuth>
              }
            >
              <Route index element={<TechHome />} />
              <Route path="jobs/:id" element={<TechJobDetail />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            <Route
              path="/provider"
              element={
                <RequireAuth roles={['provider']}>
                  <ProviderLayout />
                </RequireAuth>
              }
            >
              <Route index element={<ProviderHome />} />
              <Route
                path="control-tower"
                element={
                  <Suspense fallback={<TowerFallback />}>
                    <ProviderControlTower />
                  </Suspense>
                }
              />
              <Route path="billing" element={<ProviderBilling />} />
              <Route path="bookings/:id" element={<ProviderBookingDetail />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            <Route
              path="/admin"
              element={
                <RequireAuth roles={['admin']}>
                  <AdminLayout />
                </RequireAuth>
              }
            >
              <Route index element={<AdminOverview />} />
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="bookings/:id" element={<AdminBookingDetail />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="technicians" element={<AdminTechnicians />} />
              <Route path="pricing" element={<AdminPricing />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="discounts" element={<AdminDiscounts />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            <Route path="/notifications" element={<NotificationsRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        </ToastProvider>
      </I18nProvider>
    </StoreProvider>
  )
}

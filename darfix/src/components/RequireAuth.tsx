import { Navigate, useLocation } from 'react-router-dom'
import { useStore } from '../store/store'
import type { UserRole } from '../store/types'

export function RequireAuth({
  roles,
  children,
}: {
  roles: UserRole[]
  children: React.ReactNode
}) {
  const { currentUser, loading } = useStore()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-navy-700/60">
        <span className="inline-flex items-center gap-2 rounded-full border border-navy-100 bg-white px-4 py-2 shadow-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-teal-500" />
          Loading…
        </span>
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (!roles.includes(currentUser.role)) {
    const home =
      currentUser.role === 'admin'
        ? '/admin'
        : currentUser.role === 'technician'
          ? '/tech'
          : currentUser.role === 'provider'
            ? '/provider'
            : '/app'
    return <Navigate to={home} replace />
  }
  return <>{children}</>
}

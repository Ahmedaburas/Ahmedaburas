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
        Loading…
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

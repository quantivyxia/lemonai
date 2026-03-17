import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'

export const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-36 w-full" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

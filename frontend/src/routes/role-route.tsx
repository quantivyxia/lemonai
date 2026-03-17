import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

import { useAuth } from '@/hooks/use-auth'
import type { UserRole } from '@/types/entities'

type RoleRouteProps = {
  allowedRoles: UserRole[]
  children: ReactNode
}

export const RoleRoute = ({ allowedRoles, children }: RoleRouteProps) => {
  const { user } = useAuth()
  const location = useLocation()

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  return children
}

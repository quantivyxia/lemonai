import { useMemo } from 'react'

import { useAuth } from '@/hooks/use-auth'

type TenantRef = {
  tenantId?: string
  tenantName?: string
}

export const useTenantScope = () => {
  const { user } = useAuth()

  const isSuperAdmin = user?.role === 'super_admin'
  const userRole = user?.role
  const userTenantId = user?.tenantId
  const userTenantName = user?.tenantName
  const canManageRLS = userRole === 'super_admin' || userRole === 'analyst'

  const canAccessTenant = ({ tenantId, tenantName }: TenantRef) => {
    if (!user) return false
    if (isSuperAdmin) return true
    if (tenantId) return tenantId === userTenantId
    if (tenantName) return tenantName === userTenantName
    return false
  }

  const filterByTenant = <T,>(items: T[], resolve: (item: T) => TenantRef) => {
    if (!user) return []
    if (isSuperAdmin) return items
    return items.filter((item) => canAccessTenant(resolve(item)))
  }

  return useMemo(
    () => ({
      isSuperAdmin,
      userRole,
      userTenantId,
      userTenantName,
      canManageRLS,
      canAccessTenant,
      filterByTenant,
    }),
    [canManageRLS, isSuperAdmin, user, userRole, userTenantId, userTenantName],
  )
}

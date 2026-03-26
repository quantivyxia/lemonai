import { type ComponentType, type ReactNode, Suspense, lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'

import { AppShell } from '@/layouts/app-shell'
import { AuthLayout } from '@/layouts/auth-layout'
import { ProtectedRoute } from '@/routes/protected-route'
import { RoleRoute } from '@/routes/role-route'

const lazyPage = <T extends { [key: string]: ComponentType<object> }, K extends keyof T>(
  loader: () => Promise<T>,
  exportName: K,
) =>
  lazy(async () => {
    const module = await loader()
    return { default: module[exportName] as ComponentType<object> }
  })

const LoginPage = lazyPage(() => import('@/features/auth/pages/login-page'), 'LoginPage')
const NotFoundPage = lazyPage(() => import('@/features/common/pages/not-found-page'), 'NotFoundPage')
const RouteErrorPage = lazyPage(() => import('@/features/common/pages/route-error-page'), 'RouteErrorPage')
const DashboardHomePage = lazyPage(
  () => import('@/features/dashboard/pages/dashboard-home-page'),
  'DashboardHomePage',
)
const DashboardsPage = lazyPage(() => import('@/features/dashboards/pages/dashboards-page'), 'DashboardsPage')
const UsersPage = lazyPage(() => import('@/features/users/pages/users-page'), 'UsersPage')
const TenantsPage = lazyPage(() => import('@/features/tenants/pages/tenants-page'), 'TenantsPage')
const GroupsPage = lazyPage(() => import('@/features/groups/pages/groups-page'), 'GroupsPage')
const PermissionsPage = lazyPage(
  () => import('@/features/permissions/pages/permissions-page'),
  'PermissionsPage',
)
const AuditPage = lazyPage(() => import('@/features/audit/pages/audit-page'), 'AuditPage')
const SystemMonitoringPage = lazyPage(
  () => import('@/features/monitoring/pages/system-monitoring-page'),
  'SystemMonitoringPage',
)
const RLSRulesPage = lazyPage(() => import('@/features/rls/pages/rls-rules-page'), 'RLSRulesPage')
const WorkspacesPage = lazyPage(
  () => import('@/features/reports/pages/workspaces-page'),
  'WorkspacesPage',
)
const TicketsPage = lazyPage(() => import('@/features/tickets/pages/tickets-page'), 'TicketsPage')
const PowerBIPage = lazyPage(() => import('@/features/powerbi/pages/powerbi-page'), 'PowerBIPage')
const BrandingPage = lazyPage(() => import('@/features/settings/pages/branding-page'), 'BrandingPage')
const PlatformSettingsPage = lazyPage(
  () => import('@/features/settings/pages/platform-settings-page'),
  'PlatformSettingsPage',
)
const DashboardViewPage = lazyPage(
  () => import('@/features/reports/pages/dashboard-view-page'),
  'DashboardViewPage',
)

const withSuspense = (element: ReactNode) => (
  <Suspense
    fallback={
      <div className="p-6 text-sm text-muted-foreground">
        Carregando...
      </div>
    }
  >
    {element}
  </Suspense>
)

const nonViewerRoles = ['super_admin', 'analyst'] as const

export const appRouter = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthLayout />,
    errorElement: withSuspense(<RouteErrorPage />),
    children: [
      {
        path: 'login',
        element: withSuspense(<LoginPage />),
      },
    ],
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    errorElement: withSuspense(<RouteErrorPage />),
    children: [
      {
        element: <AppShell />,
        children: [
          {
            index: true,
            element: withSuspense(<DashboardHomePage />),
          },
          {
            path: 'dashboards',
            element: withSuspense(<DashboardsPage />),
          },
          {
            path: 'users',
            element: (
              <RoleRoute allowedRoles={[...nonViewerRoles]}>
                {withSuspense(<UsersPage />)}
              </RoleRoute>
            ),
          },
          {
            path: 'tenants',
            element: (
              <RoleRoute allowedRoles={[...nonViewerRoles]}>
                {withSuspense(<TenantsPage />)}
              </RoleRoute>
            ),
          },
          {
            path: 'groups',
            element: (
              <RoleRoute allowedRoles={[...nonViewerRoles]}>
                {withSuspense(<GroupsPage />)}
              </RoleRoute>
            ),
          },
          {
            path: 'permissions',
            element: (
              <RoleRoute allowedRoles={['super_admin']}>
                {withSuspense(<PermissionsPage />)}
              </RoleRoute>
            ),
          },
          {
            path: 'audit',
            element: (
              <RoleRoute allowedRoles={[...nonViewerRoles]}>
                {withSuspense(<AuditPage />)}
              </RoleRoute>
            ),
          },
          {
            path: 'monitoring',
            element: (
              <RoleRoute allowedRoles={['super_admin']}>
                {withSuspense(<SystemMonitoringPage />)}
              </RoleRoute>
            ),
          },
          {
            path: 'rls',
            element: (
              <RoleRoute allowedRoles={[...nonViewerRoles]}>
                {withSuspense(<RLSRulesPage />)}
              </RoleRoute>
            ),
          },
          {
            path: 'workspaces',
            element: (
              <RoleRoute allowedRoles={[...nonViewerRoles]}>
                {withSuspense(<WorkspacesPage />)}
              </RoleRoute>
            ),
          },
          {
            path: 'powerbi',
            element: (
              <RoleRoute allowedRoles={[...nonViewerRoles]}>
                {withSuspense(<PowerBIPage />)}
              </RoleRoute>
            ),
          },
          {
            path: 'tickets',
            element: (
              <RoleRoute allowedRoles={[...nonViewerRoles]}>
                {withSuspense(<TicketsPage />)}
              </RoleRoute>
            ),
          },
          {
            path: 'settings/branding',
            element: (
              <RoleRoute allowedRoles={[...nonViewerRoles]}>
                {withSuspense(<BrandingPage />)}
              </RoleRoute>
            ),
          },
          {
            path: 'settings/platform',
            element: withSuspense(<PlatformSettingsPage />),
          },
          {
            path: 'reports/:dashboardId',
            element: withSuspense(<DashboardViewPage />),
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: withSuspense(<NotFoundPage />),
  },
])

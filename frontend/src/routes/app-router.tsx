import { createBrowserRouter } from 'react-router-dom'

import { AuditPage } from '@/features/audit/pages/audit-page'
import { LoginPage } from '@/features/auth/pages/login-page'
import { NotFoundPage } from '@/features/common/pages/not-found-page'
import { DashboardHomePage } from '@/features/dashboard/pages/dashboard-home-page'
import { DashboardsPage } from '@/features/dashboards/pages/dashboards-page'
import { GroupsPage } from '@/features/groups/pages/groups-page'
import { PermissionsPage } from '@/features/permissions/pages/permissions-page'
import { PowerBIPage } from '@/features/powerbi/pages/powerbi-page'
import { RLSRulesPage } from '@/features/rls/pages/rls-rules-page'
import { DashboardViewPage } from '@/features/reports/pages/dashboard-view-page'
import { WorkspacesPage } from '@/features/reports/pages/workspaces-page'
import { BrandingPage } from '@/features/settings/pages/branding-page'
import { PlatformSettingsPage } from '@/features/settings/pages/platform-settings-page'
import { TenantsPage } from '@/features/tenants/pages/tenants-page'
import { UsersPage } from '@/features/users/pages/users-page'
import { AppShell } from '@/layouts/app-shell'
import { AuthLayout } from '@/layouts/auth-layout'
import { ProtectedRoute } from '@/routes/protected-route'
import { RoleRoute } from '@/routes/role-route'

const nonViewerRoles = ['super_admin', 'analyst'] as const

export const appRouter = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      {
        path: 'login',
        element: <LoginPage />,
      },
    ],
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            index: true,
            element: <DashboardHomePage />,
          },
          {
            path: 'dashboards',
            element: <DashboardsPage />,
          },
          {
            path: 'users',
            element: (
              <RoleRoute allowedRoles={[...nonViewerRoles]}>
                <UsersPage />
              </RoleRoute>
            ),
          },
          {
            path: 'tenants',
            element: (
              <RoleRoute allowedRoles={[...nonViewerRoles]}>
                <TenantsPage />
              </RoleRoute>
            ),
          },
          {
            path: 'groups',
            element: (
              <RoleRoute allowedRoles={[...nonViewerRoles]}>
                <GroupsPage />
              </RoleRoute>
            ),
          },
          {
            path: 'permissions',
            element: (
              <RoleRoute allowedRoles={['super_admin']}>
                <PermissionsPage />
              </RoleRoute>
            ),
          },
          {
            path: 'audit',
            element: (
              <RoleRoute allowedRoles={[...nonViewerRoles]}>
                <AuditPage />
              </RoleRoute>
            ),
          },
          {
            path: 'rls',
            element: (
              <RoleRoute allowedRoles={[...nonViewerRoles]}>
                <RLSRulesPage />
              </RoleRoute>
            ),
          },
          {
            path: 'workspaces',
            element: (
              <RoleRoute allowedRoles={[...nonViewerRoles]}>
                <WorkspacesPage />
              </RoleRoute>
            ),
          },
          {
            path: 'powerbi',
            element: (
              <RoleRoute allowedRoles={[...nonViewerRoles]}>
                <PowerBIPage />
              </RoleRoute>
            ),
          },
          {
            path: 'settings/branding',
            element: (
              <RoleRoute allowedRoles={[...nonViewerRoles]}>
                <BrandingPage />
              </RoleRoute>
            ),
          },
          {
            path: 'settings/platform',
            element: <PlatformSettingsPage />,
          },
          {
            path: 'reports/:dashboardId',
            element: <DashboardViewPage />,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])

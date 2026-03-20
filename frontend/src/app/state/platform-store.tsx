import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { useAuth } from '@/hooks/use-auth'
import { permissionMatrixMock } from '@/mocks/platform'
import { defaultPlatformSettings } from '@/mocks/settings'
import { platformApi } from '@/services/platform-api'
import type {
  AccessLog,
  ActivityItem,
  Dashboard,
  DashboardColumn,
  PermissionMatrixRow,
  PlatformSettings,
  RLSRule,
  Tenant,
  TenantBranding,
  User,
  UserRole,
  UserGroup,
  Workspace,
} from '@/types/entities'

type PlatformStoreValue = {
  isLoading: boolean
  loadError: string | null
  tenants: Tenant[]
  users: User[]
  dashboards: Dashboard[]
  groups: UserGroup[]
  accessLogs: AccessLog[]
  brandings: TenantBranding[]
  workspaces: Workspace[]
  dashboardColumns: DashboardColumn[]
  rlsRules: RLSRule[]
  permissionMatrix: PermissionMatrixRow[]
  activities: ActivityItem[]
  accessSeries: { date: string; accesses: number }[]
  settings: PlatformSettings
  reloadData: () => Promise<void>
  upsertTenant: (
    tenant: Omit<
      Tenant,
      | 'id'
      | 'usersCount'
      | 'dashboardsCount'
      | 'supportHoursRemaining'
      | 'usersLimitReached'
      | 'dashboardsLimitReached'
      | 'supportLimitReached'
      | 'usersUsagePercent'
      | 'dashboardsUsagePercent'
      | 'supportUsagePercent'
      | 'brandingConfigured'
    > & { id?: string },
  ) => Promise<void>
  deleteTenant: (tenantId: string) => Promise<void>
  upsertUser: (user: Omit<User, 'id' | 'tenantName' | 'lastAccessAt'> & { id?: string; lastAccessAt?: string }) => Promise<void>
  deleteUser: (userId: string) => Promise<void>
  deleteUsers: (userIds: string[]) => Promise<void>
  toggleUserStatus: (userId: string) => Promise<void>
  upsertDashboard: (dashboard: Omit<Dashboard, 'id' | 'tenantName' | 'updatedAt'> & { id?: string }) => Promise<void>
  upsertGroup: (group: Omit<UserGroup, 'id' | 'tenantName'> & { id?: string }) => Promise<void>
  deleteGroup: (groupId: string) => Promise<void>
  upsertWorkspace: (workspace: Omit<Workspace, 'id' | 'tenantName' | 'dashboardsCount'> & { id?: string }) => Promise<void>
  deleteWorkspace: (workspaceId: string) => Promise<void>
  upsertBranding: (branding: Omit<TenantBranding, 'tenantName'>) => Promise<void>
  upsertRLSRule: (
    rule: Omit<RLSRule, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'> & { id?: string },
  ) => Promise<void>
  deleteRLSRule: (ruleId: string) => Promise<void>
  toggleRLSRuleStatus: (ruleId: string) => Promise<void>
  duplicateRLSRule: (ruleId: string) => Promise<void>
  setPermissionMatrix: (matrix: PermissionMatrixRow[]) => void
  setPlatformSettings: (settings: PlatformSettings) => void
}

type PersistedState = {
  tenants: Tenant[]
  users: User[]
  dashboards: Dashboard[]
  groups: UserGroup[]
  accessLogs: AccessLog[]
  brandings: TenantBranding[]
  workspaces: Workspace[]
  dashboardColumns: DashboardColumn[]
  rlsRules: RLSRule[]
  permissionMatrix: PermissionMatrixRow[]
  activities: ActivityItem[]
  accessSeries: { date: string; accesses: number }[]
  settings: PlatformSettings
}

const initialState: PersistedState = {
  tenants: [],
  users: [],
  dashboards: [],
  groups: [],
  accessLogs: [],
  brandings: [],
  workspaces: [],
  dashboardColumns: [],
  rlsRules: [],
  permissionMatrix: permissionMatrixMock,
  activities: [],
  accessSeries: [],
  settings: defaultPlatformSettings,
}

export const PlatformStoreContext = createContext<PlatformStoreValue | undefined>(undefined)

export const PlatformStoreProvider = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useAuth()
  const [state, setState] = useState<PersistedState>(initialState)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [roleIds, setRoleIds] = useState<Record<UserRole, string>>({
    super_admin: '',
    analyst: '',
    viewer: '',
  })

  const reloadData = useCallback(async () => {
    if (!isAuthenticated) {
      setState((current) => ({
        ...initialState,
        settings: current.settings,
        permissionMatrix: current.permissionMatrix,
      }))
      setRoleIds({
        super_admin: '',
        analyst: '',
        viewer: '',
      })
      setLoadError(null)
      return
    }

    setIsLoading(true)
    try {
      const data = await platformApi.fetchBootstrap({ userRole: user?.role })
      setLoadError(null)
      setState((current) => ({
        ...current,
        tenants: data.tenants,
        users: data.users,
        dashboards: data.dashboards,
        groups: data.groups,
        accessLogs: data.accessLogs,
        brandings: data.brandings,
        workspaces: data.workspaces,
        dashboardColumns: data.dashboardColumns,
        rlsRules: data.rlsRules,
        activities: data.activities,
        accessSeries: data.accessSeries,
      }))
      setRoleIds(data.roleIds)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel carregar os dados da plataforma.'
      setLoadError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, user?.role])

  const reloadUsers = useCallback(async () => {
    if (!isAuthenticated || (user?.role !== 'super_admin' && user?.role !== 'analyst')) {
      setState((current) => ({ ...current, users: [] }))
      return
    }

    const users = await platformApi.fetchUsers()
    setState((current) => ({ ...current, users }))
  }, [isAuthenticated, user?.role])

  useEffect(() => {
    void reloadData()
  }, [reloadData])

  const upsertTenant: PlatformStoreValue['upsertTenant'] = useCallback(
    async (tenant) => {
      await platformApi.upsertTenant({
        id: tenant.id,
        name: tenant.name.trim(),
        status: tenant.status,
        max_users: tenant.maxUsers,
        max_dashboards: tenant.maxDashboards,
        support_hours_total: tenant.supportHoursTotal,
        support_hours_consumed: tenant.supportHoursConsumed,
      })
      await reloadData()
    },
    [reloadData],
  )

  const deleteTenant: PlatformStoreValue['deleteTenant'] = useCallback(
    async (tenantId) => {
      await platformApi.deleteTenant(tenantId)
      await reloadData()
    },
    [reloadData],
  )

  const upsertUser: PlatformStoreValue['upsertUser'] = useCallback(
    async (user) => {
      const roleId = roleIds[user.role]
      if (!roleId) throw new Error(`Perfil ${user.role} nao esta disponivel no backend.`)

      const targetTenantId = user.tenantId === 'global' ? null : user.tenantId
      const selectedGroupIds =
        user.groupIds?.length > 0
          ? user.groupIds
          : (user.groups ?? [])
              .map((groupName) => state.groups.find((item) => item.tenantId === targetTenantId && item.name === groupName)?.id)
              .filter((id): id is string => Boolean(id))

      const selectedDashboardIds = user.dashboardIds ?? []
      const primaryGroupId = selectedGroupIds[0] ?? null

      await platformApi.upsertUser({
        id: user.id,
        first_name: user.firstName.trim(),
        last_name: user.lastName.trim(),
        email: user.email.trim().toLowerCase(),
        tenant: targetTenantId,
        role: roleId,
        primary_group: primaryGroupId,
        selected_group_ids: selectedGroupIds,
        selected_dashboard_ids: selectedDashboardIds,
        status: user.status,
        avatar_url: user.avatarUrl ?? '',
        ...(user.password ? { password: user.password } : {}),
      })
      await reloadUsers()
    },
    [reloadUsers, roleIds, state.groups],
  )

  const toggleUserStatus: PlatformStoreValue['toggleUserStatus'] = useCallback(
    async (userId) => {
      const user = state.users.find((item) => item.id === userId)
      if (!user) throw new Error('Usuario nao encontrado.')

      await platformApi.upsertUser({
        id: userId,
        status: user.status === 'active' ? 'inactive' : 'active',
      })
      await reloadUsers()
    },
    [reloadUsers, state.users],
  )

  const deleteUser: PlatformStoreValue['deleteUser'] = useCallback(
    async (userId) => {
      await platformApi.deleteUser(userId)
      await reloadUsers()
    },
    [reloadUsers],
  )

  const deleteUsers: PlatformStoreValue['deleteUsers'] = useCallback(
    async (userIds) => {
      await platformApi.deleteUsers(userIds)
      await reloadUsers()
    },
    [reloadUsers],
  )

  const upsertDashboard: PlatformStoreValue['upsertDashboard'] = useCallback(
    async (dashboard) => {
      const workspaceId =
        dashboard.workspaceId ??
        state.workspaces.find(
          (workspace) =>
            workspace.tenantId === dashboard.tenantId && workspace.name === dashboard.workspace,
        )?.id

      if (!workspaceId) {
        throw new Error('Workspace selecionado nao encontrado no backend.')
      }

      await platformApi.upsertDashboard({
        id: dashboard.id,
        tenant: dashboard.tenantId,
        workspace: workspaceId,
        name: dashboard.name.trim(),
        description: dashboard.description ?? '',
        category: dashboard.category.trim(),
        status: dashboard.status,
        embed_url: dashboard.embedUrl ?? 'https://app.powerbi.com/reportEmbed',
        report_id: dashboard.reportId ?? '',
        dataset_id: dashboard.datasetId ?? '',
        refresh_schedule: dashboard.refreshSchedule ?? '',
        tags: dashboard.tags ?? [dashboard.category.trim()],
      })
      await reloadData()
    },
    [reloadData, state.workspaces],
  )

  const upsertGroup: PlatformStoreValue['upsertGroup'] = useCallback(
    async (group) => {
      const tenantUsers = state.users.filter((user) => user.tenantId === group.tenantId)
      const tenantDashboards = state.dashboards.filter((dashboard) => dashboard.tenantId === group.tenantId)

      const members = group.users
        .map((fullName) => tenantUsers.find((user) => `${user.firstName} ${user.lastName}` === fullName)?.id)
        .filter((id): id is string => Boolean(id))

      const dashboards = group.dashboards
        .map((dashboardName) => tenantDashboards.find((dashboard) => dashboard.name === dashboardName)?.id)
        .filter((id): id is string => Boolean(id))

      await platformApi.upsertGroup({
        id: group.id,
        tenant: group.tenantId,
        name: group.name.trim(),
        description: group.description.trim(),
        members,
        dashboards,
      })
      await reloadData()
    },
    [reloadData, state.dashboards, state.users],
  )

  const deleteGroup: PlatformStoreValue['deleteGroup'] = useCallback(
    async (groupId) => {
      await platformApi.deleteGroup(groupId)
      await reloadData()
    },
    [reloadData],
  )

  const upsertWorkspace: PlatformStoreValue['upsertWorkspace'] = useCallback(
    async (workspace) => {
      await platformApi.upsertWorkspace({
        id: workspace.id,
        tenant: workspace.tenantId,
        name: workspace.name.trim(),
        external_workspace_id: workspace.externalWorkspaceId.trim(),
        status: workspace.status,
        last_sync_at: workspace.lastSyncAt,
      })
      await reloadData()
    },
    [reloadData],
  )

  const deleteWorkspace: PlatformStoreValue['deleteWorkspace'] = useCallback(
    async (workspaceId) => {
      await platformApi.deleteWorkspace(workspaceId)
      await reloadData()
    },
    [reloadData],
  )

  const upsertBranding: PlatformStoreValue['upsertBranding'] = useCallback(
    async (branding) => {
      const current = state.brandings.find((item) => item.tenantId === branding.tenantId)

      await platformApi.upsertBranding({
        id: branding.id ?? current?.id,
        tenant: branding.tenantId,
        platform_name: branding.platformName,
        primary_color: branding.primaryColor,
        secondary_color: branding.secondaryColor,
        domain: branding.domain,
        logo_url: branding.logoUrl ?? '',
        favicon_url: branding.faviconUrl ?? '',
        custom_domain_enabled: Boolean(branding.domain?.trim()),
      })
      await reloadData()
    },
    [reloadData, state.brandings],
  )

  const upsertRLSRule: PlatformStoreValue['upsertRLSRule'] = useCallback(
    async (rule) => {
      await platformApi.upsertRLSRule({
        id: rule.id,
        dashboard: rule.dashboardId,
        user: rule.userId,
        table_name: rule.tableName,
        column_name: rule.columnName,
        operator: rule.operator,
        rule_type: rule.ruleType,
        values: rule.values,
        notes: rule.notes ?? '',
        is_active: rule.isActive,
      })
      await reloadData()
    },
    [reloadData],
  )

  const deleteRLSRule: PlatformStoreValue['deleteRLSRule'] = useCallback(
    async (ruleId) => {
      await platformApi.deleteRLSRule(ruleId)
      await reloadData()
    },
    [reloadData],
  )

  const toggleRLSRuleStatus: PlatformStoreValue['toggleRLSRuleStatus'] = useCallback(
    async (ruleId) => {
      await platformApi.toggleRLSRule(ruleId)
      await reloadData()
    },
    [reloadData],
  )

  const duplicateRLSRule: PlatformStoreValue['duplicateRLSRule'] = useCallback(
    async (ruleId) => {
      await platformApi.duplicateRLSRule(ruleId)
      await reloadData()
    },
    [reloadData],
  )

  const setPermissionMatrix: PlatformStoreValue['setPermissionMatrix'] = useCallback((matrix) => {
    setState((current) => ({ ...current, permissionMatrix: matrix }))
  }, [])

  const setPlatformSettings: PlatformStoreValue['setPlatformSettings'] = useCallback((settings) => {
    setState((current) => ({ ...current, settings }))
  }, [])

  const value = useMemo<PlatformStoreValue>(
    () => ({
      isLoading,
      loadError,
      tenants: state.tenants,
      users: state.users,
      dashboards: state.dashboards,
      groups: state.groups,
      accessLogs: state.accessLogs,
      brandings: state.brandings,
      workspaces: state.workspaces,
      dashboardColumns: state.dashboardColumns,
      rlsRules: state.rlsRules,
      permissionMatrix: state.permissionMatrix,
      activities: state.activities,
      accessSeries: state.accessSeries,
      settings: state.settings,
      reloadData,
      upsertTenant,
      deleteTenant,
      upsertUser,
      deleteUser,
      deleteUsers,
      toggleUserStatus,
      upsertDashboard,
      upsertGroup,
      deleteGroup,
      upsertWorkspace,
      deleteWorkspace,
      upsertBranding,
      upsertRLSRule,
      deleteRLSRule,
      toggleRLSRuleStatus,
      duplicateRLSRule,
      setPermissionMatrix,
      setPlatformSettings,
    }),
    [
      isLoading,
      loadError,
      reloadData,
      state.accessLogs,
      state.accessSeries,
      state.activities,
      state.brandings,
      state.dashboardColumns,
      state.dashboards,
      state.groups,
      state.permissionMatrix,
      state.rlsRules,
      state.settings,
      state.tenants,
      state.users,
      state.workspaces,
      upsertTenant,
      deleteTenant,
      upsertUser,
      deleteUser,
      deleteUsers,
      toggleUserStatus,
      upsertDashboard,
      upsertGroup,
      deleteGroup,
      upsertWorkspace,
      deleteWorkspace,
      upsertBranding,
      upsertRLSRule,
      deleteRLSRule,
      toggleRLSRuleStatus,
      duplicateRLSRule,
      setPermissionMatrix,
      setPlatformSettings,
    ],
  )

  return (
    <PlatformStoreContext.Provider value={value}>
      {children}
    </PlatformStoreContext.Provider>
  )
}

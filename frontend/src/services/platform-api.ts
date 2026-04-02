import { apiList, apiRequest } from '@/services/api-client'
import { appLogger } from '@/services/app-logger'
import type {
  AccessLog,
  ActivityItem,
  AuditActivity,
  AuditSummary,
  AuditTopUser,
  Dashboard,
  DashboardColumn,
  PowerBIConnection,
  PowerBIDatasetOption,
  PowerBIGateway,
  PowerBIGatewayDataSource,
  PowerBIReportOption,
  PowerBIWorkspaceOption,
  RLSRule,
  SystemEventLog,
  SystemSummary,
  Tenant,
  TenantBranding,
  User,
  UserRole,
  UserGroup,
  Workspace,
} from '@/types/entities'

type BackendTenant = {
  id: string
  name: string
  slug?: string
  domain?: string | null
  status: 'active' | 'inactive' | 'suspended'
  max_users?: number
  max_dashboards?: number
  support_hours_total?: number | string
  support_hours_consumed?: number | string
  support_hours_remaining?: number | string
  users_count?: number
  dashboards_count?: number
  users_limit_reached?: boolean
  dashboards_limit_reached?: boolean
  support_limit_reached?: boolean
  users_usage_percent?: number
  dashboards_usage_percent?: number
  support_usage_percent?: number
  created_at: string
}

type BackendUser = {
  id: string
  first_name: string
  last_name: string
  email: string
  tenant: string | null
  tenant_name: string | null
  role_code: UserRole
  group_name: string | null
  group_ids?: string[]
  group_names?: string[]
  dashboard_ids?: string[]
  status: 'active' | 'inactive'
  last_login: string | null
  avatar_url?: string
}

type BackendWorkspace = {
  id: string
  tenant: string
  tenant_name: string
  name: string
  external_workspace_id: string
  status: 'active' | 'inactive' | 'syncing'
  last_sync_at: string | null
  dashboards_count: number
}

type BackendDashboardColumn = {
  id: string
  dashboard: string
  name: string
  label: string
  values: string[]
}

type BackendDashboard = {
  id: string
  tenant: string
  tenant_name: string
  workspace: string
  workspace_name: string
  name: string
  description: string
  category: string
  status: 'active' | 'draft' | 'archived'
  embed_url: string
  report_id: string
  dataset_id: string
  refresh_schedule?: string
  updated_at: string
  tags?: string[]
}

type BackendGroup = {
  id: string
  tenant: string
  name: string
  description: string
  members: string[]
  dashboards: string[]
  member_names?: string[]
  dashboard_names?: string[]
}

type BackendAccessLog = {
  id: string
  user: string | null
  user_name: string | null
  tenant: string
  tenant_name: string
  dashboard: string | null
  dashboard_name: string | null
  ip_address: string
  accessed_at: string
  status: 'success' | 'denied' | 'error'
  origin: 'portal' | 'api' | 'mobile'
  details?: string
}

type BackendBranding = {
  id: string
  tenant: string
  tenant_name: string
  platform_name: string
  primary_color: string
  secondary_color: string
  domain: string
  logo_url?: string
  favicon_url?: string
}

type BackendRLSRule = {
  id: string
  tenant: string
  dashboard: string
  user: string
  table_name: string
  column_name: string
  operator: 'in' | 'not_in'
  rule_type: 'allow' | 'deny'
  values: string[]
  notes?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

type BackendRole = {
  id: string
  code: UserRole
}

type BackendPowerBIConnection = {
  id: string
  tenant: string
  tenant_name: string
  aad_tenant_id: string
  client_id: string
  has_client_secret: boolean
  scope: string
  api_base_url: string
  default_workspace_id: string
  is_active: boolean
  last_tested_at?: string | null
  last_sync_at?: string | null
  last_error?: string
}

type BackendPowerBIGateway = {
  id: string
  tenant: string
  tenant_name: string
  connection: string | null
  name: string
  external_gateway_id: string
  gateway_type?: string
  status: 'active' | 'inactive' | 'error'
  notes?: string
  last_sync_at?: string | null
  datasources_count: number
}

type BackendPowerBIGatewayDatasource = {
  id: string
  gateway: string
  gateway_name: string
  tenant_id: string
  name: string
  external_datasource_id: string
  datasource_type?: string
  connection_details?: Record<string, unknown>
  status: 'active' | 'inactive'
}

type BackendPowerBIWorkspace = {
  id: string
  name: string
  isReadOnly: boolean
}

type BackendPowerBIReport = {
  id: string
  name: string
  embedUrl?: string
  datasetId?: string
}

type BackendPowerBIDataset = {
  id: string
  name: string
  isRefreshable: boolean
}

type BackendPowerBIUploadResult = {
  detail: string
  importId: string
  workspaceId: string
  workspaceName: string
  created: number
  updated: number
  dashboards: Array<{
    id: string
    name: string
    report_id: string
    dataset_id: string
    action: 'created' | 'updated'
  }>
}

type DashboardEmbedConfig = {
  dashboardId: string
  reportId: string
  datasetId: string
  embedUrl: string
  accessToken: string
  expiresAt: string
  reportFilters: Array<{
    table: string
    column: string
    operator: 'In' | 'NotIn'
    values: string[]
  }>
}

type BootstrapPayload = {
  tenants: Tenant[]
  users: User[]
  dashboards: Dashboard[]
  groups: UserGroup[]
  accessLogs: AccessLog[]
  brandings: TenantBranding[]
  workspaces: Workspace[]
  dashboardColumns: DashboardColumn[]
  rlsRules: RLSRule[]
  activities: ActivityItem[]
  accessSeries: { date: string; accesses: number }[]
  roleIds: Record<UserRole, string>
}

type BackendSystemEventLog = {
  id: string
  user_name: string | null
  tenant_name: string | null
  level: 'info' | 'warn' | 'error'
  category: 'auth' | 'authorization' | 'admin' | 'integration' | 'system'
  action: string
  message: string
  resource_type?: string
  resource_id?: string
  endpoint: string
  method: string
  request_id: string
  ip_address?: string | null
  status_code?: number | null
  metadata?: Record<string, unknown>
  created_at: string
}

type BackendSystemSummary = {
  status: 'ok'
  request_id: string
  timestamp: string
  counts: {
    tenants: number
    users: number
    dashboards: number
    workspaces: number
    powerbi_connections: number
    powerbi_gateways: number
    access_logs: number
    system_events: number
  }
  powerbi: {
    active_connections: number
    connections_with_error: number
    gateways_with_error: number
  }
  recent: {
    latest_system_event?: {
      created_at: string
      level: 'info' | 'warn' | 'error'
      category: 'auth' | 'authorization' | 'admin' | 'integration' | 'system'
      action: string
    } | null
    latest_access_log?: {
      accessed_at: string
      status: 'success' | 'denied' | 'error'
      origin: 'portal' | 'api' | 'mobile'
    } | null
  }
}

type BackendBootstrapPayload = {
  request_id: string
  tenants: BackendTenant[]
  users: BackendUser[]
  workspaces: BackendWorkspace[]
  dashboards: BackendDashboard[]
  dashboard_columns: BackendDashboardColumn[]
  groups: BackendGroup[]
  access_logs: BackendAccessLog[]
  brandings: BackendBranding[]
  rls_rules: BackendRLSRule[]
  roles: BackendRole[]
}

const buildRoleIds = (rolesRaw: BackendRole[]): Record<UserRole, string> => ({
  super_admin: rolesRaw.find((role) => role.code === 'super_admin')?.id ?? '',
  analyst: rolesRaw.find((role) => role.code === 'analyst')?.id ?? '',
  viewer: rolesRaw.find((role) => role.code === 'viewer')?.id ?? '',
})

const buildBootstrapPayload = (bootstrap: BackendBootstrapPayload): BootstrapPayload => {
  const tenantsRaw = bootstrap.tenants
  const usersRaw = bootstrap.users
  const workspacesRaw = bootstrap.workspaces
  const dashboardsRaw = bootstrap.dashboards
  const dashboardColumnsRaw = bootstrap.dashboard_columns
  const groupsRaw = bootstrap.groups
  const accessLogsRaw = bootstrap.access_logs
  const brandingsRaw = bootstrap.brandings
  const rlsRulesRaw = bootstrap.rls_rules
  const rolesRaw = bootstrap.roles

  const tenantById = new Map<string, string>()
  const tenants: Tenant[] = tenantsRaw.map((tenant) => {
    tenantById.set(tenant.id, tenant.name)
    return {
      id: tenant.id,
      name: tenant.name,
      status: normalizeTenantStatus(tenant.status),
      usersCount: tenant.users_count ?? 0,
      dashboardsCount: tenant.dashboards_count ?? 0,
      maxUsers: tenant.max_users ?? 25,
      maxDashboards: tenant.max_dashboards ?? 20,
      supportHoursTotal: toNumber(tenant.support_hours_total, 0),
      supportHoursConsumed: toNumber(tenant.support_hours_consumed, 0),
      supportHoursRemaining: toNumber(tenant.support_hours_remaining, 0),
      usersLimitReached:
        tenant.users_limit_reached ?? (tenant.users_count ?? 0) >= (tenant.max_users ?? 25),
      dashboardsLimitReached:
        tenant.dashboards_limit_reached ?? (tenant.dashboards_count ?? 0) >= (tenant.max_dashboards ?? 20),
      supportLimitReached:
        tenant.support_limit_reached ??
        (toNumber(tenant.support_hours_total, 0) > 0
          ? toNumber(tenant.support_hours_consumed, 0) >= toNumber(tenant.support_hours_total, 0)
          : toNumber(tenant.support_hours_consumed, 0) > 0),
      usersUsagePercent:
        tenant.users_usage_percent ??
        Math.min(999, Math.round(((tenant.users_count ?? 0) / Math.max(tenant.max_users ?? 25, 1)) * 100)),
      dashboardsUsagePercent:
        tenant.dashboards_usage_percent ??
        Math.min(999, Math.round(((tenant.dashboards_count ?? 0) / Math.max(tenant.max_dashboards ?? 20, 1)) * 100)),
      supportUsagePercent:
        tenant.support_usage_percent ??
        (toNumber(tenant.support_hours_total, 0) > 0
          ? Math.min(
              999,
              Math.round(
                (toNumber(tenant.support_hours_consumed, 0) /
                  Math.max(toNumber(tenant.support_hours_total, 0), 1)) *
                  100,
              ),
            )
          : 0),
      brandingConfigured: false,
      createdAt: tenant.created_at,
    }
  })

  const users: User[] = usersRaw.map(mapUser)
  const userNameById = new Map(users.map((user) => [user.id, `${user.firstName} ${user.lastName}`]))

  const workspaces: Workspace[] = workspacesRaw.map((workspace) => ({
    id: workspace.id,
    tenantId: workspace.tenant,
    tenantName: workspace.tenant_name,
    name: workspace.name,
    externalWorkspaceId: workspace.external_workspace_id,
    status: workspace.status,
    lastSyncAt: workspace.last_sync_at ?? new Date().toISOString(),
    dashboardsCount: workspace.dashboards_count ?? 0,
  }))
  const workspaceNameById = new Map(workspaces.map((workspace) => [workspace.id, workspace.name]))

  const accessLogs: AccessLog[] = accessLogsRaw.map(mapAccessLog)

  const viewsByDashboardId = accessLogsRaw.reduce<Record<string, number>>((acc, log) => {
    if (!log.dashboard || log.status !== 'success') return acc
    const date = new Date(log.accessed_at)
    const days = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
    if (days > 7) return acc
    acc[log.dashboard] = (acc[log.dashboard] ?? 0) + 1
    return acc
  }, {})

  const dashboards: Dashboard[] = dashboardsRaw.map((dashboard) => ({
    id: dashboard.id,
    tenantId: dashboard.tenant,
    tenantName: dashboard.tenant_name,
    name: dashboard.name,
    workspace: workspaceNameById.get(dashboard.workspace) ?? dashboard.workspace_name,
    category: dashboard.category,
    status: dashboard.status,
    updatedAt: dashboard.updated_at,
    views7d: viewsByDashboardId[dashboard.id] ?? 0,
    description: dashboard.description,
    workspaceId: dashboard.workspace,
    reportId: dashboard.report_id,
    datasetId: dashboard.dataset_id,
    embedUrl: dashboard.embed_url,
    refreshSchedule: dashboard.refresh_schedule ?? '',
    tags: dashboard.tags ?? [],
  }))
  const dashboardNameById = new Map(dashboards.map((dashboard) => [dashboard.id, dashboard.name]))

  const groups: UserGroup[] = groupsRaw.map((group) => ({
    id: group.id,
    tenantId: group.tenant,
    tenantName: tenantById.get(group.tenant) ?? 'Tenant',
    name: group.name,
    description: group.description,
    users:
      group.member_names && group.member_names.length > 0
        ? group.member_names
        : group.members.map((memberId) => userNameById.get(memberId) ?? memberId),
    dashboards:
      group.dashboard_names && group.dashboard_names.length > 0
        ? group.dashboard_names
        : group.dashboards.map((dashboardId) => dashboardNameById.get(dashboardId) ?? dashboardId),
  }))

  const dashboardColumns: DashboardColumn[] = dashboardColumnsRaw.map((column) => ({
    id: column.id,
    dashboardId: column.dashboard,
    name: column.name,
    label: column.label,
    dataType: 'string',
    values: column.values ?? [],
  }))

  const rlsRules: RLSRule[] = rlsRulesRaw.map((rule) => ({
    id: rule.id,
    tenantId: rule.tenant,
    dashboardId: rule.dashboard,
    userId: rule.user,
    tableName: rule.table_name ?? '',
    columnName: rule.column_name,
    operator: rule.operator ?? (rule.rule_type === 'deny' ? 'not_in' : 'in'),
    ruleType: rule.rule_type,
    values: rule.values,
    notes: rule.notes,
    isActive: rule.is_active,
    createdAt: rule.created_at,
    updatedAt: rule.updated_at,
  }))

  const brandings: TenantBranding[] = brandingsRaw.map((branding) => ({
    id: branding.id,
    tenantId: branding.tenant,
    tenantName: branding.tenant_name,
    platformName: branding.platform_name,
    primaryColor: branding.primary_color,
    secondaryColor: branding.secondary_color,
    domain: branding.domain,
    logoUrl: branding.logo_url,
    faviconUrl: branding.favicon_url,
  }))
  const brandingTenantIds = new Set(brandings.map((branding) => branding.tenantId))
  const tenantsWithBranding = tenants.map((tenant) => ({
    ...tenant,
    brandingConfigured: brandingTenantIds.has(tenant.id),
  }))

  return {
    tenants: tenantsWithBranding,
    users,
    dashboards,
    groups,
    accessLogs,
    brandings,
    workspaces,
    dashboardColumns,
    rlsRules,
    activities: buildActivities(accessLogs, dashboards),
    accessSeries: buildAccessSeries(accessLogs),
    roleIds: buildRoleIds(rolesRaw),
  }
}

type BackendAuditActivity = {
  id: string
  kind: 'access' | 'event'
  timestamp: string
  title: string
  description: string
  userId?: string
  userName: string
  tenantId?: string
  tenantName: string
  dashboardId?: string
  dashboardName?: string
  status?: 'success' | 'denied' | 'error' | ''
  origin?: 'portal' | 'api' | 'mobile' | ''
  category: 'auth' | 'authorization' | 'admin' | 'integration' | 'system' | 'access'
  level: 'info' | 'warn' | 'error'
  resourceType?: string
  resourceId?: string
  endpoint?: string
  method?: string
  statusCode?: number | null
}

type BackendAuditTopUser = {
  userId?: string
  userName: string
  activityCount: number
  accessCount: number
  lastActivityAt: string
  estimatedMinutes: number
}

type BackendAuditInsights = {
  request_id: string
  summary: {
    total_activities: number
    accesses_this_month: number
    active_users: number
    unique_dashboards: number
    estimated_active_minutes: number
    error_events: number
    denied_events: number
    admin_changes: number
  }
  top_users: BackendAuditTopUser[]
  activities: BackendAuditActivity[]
  access_logs: BackendAccessLog[]
}

const optionalList = async <T>(path: string): Promise<T[]> => {
  try {
    return await apiList<T>(path)
  } catch (error) {
    appLogger.warn('Falha ao carregar recurso opcional', {
      path,
      error: error instanceof Error ? error.message : 'unknown',
    })
    return []
  }
}

const toISODateKey = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

const buildAccessSeries = (logs: AccessLog[]) => {
  const now = new Date()
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now)
    date.setDate(now.getDate() - (6 - index))
    return date.toISOString().slice(0, 10)
  })

  const byDate = logs.reduce<Record<string, number>>((acc, log) => {
    const key = toISODateKey(log.accessedAt)
    if (!key) return acc
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  return dates.map((date) => ({
    date,
    accesses: byDate[date] ?? 0,
  }))
}

const buildActivities = (logs: AccessLog[], dashboards: Dashboard[]): ActivityItem[] => {
  if (logs.length > 0) {
    return logs.slice(0, 10).map((log) => ({
      id: log.id,
      tenantId: log.tenantId,
      title:
        log.status === 'success'
          ? 'Dashboard visualizado'
          : log.status === 'denied'
            ? 'Acesso negado'
            : 'Erro em visualizacao',
      description: `${log.userName} - ${log.dashboardName} (${log.origin.toUpperCase()})`,
      timestamp: log.accessedAt,
    }))
  }

  return dashboards.slice(0, 8).map((dashboard) => ({
    id: `dashboard-${dashboard.id}`,
    tenantId: dashboard.tenantId,
    title: 'Dashboard atualizado',
    description: `${dashboard.name} em ${dashboard.tenantName}`,
    timestamp: dashboard.updatedAt,
  }))
}

const normalizeTenantStatus = (status: BackendTenant['status']): Tenant['status'] =>
  status === 'active' ? 'active' : 'inactive'

const toNumber = (value: number | string | null | undefined, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

const mapTenant = (tenant: BackendTenant, options?: { brandingTenantIds?: Set<string> }): Tenant => ({
  id: tenant.id,
  name: tenant.name,
  status: normalizeTenantStatus(tenant.status),
  usersCount: tenant.users_count ?? 0,
  dashboardsCount: tenant.dashboards_count ?? 0,
  maxUsers: tenant.max_users ?? 25,
  maxDashboards: tenant.max_dashboards ?? 20,
  supportHoursTotal: toNumber(tenant.support_hours_total, 0),
  supportHoursConsumed: toNumber(tenant.support_hours_consumed, 0),
  supportHoursRemaining: toNumber(tenant.support_hours_remaining, 0),
  usersLimitReached:
    tenant.users_limit_reached ?? (tenant.users_count ?? 0) >= (tenant.max_users ?? 25),
  dashboardsLimitReached:
    tenant.dashboards_limit_reached ?? (tenant.dashboards_count ?? 0) >= (tenant.max_dashboards ?? 20),
  supportLimitReached:
    tenant.support_limit_reached ??
    (toNumber(tenant.support_hours_total, 0) > 0
      ? toNumber(tenant.support_hours_consumed, 0) >= toNumber(tenant.support_hours_total, 0)
      : toNumber(tenant.support_hours_consumed, 0) > 0),
  usersUsagePercent:
    tenant.users_usage_percent ??
    Math.min(999, Math.round(((tenant.users_count ?? 0) / Math.max(tenant.max_users ?? 25, 1)) * 100)),
  dashboardsUsagePercent:
    tenant.dashboards_usage_percent ??
    Math.min(999, Math.round(((tenant.dashboards_count ?? 0) / Math.max(tenant.max_dashboards ?? 20, 1)) * 100)),
  supportUsagePercent:
    tenant.support_usage_percent ??
    (toNumber(tenant.support_hours_total, 0) > 0
      ? Math.min(
          999,
          Math.round(
            (toNumber(tenant.support_hours_consumed, 0) /
              Math.max(toNumber(tenant.support_hours_total, 0), 1)) *
              100,
          ),
        )
      : 0),
  brandingConfigured: options?.brandingTenantIds?.has(tenant.id) ?? false,
  createdAt: tenant.created_at,
})

const mapUser = (user: BackendUser): User => ({
  id: user.id,
  firstName: user.first_name,
  lastName: user.last_name,
  email: user.email,
  tenantId: user.tenant ?? 'global',
  tenantName: user.tenant_name ?? 'LemonAI',
  role: user.role_code,
  group: user.group_name ?? '',
  groups: user.group_names ?? (user.group_name ? [user.group_name] : []),
  groupIds: user.group_ids ?? [],
  dashboardIds: user.dashboard_ids ?? [],
  status: user.status,
  lastAccessAt: user.last_login ?? new Date().toISOString(),
  avatarUrl: user.avatar_url,
})

const mapWorkspace = (workspace: BackendWorkspace): Workspace => ({
  id: workspace.id,
  tenantId: workspace.tenant,
  tenantName: workspace.tenant_name,
  name: workspace.name,
  externalWorkspaceId: workspace.external_workspace_id,
  status: workspace.status,
  lastSyncAt: workspace.last_sync_at ?? new Date().toISOString(),
  dashboardsCount: workspace.dashboards_count ?? 0,
})

const mapDashboard = (dashboard: BackendDashboard, currentById?: Map<string, Dashboard>): Dashboard => ({
  id: dashboard.id,
  tenantId: dashboard.tenant,
  tenantName: dashboard.tenant_name,
  name: dashboard.name,
  workspace: dashboard.workspace_name,
  category: dashboard.category,
  status: dashboard.status,
  updatedAt: dashboard.updated_at,
  views7d: currentById?.get(dashboard.id)?.views7d ?? 0,
  description: dashboard.description,
  workspaceId: dashboard.workspace,
  reportId: dashboard.report_id,
  datasetId: dashboard.dataset_id,
  embedUrl: dashboard.embed_url,
  refreshSchedule: dashboard.refresh_schedule ?? '',
  tags: dashboard.tags ?? [],
})

const mapGroup = (
  group: BackendGroup,
  options?: {
    userNameById?: Map<string, string>
    dashboardNameById?: Map<string, string>
    tenantNameById?: Map<string, string>
  },
): UserGroup => ({
  id: group.id,
  tenantId: group.tenant,
  tenantName: options?.tenantNameById?.get(group.tenant) ?? 'Tenant',
  name: group.name,
  description: group.description,
  users:
    group.member_names && group.member_names.length > 0
      ? group.member_names
      : group.members.map((memberId) => options?.userNameById?.get(memberId) ?? memberId),
  dashboards:
    group.dashboard_names && group.dashboard_names.length > 0
      ? group.dashboard_names
      : group.dashboards.map((dashboardId) => options?.dashboardNameById?.get(dashboardId) ?? dashboardId),
})

const mapAccessLog = (log: BackendAccessLog): AccessLog => ({
  id: log.id,
  userId: log.user ?? undefined,
  tenantId: log.tenant,
  userName: log.user_name ?? 'Usuario desconhecido',
  tenantName: log.tenant_name,
  dashboardId: log.dashboard ?? undefined,
  dashboardName: log.dashboard_name ?? 'Dashboard removido',
  ipAddress: log.ip_address,
  accessedAt: log.accessed_at,
  status: log.status,
  origin: log.origin,
  details: log.details ?? '',
})

const mapBranding = (branding: BackendBranding): TenantBranding => ({
  id: branding.id,
  tenantId: branding.tenant,
  tenantName: branding.tenant_name,
  platformName: branding.platform_name,
  primaryColor: branding.primary_color,
  secondaryColor: branding.secondary_color,
  domain: branding.domain,
  logoUrl: branding.logo_url,
  faviconUrl: branding.favicon_url,
})

const mapRLSRule = (rule: BackendRLSRule): RLSRule => ({
  id: rule.id,
  tenantId: rule.tenant,
  dashboardId: rule.dashboard,
  userId: rule.user,
  tableName: rule.table_name ?? '',
  columnName: rule.column_name,
  operator: rule.operator ?? (rule.rule_type === 'deny' ? 'not_in' : 'in'),
  ruleType: rule.rule_type,
  values: rule.values,
  notes: rule.notes,
  isActive: rule.is_active,
  createdAt: rule.created_at,
  updatedAt: rule.updated_at,
})

const mapPowerBIConnection = (connection: BackendPowerBIConnection): PowerBIConnection => ({
  id: connection.id,
  tenantId: connection.tenant,
  tenantName: connection.tenant_name,
  aadTenantId: connection.aad_tenant_id,
  clientId: connection.client_id,
  hasClientSecret: connection.has_client_secret,
  scope: connection.scope,
  apiBaseUrl: connection.api_base_url,
  defaultWorkspaceId: connection.default_workspace_id ?? '',
  isActive: connection.is_active,
  lastTestedAt: connection.last_tested_at ?? undefined,
  lastSyncAt: connection.last_sync_at ?? undefined,
  lastError: connection.last_error ?? '',
})

const mapPowerBIGateway = (gateway: BackendPowerBIGateway): PowerBIGateway => ({
  id: gateway.id,
  tenantId: gateway.tenant,
  tenantName: gateway.tenant_name,
  connectionId: gateway.connection ?? undefined,
  name: gateway.name,
  externalGatewayId: gateway.external_gateway_id,
  gatewayType: gateway.gateway_type ?? '',
  status: gateway.status,
  notes: gateway.notes ?? '',
  lastSyncAt: gateway.last_sync_at ?? undefined,
  datasourcesCount: gateway.datasources_count ?? 0,
})

const mapPowerBIGatewayDatasource = (
  datasource: BackendPowerBIGatewayDatasource,
): PowerBIGatewayDataSource => ({
  id: datasource.id,
  gatewayId: datasource.gateway,
  gatewayName: datasource.gateway_name,
  tenantId: datasource.tenant_id,
  name: datasource.name,
  externalDatasourceId: datasource.external_datasource_id,
  datasourceType: datasource.datasource_type ?? '',
  connectionDetails: datasource.connection_details ?? {},
  status: datasource.status,
})

export const platformApi = {
  async fetchTenants(options?: { brandings?: TenantBranding[] }): Promise<Tenant[]> {
    const payload = await apiList<BackendTenant>('/tenants/')
    const brandingTenantIds = new Set((options?.brandings ?? []).map((branding) => branding.tenantId))
    return payload.map((tenant) => mapTenant(tenant, { brandingTenantIds }))
  },

  async fetchUsers(): Promise<User[]> {
    const usersRaw = await apiList<BackendUser>('/users/')
    return usersRaw.map(mapUser)
  },

  async fetchDashboards(options?: { currentDashboards?: Dashboard[] }): Promise<Dashboard[]> {
    const payload = await apiList<BackendDashboard>('/dashboards/')
    const currentById = new Map((options?.currentDashboards ?? []).map((dashboard) => [dashboard.id, dashboard]))
    return payload.map((dashboard) => mapDashboard(dashboard, currentById))
  },

  async fetchGroups(options?: { users?: User[]; dashboards?: Dashboard[]; tenants?: Tenant[] }): Promise<UserGroup[]> {
    const payload = await optionalList<BackendGroup>('/users/groups/')
    const userNameById = new Map((options?.users ?? []).map((user) => [user.id, `${user.firstName} ${user.lastName}`]))
    const dashboardNameById = new Map((options?.dashboards ?? []).map((dashboard) => [dashboard.id, dashboard.name]))
    const tenantNameById = new Map((options?.tenants ?? []).map((tenant) => [tenant.id, tenant.name]))
    return payload.map((group) => mapGroup(group, { userNameById, dashboardNameById, tenantNameById }))
  },

  async fetchWorkspaces(): Promise<Workspace[]> {
    const payload = await apiList<BackendWorkspace>('/workspaces/')
    return payload.map(mapWorkspace)
  },

  async fetchBrandings(): Promise<TenantBranding[]> {
    const payload = await apiList<BackendBranding>('/branding/')
    return payload.map(mapBranding)
  },

  async fetchRLSRules(): Promise<RLSRule[]> {
    const payload = await optionalList<BackendRLSRule>('/permissions/rls-rules/')
    return payload.map(mapRLSRule)
  },

  async fetchBootstrap(options?: { userRole?: UserRole }): Promise<BootstrapPayload> {
    void options
    const bootstrap = await apiRequest<BackendBootstrapPayload>('/bootstrap/')
    return buildBootstrapPayload(bootstrap)
  },

  async fetchBootstrapFallback(options?: { userRole?: UserRole }): Promise<BootstrapPayload> {
    void options
    const [
      brandings,
      tenants,
      users,
      workspaces,
      dashboards,
      dashboardColumns,
      groups,
      accessLogs,
      rlsRules,
      roles,
    ] = await Promise.all([
      optionalList<BackendBranding>('/branding/'),
      optionalList<BackendTenant>('/tenants/'),
      optionalList<BackendUser>('/users/'),
      optionalList<BackendWorkspace>('/workspaces/'),
      optionalList<BackendDashboard>('/dashboards/'),
      optionalList<BackendDashboardColumn>('/dashboards/columns/'),
      optionalList<BackendGroup>('/users/groups/'),
      optionalList<BackendAccessLog>('/audit/logs/'),
      optionalList<BackendRLSRule>('/permissions/rls-rules/'),
      optionalList<BackendRole>('/permissions/roles/'),
    ])

    appLogger.warn('Bootstrap carregado via fallback por recursos individuais', {
      tenants: tenants.length,
      users: users.length,
      dashboards: dashboards.length,
      groups: groups.length,
    })

    return buildBootstrapPayload({
      request_id: 'bootstrap-fallback',
      tenants,
      users,
      workspaces,
      dashboards,
      dashboard_columns: dashboardColumns,
      groups,
      access_logs: accessLogs,
      brandings,
      rls_rules: rlsRules,
      roles,
    })
  },

  upsertTenant(payload: Record<string, unknown> & { id?: string }) {
    if (payload.id) {
      return apiRequest(`/tenants/${payload.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    }

    return apiRequest('/tenants/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  deleteTenant(tenantId: string) {
    return apiRequest(`/tenants/${tenantId}/`, { method: 'DELETE' })
  },

  upsertUser(payload: Record<string, unknown> & { id?: string }) {
    if (payload.id) {
      return apiRequest(`/users/${payload.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    }

    return apiRequest('/users/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  deleteUser(userId: string) {
    return apiRequest(`/users/${userId}/`, { method: 'DELETE' })
  },

  setUserPassword(userId: string, password: string) {
    return apiRequest(`/users/${userId}/set-password/`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
  },

  async deleteUsers(userIds: string[]) {
    const uniqueIds = [...new Set(userIds.filter(Boolean))]
    await Promise.all(uniqueIds.map((userId) => this.deleteUser(userId)))
  },

  upsertDashboard(payload: Record<string, unknown> & { id?: string }) {
    if (payload.id) {
      return apiRequest(`/dashboards/${payload.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    }

    return apiRequest('/dashboards/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  upsertGroup(payload: Record<string, unknown> & { id?: string }) {
    if (payload.id) {
      return apiRequest(`/users/groups/${payload.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    }

    return apiRequest('/users/groups/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  deleteGroup(groupId: string) {
    return apiRequest(`/users/groups/${groupId}/`, { method: 'DELETE' })
  },

  upsertWorkspace(payload: Record<string, unknown> & { id?: string }) {
    if (payload.id) {
      return apiRequest(`/workspaces/${payload.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    }

    return apiRequest('/workspaces/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  deleteWorkspace(workspaceId: string) {
    return apiRequest(`/workspaces/${workspaceId}/`, { method: 'DELETE' })
  },

  upsertBranding(payload: Record<string, unknown> & { id?: string }) {
    if (payload.id) {
      return apiRequest(`/branding/${payload.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    }

    return apiRequest('/branding/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  upsertRLSRule(payload: Record<string, unknown> & { id?: string }) {
    if (payload.id) {
      return apiRequest(`/permissions/rls-rules/${payload.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    }

    return apiRequest('/permissions/rls-rules/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  deleteRLSRule(ruleId: string) {
    return apiRequest(`/permissions/rls-rules/${ruleId}/`, { method: 'DELETE' })
  },

  toggleRLSRule(ruleId: string) {
    return apiRequest(`/permissions/rls-rules/${ruleId}/toggle/`, { method: 'POST' })
  },

  duplicateRLSRule(ruleId: string) {
    return apiRequest(`/permissions/rls-rules/${ruleId}/duplicate/`, { method: 'POST' })
  },

  getDashboardEmbedConfig(dashboardId: string) {
    return apiRequest<DashboardEmbedConfig>(`/dashboards/${dashboardId}/embed-config/`)
  },

  async listPowerBIConnections() {
    const payload = await apiList<BackendPowerBIConnection>('/powerbi/connections/')
    return payload.map(mapPowerBIConnection)
  },

  upsertPowerBIConnection(payload: Record<string, unknown> & { id?: string }) {
    if (payload.id) {
      return apiRequest(`/powerbi/connections/${payload.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    }

    return apiRequest('/powerbi/connections/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  deletePowerBIConnection(connectionId: string) {
    return apiRequest(`/powerbi/connections/${connectionId}/`, { method: 'DELETE' })
  },

  testPowerBIConnection(connectionId: string) {
    return apiRequest<{ detail: string; workspacesCount: number }>(
      `/powerbi/connections/${connectionId}/test-connection/`,
      { method: 'POST' },
    )
  },

  listPowerBIWorkspaces(connectionId: string) {
    return apiRequest<BackendPowerBIWorkspace[]>(`/powerbi/connections/${connectionId}/workspaces/`).then(
      (items) =>
        items.map((item) => ({
          id: item.id,
          name: item.name,
          isReadOnly: item.isReadOnly,
        }) satisfies PowerBIWorkspaceOption),
    )
  },

  listPowerBIReports(connectionId: string, workspaceId: string) {
    return apiRequest<BackendPowerBIReport[]>(
      `/powerbi/connections/${connectionId}/reports/?workspace_id=${encodeURIComponent(workspaceId)}`,
    ).then((items) =>
      items.map((item) => ({
        id: item.id,
        name: item.name,
        embedUrl: item.embedUrl,
        datasetId: item.datasetId,
      }) satisfies PowerBIReportOption),
    )
  },

  listPowerBIDatasets(connectionId: string, workspaceId: string) {
    return apiRequest<BackendPowerBIDataset[]>(
      `/powerbi/connections/${connectionId}/datasets/?workspace_id=${encodeURIComponent(workspaceId)}`,
    ).then((items) =>
      items.map((item) => ({
        id: item.id,
        name: item.name,
        isRefreshable: item.isRefreshable,
      }) satisfies PowerBIDatasetOption),
    )
  },

  syncPowerBIWorkspaces(connectionId: string) {
    return apiRequest<{ detail: string; synced: number }>(
      `/powerbi/connections/${connectionId}/sync-workspaces/`,
      { method: 'POST' },
    )
  },

  syncPowerBIReports(connectionId: string, payload: { workspace_id: string; category?: string; status?: string }) {
    return apiRequest<{ detail: string; created: number; updated: number }>(
      `/powerbi/connections/${connectionId}/sync-reports/`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    )
  },

  uploadPowerBIPbix(
    connectionId: string,
    payload: {
      workspace_id: string
      pbixFile: File
      category?: string
      status?: 'active' | 'draft' | 'archived'
      datasetDisplayName?: string
      nameConflict?: 'Abort' | 'Ignore' | 'Overwrite' | 'CreateOrOverwrite'
    },
  ) {
    const formData = new FormData()
    formData.append('workspace_id', payload.workspace_id)
    formData.append('pbix_file', payload.pbixFile)
    if (payload.category) formData.append('category', payload.category)
    if (payload.status) formData.append('status', payload.status)
    if (payload.datasetDisplayName) formData.append('dataset_display_name', payload.datasetDisplayName)
    if (payload.nameConflict) formData.append('name_conflict', payload.nameConflict)

    return apiRequest<BackendPowerBIUploadResult>(`/powerbi/connections/${connectionId}/upload-pbix/`, {
      method: 'POST',
      body: formData,
    })
  },

  syncPowerBIGateways(connectionId: string) {
    return apiRequest<{ detail: string; gatewaysSynced: number; datasourcesSynced: number }>(
      `/powerbi/connections/${connectionId}/sync-gateways/`,
      { method: 'POST' },
    )
  },

  bindDatasetToGateway(
    connectionId: string,
    payload: { dataset_id: string; gateway_id: string; datasource_ids?: string[]; datasource_id?: string },
  ) {
    return apiRequest<{ detail: string }>(`/powerbi/connections/${connectionId}/bind-dataset-gateway/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async listPowerBIGateways() {
    const payload = await apiList<BackendPowerBIGateway>('/powerbi/gateways/')
    return payload.map(mapPowerBIGateway)
  },

  upsertPowerBIGateway(payload: Record<string, unknown> & { id?: string }) {
    if (payload.id) {
      return apiRequest(`/powerbi/gateways/${payload.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    }

    return apiRequest('/powerbi/gateways/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  syncPowerBIGatewayDatasources(gatewayId: string) {
    return apiRequest<{ detail: string; synced: number }>(`/powerbi/gateways/${gatewayId}/sync-datasources/`, {
      method: 'POST',
    })
  },

  async listPowerBIGatewayDatasources() {
    const payload = await apiList<BackendPowerBIGatewayDatasource>('/powerbi/datasources/')
    return payload.map(mapPowerBIGatewayDatasource)
  },

  async getSystemSummary() {
    const payload = await apiRequest<BackendSystemSummary>('/health/summary/')
    const result: SystemSummary = {
      status: payload.status,
      requestId: payload.request_id,
      timestamp: payload.timestamp,
      counts: {
        tenants: payload.counts.tenants,
        users: payload.counts.users,
        dashboards: payload.counts.dashboards,
        workspaces: payload.counts.workspaces,
        powerbiConnections: payload.counts.powerbi_connections,
        powerbiGateways: payload.counts.powerbi_gateways,
        accessLogs: payload.counts.access_logs,
        systemEvents: payload.counts.system_events,
      },
      powerbi: {
        activeConnections: payload.powerbi.active_connections,
        connectionsWithError: payload.powerbi.connections_with_error,
        gatewaysWithError: payload.powerbi.gateways_with_error,
      },
      recent: {
        latestSystemEvent: payload.recent.latest_system_event ?? null,
        latestAccessLog: payload.recent.latest_access_log ?? null,
      },
    }
    return result
  },

  async listSystemEvents(filters?: { level?: string; category?: string; search?: string }) {
    const params = new URLSearchParams({ page_size: '100' })
    if (filters?.level) params.set('level', filters.level)
    if (filters?.category) params.set('category', filters.category)
    if (filters?.search) params.set('search', filters.search)

    const payload = await apiList<BackendSystemEventLog>(`/audit/system-events/?${params.toString()}`)
    return payload.map<SystemEventLog>((event) => ({
      id: event.id,
      userName: event.user_name ?? 'Sistema',
      tenantName: event.tenant_name ?? 'Global',
      level: event.level,
      category: event.category,
      action: event.action,
      message: event.message,
      resourceType: event.resource_type,
      resourceId: event.resource_id,
      endpoint: event.endpoint,
      method: event.method,
      requestId: event.request_id,
      ipAddress: event.ip_address ?? undefined,
      statusCode: event.status_code ?? undefined,
      metadata: event.metadata ?? {},
      createdAt: event.created_at,
    }))
  },

  async getAuditInsights(filters?: {
    period?: string
    tenant?: string
    user?: string
    dashboard?: string
    status?: string
    origin?: string
    search?: string
  }) {
    const params = new URLSearchParams()
    if (filters?.period && filters.period !== 'all') params.set('period', filters.period)
    if (filters?.tenant && filters.tenant !== 'all') params.set('tenant', filters.tenant)
    if (filters?.user && filters.user !== 'all') params.set('user', filters.user)
    if (filters?.dashboard && filters.dashboard !== 'all') params.set('dashboard', filters.dashboard)
    if (filters?.status && filters.status !== 'all') params.set('status', filters.status)
    if (filters?.origin && filters.origin !== 'all') params.set('origin', filters.origin)
    if (filters?.search?.trim()) params.set('search', filters.search.trim())

    const query = params.toString()
    const payload = await apiRequest<BackendAuditInsights>(`/audit/insights/${query ? `?${query}` : ''}`)

    return {
      requestId: payload.request_id,
      summary: {
        totalActivities: payload.summary.total_activities,
        accessesThisMonth: payload.summary.accesses_this_month,
        activeUsers: payload.summary.active_users,
        uniqueDashboards: payload.summary.unique_dashboards,
        estimatedActiveMinutes: payload.summary.estimated_active_minutes,
        errorEvents: payload.summary.error_events,
        deniedEvents: payload.summary.denied_events,
        adminChanges: payload.summary.admin_changes,
      } satisfies AuditSummary,
      topUsers: payload.top_users.map(
        (item) =>
          ({
            userId: item.userId,
            userName: item.userName,
            activityCount: item.activityCount,
            accessCount: item.accessCount,
            lastActivityAt: item.lastActivityAt,
            estimatedMinutes: item.estimatedMinutes,
          }) satisfies AuditTopUser,
      ),
      activities: payload.activities.map(
        (activity) =>
          ({
            id: activity.id,
            kind: activity.kind,
            timestamp: activity.timestamp,
            title: activity.title,
            description: activity.description,
            userId: activity.userId,
            userName: activity.userName,
            tenantId: activity.tenantId,
            tenantName: activity.tenantName,
            dashboardId: activity.dashboardId,
            dashboardName: activity.dashboardName,
            status: activity.status ?? '',
            origin: activity.origin ?? '',
            category: activity.category,
            level: activity.level,
            resourceType: activity.resourceType,
            resourceId: activity.resourceId,
            endpoint: activity.endpoint,
            method: activity.method,
            statusCode: activity.statusCode ?? undefined,
          }) satisfies AuditActivity,
      ),
      accessLogs: payload.access_logs.map(mapAccessLog),
    }
  },
}

export type { DashboardEmbedConfig }

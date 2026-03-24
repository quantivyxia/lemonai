export type UserRole = 'super_admin' | 'analyst' | 'viewer'

export type TenantStatus = 'active' | 'inactive'
export type RecordStatus = 'active' | 'draft' | 'archived'
export type AccessStatus = 'success' | 'denied' | 'error'
export type AccessOrigin = 'portal' | 'api' | 'mobile'
export type WorkspaceStatus = 'active' | 'inactive' | 'syncing'
export type RLSRuleType = 'allow' | 'deny'
export type SystemEventLevel = 'info' | 'warn' | 'error'
export type SystemEventCategory = 'auth' | 'authorization' | 'admin' | 'integration' | 'system'

export type Tenant = {
  id: string
  name: string
  status: TenantStatus
  usersCount: number
  dashboardsCount: number
  maxUsers: number
  maxDashboards: number
  supportHoursTotal: number
  supportHoursConsumed: number
  supportHoursRemaining: number
  usersLimitReached: boolean
  dashboardsLimitReached: boolean
  supportLimitReached: boolean
  usersUsagePercent: number
  dashboardsUsagePercent: number
  supportUsagePercent: number
  brandingConfigured: boolean
  createdAt: string
}

export type User = {
  id: string
  firstName: string
  lastName: string
  email: string
  password?: string
  tenantId: string
  tenantName: string
  role: UserRole
  group: string
  groups: string[]
  groupIds: string[]
  dashboardIds: string[]
  status: 'active' | 'inactive'
  lastAccessAt: string
  avatarUrl?: string
}

export type Dashboard = {
  id: string
  tenantId: string
  name: string
  tenantName: string
  workspace: string
  category: string
  status: RecordStatus
  updatedAt: string
  views7d: number
  description?: string
  workspaceId?: string
  reportId?: string
  datasetId?: string
  embedUrl?: string
  refreshSchedule?: string
  tags?: string[]
}

export type AccessSeriesPoint = {
  date: string
  accesses: number
}

export type ActivityItem = {
  id: string
  tenantId?: string
  title: string
  description: string
  timestamp: string
}

export type UserGroup = {
  id: string
  tenantId: string
  tenantName: string
  name: string
  description: string
  users: string[]
  dashboards: string[]
}

export type PermissionFeature = {
  key: string
  label: string
  description: string
}

export type PermissionMatrixRow = PermissionFeature & {
  byRole: Record<UserRole, boolean>
}

export type RoleAssignment = {
  role: UserRole
  users: string[]
  groups: string[]
}

export type AccessLog = {
  id: string
  userId?: string
  tenantId: string
  userName: string
  tenantName: string
  dashboardId?: string
  dashboardName: string
  ipAddress: string
  accessedAt: string
  status: AccessStatus
  origin: AccessOrigin
  details?: string
}

export type AuditActivity = {
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
  status?: AccessStatus | ''
  origin?: AccessOrigin | ''
  category: SystemEventCategory | 'access'
  level: SystemEventLevel
  resourceType?: string
  resourceId?: string
  endpoint?: string
  method?: string
  statusCode?: number | null
}

export type AuditTopUser = {
  userId?: string
  userName: string
  activityCount: number
  accessCount: number
  lastActivityAt: string
  estimatedMinutes: number
}

export type AuditSummary = {
  totalActivities: number
  accessesThisMonth: number
  activeUsers: number
  uniqueDashboards: number
  estimatedActiveMinutes: number
  errorEvents: number
  deniedEvents: number
  adminChanges: number
}

export type SystemEventLog = {
  id: string
  userName: string
  tenantName: string
  level: SystemEventLevel
  category: SystemEventCategory
  action: string
  message: string
  resourceType?: string
  resourceId?: string
  endpoint: string
  method: string
  requestId: string
  ipAddress?: string
  statusCode?: number
  metadata?: Record<string, unknown>
  createdAt: string
}

export type SystemSummary = {
  status: 'ok'
  requestId: string
  timestamp: string
  counts: {
    tenants: number
    users: number
    dashboards: number
    workspaces: number
    powerbiConnections: number
    powerbiGateways: number
    accessLogs: number
    systemEvents: number
  }
  powerbi: {
    activeConnections: number
    connectionsWithError: number
    gatewaysWithError: number
  }
  recent: {
    latestSystemEvent?: {
      created_at: string
      level: SystemEventLevel
      category: SystemEventCategory
      action: string
    } | null
    latestAccessLog?: {
      accessed_at: string
      status: AccessStatus
      origin: AccessOrigin
    } | null
  }
}

export type TenantBranding = {
  id?: string
  tenantId: string
  tenantName: string
  platformName: string
  primaryColor: string
  secondaryColor: string
  domain: string
  logoUrl?: string
  faviconUrl?: string
}

export type Workspace = {
  id: string
  tenantId: string
  tenantName: string
  name: string
  externalWorkspaceId: string
  status: WorkspaceStatus
  lastSyncAt: string
  dashboardsCount: number
}

export type PlatformSettings = {
  language: 'pt-BR' | 'en-US' | 'es-ES'
  notifyByEmail: boolean
  notifyInApp: boolean
  mfaRequired: boolean
  sessionTimeoutMinutes: 30 | 60 | 120 | 240
  allowExport: boolean
}

export type DashboardColumn = {
  id: string
  dashboardId: string
  name: string
  label: string
  dataType: 'string' | 'number' | 'date'
  values: string[]
}

export type RLSRule = {
  id: string
  tenantId: string
  dashboardId: string
  userId: string
  tableName: string
  columnName: string
  operator: 'in' | 'not_in'
  ruleType: RLSRuleType
  values: string[]
  notes?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type RLSRuleFormData = {
  dashboardId: string
  userId: string
  tableName: string
  columnName: string
  operator: 'in' | 'not_in'
  ruleType: RLSRuleType
  values: string[]
  notes?: string
  isActive: boolean
}

export type RLSRuleFilters = {
  userId: string
  dashboardId: string
  columnName: string
  status: 'all' | 'active' | 'inactive'
  search: string
}

export type RLSRuleGroupedByUser = {
  userId: string
  userName: string
  rules: RLSRule[]
}

export type RLSRuleGroupedByDashboard = {
  dashboardId: string
  dashboardName: string
  rules: RLSRule[]
}

export type PowerBIConnection = {
  id: string
  tenantId: string
  tenantName: string
  aadTenantId: string
  clientId: string
  hasClientSecret: boolean
  scope: string
  apiBaseUrl: string
  defaultWorkspaceId: string
  isActive: boolean
  lastTestedAt?: string
  lastSyncAt?: string
  lastError?: string
}

export type PowerBIGateway = {
  id: string
  tenantId: string
  tenantName: string
  connectionId?: string
  name: string
  externalGatewayId: string
  gatewayType?: string
  status: 'active' | 'inactive' | 'error'
  notes?: string
  lastSyncAt?: string
  datasourcesCount: number
}

export type PowerBIGatewayDataSource = {
  id: string
  gatewayId: string
  gatewayName: string
  tenantId: string
  name: string
  externalDatasourceId: string
  datasourceType?: string
  connectionDetails?: Record<string, unknown>
  status: 'active' | 'inactive'
}

export type PowerBIWorkspaceOption = {
  id: string
  name: string
  isReadOnly: boolean
}

export type PowerBIReportOption = {
  id: string
  name: string
  embedUrl?: string
  datasetId?: string
}

export type PowerBIDatasetOption = {
  id: string
  name: string
  isRefreshable: boolean
}

import type { Dashboard, DashboardColumn, RLSRule, User } from '@/types/entities'

const formatValuesHuman = (values: string[]) => {
  if (values.length === 0) return 'nenhum valor'
  if (values.length === 1) return values[0]
  if (values.length === 2) return `${values[0]} e ${values[1]}`
  return `${values.slice(0, -1).join(', ')} e ${values.at(-1)}`
}

export const getRLSRuleTechnicalPreview = (rule: RLSRule) => {
  const quoted = rule.values.map((value) => `"${value}"`).join(', ')
  const source = rule.tableName ? `${rule.tableName}.${rule.columnName}` : rule.columnName
  const op = rule.operator === 'not_in' ? 'NOT IN' : 'IN'
  return `${source} ${op} (${quoted})`
}

export const getRLSRuleSummary = (
  rule: RLSRule,
  dashboardName: string,
  userName: string,
  columnLabel?: string,
) => {
  const targetColumn = columnLabel ?? rule.columnName
  const source = rule.tableName ? `${rule.tableName}.${targetColumn}` : targetColumn
  const values = formatValuesHuman(rule.values)

  if (rule.ruleType === 'allow') {
    return `O usuario ${userName} podera visualizar no dashboard ${dashboardName} apenas os registros onde ${source} esteja entre ${values}.`
  }

  return `O usuario ${userName} nao podera visualizar no dashboard ${dashboardName} os registros onde ${source} esteja entre ${values}.`
}

export const resolveColumnLabel = (columns: DashboardColumn[], dashboardId: string, columnName: string) =>
  columns.find((column) => column.dashboardId === dashboardId && column.name === columnName)?.label ??
  columnName

export const resolveDashboardName = (dashboards: Dashboard[], dashboardId: string) =>
  dashboards.find((dashboard) => dashboard.id === dashboardId)?.name ?? 'Dashboard desconhecido'

export const resolveUserName = (users: User[], userId: string) => {
  const user = users.find((item) => item.id === userId)
  if (!user) return 'Usuario desconhecido'
  return `${user.firstName} ${user.lastName}`
}

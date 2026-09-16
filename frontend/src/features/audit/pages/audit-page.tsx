import {
  Activity,
  Clock3,
  Eye,
  FileWarning,
  RefreshCcw,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { SearchableSelect } from '@/components/shared/searchable-select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePlatformStore } from '@/hooks/use-platform-store'
import { useTenantScope } from '@/hooks/use-tenant-scope'
import { formatDate, formatNumber } from '@/lib/utils'
import { platformApi } from '@/services/platform-api'
import type { AccessLog, AccessStatus, AuditActivity, AuditSummary, AuditTopUser } from '@/types/entities'

type AuditInsightsPayload = {
  requestId: string
  summary: AuditSummary
  topUsers: AuditTopUser[]
  activities: AuditActivity[]
  accessLogs: AccessLog[]
}

type AuditFilters = {
  period: string
  tenant: string
  user: string
  dashboard: string
  status: string
  origin: string
  search: string
}

const statusVariantMap: Record<AccessStatus, 'success' | 'warning' | 'danger'> = {
  success: 'success',
  denied: 'warning',
  error: 'danger',
}

const levelVariantMap: Record<'info' | 'warn' | 'error', 'default' | 'warning' | 'danger'> = {
  info: 'default',
  warn: 'warning',
  error: 'danger',
}

const categoryLabelMap: Record<AuditActivity['category'], string> = {
  access: 'Acesso',
  admin: 'Admin',
  auth: 'Auth',
  authorization: 'Autorizacao',
  integration: 'Integracao',
  system: 'Sistema',
}

const periodFilterOptions = [
  { value: '7d', label: 'Ultimos 7 dias' },
  { value: '30d', label: 'Ultimos 30 dias' },
  { value: 'all', label: 'Periodo completo' },
]

const statusFilterOptions = [
  { value: 'all', label: 'Todos os status' },
  { value: 'success', label: 'Sucesso' },
  { value: 'denied', label: 'Negado' },
  { value: 'error', label: 'Erro' },
]

const originFilterOptions = [
  { value: 'all', label: 'Todas as origens' },
  { value: 'portal', label: 'Portal' },
  { value: 'api', label: 'API' },
  { value: 'mobile', label: 'Mobile' },
]

const formatMinutes = (minutes: number) => {
  if (minutes <= 0) return '0 min'
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours <= 0) return `${formatNumber(minutes)} min`
  if (remainingMinutes === 0) return `${formatNumber(hours)}h`
  return `${formatNumber(hours)}h ${formatNumber(remainingMinutes)}min`
}

const defaultFilters = (isSuperAdmin: boolean, userTenantId?: string | null): AuditFilters => ({
  period: '7d',
  tenant: isSuperAdmin ? 'all' : (userTenantId ?? 'all'),
  user: 'all',
  dashboard: 'all',
  status: 'all',
  origin: 'all',
  search: '',
})

export const AuditPage = () => {
  const { users, dashboards, tenants } = usePlatformStore()
  const { isSuperAdmin, userTenantId, userTenantName, filterByTenant } = useTenantScope()
  const [filters, setFilters] = useState<AuditFilters>(() => defaultFilters(isSuperAdmin, userTenantId))
  const [appliedFilters, setAppliedFilters] = useState<AuditFilters>(() => defaultFilters(isSuperAdmin, userTenantId))
  const [insights, setInsights] = useState<AuditInsightsPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const scopedUsers = useMemo(
    () => filterByTenant(users, (item) => ({ tenantId: item.tenantId })),
    [filterByTenant, users],
  )
  const scopedDashboards = useMemo(
    () => filterByTenant(dashboards, (item) => ({ tenantId: item.tenantId })),
    [dashboards, filterByTenant],
  )
  const scopedTenants = useMemo(
    () => filterByTenant(tenants, (item) => ({ tenantId: item.id })),
    [filterByTenant, tenants],
  )

  const tenantFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'Todos os tenants' },
      ...scopedTenants.map((item) => ({ value: item.id, label: item.name })),
    ],
    [scopedTenants],
  )
  const userFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'Todos os usuarios' },
      ...scopedUsers.map((item) => ({
        value: item.id,
        label: `${item.firstName} ${item.lastName}`,
        keywords: `${item.email} ${item.tenantName}`,
      })),
    ],
    [scopedUsers],
  )
  const dashboardFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'Todos os dashboards' },
      ...scopedDashboards.map((item) => ({
        value: item.id,
        label: item.name,
        keywords: `${item.tenantName} ${item.category} ${item.workspace}`,
      })),
    ],
    [scopedDashboards],
  )

  useEffect(() => {
    if (isSuperAdmin) return
    const tenantId = userTenantId ?? 'all'
    setFilters((current) => ({ ...current, tenant: tenantId }))
    setAppliedFilters((current) => ({ ...current, tenant: tenantId }))
  }, [isSuperAdmin, userTenantId])

  const loadInsights = useCallback(async (selectedFilters: AuditFilters) => {
    setIsLoading(true)
    try {
      const payload = await platformApi.getAuditInsights(selectedFilters)
      setInsights(payload)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel carregar a auditoria.'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadInsights(appliedFilters)
  }, [appliedFilters, loadInsights])

  const handleApplyFilters = () => {
    setAppliedFilters(filters)
  }

  const handleRefresh = () => {
    void loadInsights(appliedFilters)
  }

  const exportCsv = () => {
    const rows = insights?.accessLogs ?? []
    if (rows.length === 0) {
      toast.error('Nao ha logs de acesso para exportar.')
      return
    }

    const headers = ['usuario', 'tenant', 'dashboard', 'ip', 'acessado_em', 'status', 'origem', 'detalhes']
    const csvRows = rows.map((item) => [
      item.userName,
      item.tenantName,
      item.dashboardName,
      item.ipAddress,
      item.accessedAt,
      item.status,
      item.origin,
      item.details ?? '',
    ])
    const csv = [headers, ...csvRows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Arquivo CSV exportado.')
  }

  const summaryCards = useMemo(() => {
    if (!insights) return []
    return [
      {
        title: 'Tempo ativo estimado',
        value: formatMinutes(insights.summary.estimatedActiveMinutes),
        description: 'Estimativa calculada a partir da sequencia real de eventos e acessos filtrados.',
        icon: Clock3,
      },
      {
        title: 'Acessos no mes',
        value: formatNumber(insights.summary.accessesThisMonth),
        description: 'Visualizacoes bem-sucedidas de dashboard no mes corrente, respeitando os filtros atuais.',
        icon: Eye,
      },
      {
        title: 'Usuarios ativos',
        value: formatNumber(insights.summary.activeUsers),
        description: `${formatNumber(insights.summary.totalActivities)} atividades encontradas no recorte atual.`,
        icon: UserRound,
      },
      {
        title: 'Falhas e negacoes',
        value: formatNumber(insights.summary.errorEvents + insights.summary.deniedEvents),
        description: `${formatNumber(insights.summary.errorEvents)} erros e ${formatNumber(insights.summary.deniedEvents)} negacoes.`,
        icon: FileWarning,
      },
      {
        title: 'Dashboards acessados',
        value: formatNumber(insights.summary.uniqueDashboards),
        description: 'Quantidade de dashboards distintos acessados no periodo filtrado.',
        icon: ShieldCheck,
      },
      {
        title: 'Mudancas administrativas',
        value: formatNumber(insights.summary.adminChanges),
        description: 'Criacoes, edicoes, exclusoes e acoes operacionais detectadas no recorte atual.',
        icon: Activity,
      },
    ]
  }, [insights])

  return (
    <section className="animate-fade-in">
      <PageHeader
        title="Auditoria operacional"
        description="Linha do tempo consolidada de acessos e operacoes administrativas, com foco em usuario, tenant e dashboard."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>
              Exportar CSV
            </Button>
            <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </>
        }
      />

      <Card className="border-border/70 shadow-card">
        <CardHeader>
          <CardTitle>Filtros da auditoria</CardTitle>
          <CardDescription>Os indicadores, a linha do tempo e a tabela abaixo obedecem ao mesmo recorte.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 xl:grid-cols-4">
          <SearchableSelect
            value={filters.period}
            onValueChange={(value) => setFilters((current) => ({ ...current, period: value }))}
            options={periodFilterOptions}
            placeholder="Periodo"
            searchPlaceholder="Pesquisar periodo"
          />
          {isSuperAdmin ? (
            <SearchableSelect
              value={filters.tenant}
              onValueChange={(value) => setFilters((current) => ({ ...current, tenant: value }))}
              options={tenantFilterOptions}
              placeholder="Tenant"
              searchPlaceholder="Pesquisar tenant"
            />
          ) : (
            <Input value={userTenantName ?? 'Tenant atual'} disabled />
          )}
          <SearchableSelect
            value={filters.user}
            onValueChange={(value) => setFilters((current) => ({ ...current, user: value }))}
            options={userFilterOptions}
            placeholder="Usuario"
            searchPlaceholder="Pesquisar usuario"
          />
          <SearchableSelect
            value={filters.dashboard}
            onValueChange={(value) => setFilters((current) => ({ ...current, dashboard: value }))}
            options={dashboardFilterOptions}
            placeholder="Dashboard"
            searchPlaceholder="Pesquisar dashboard"
          />
          <SearchableSelect
            value={filters.status}
            onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))}
            options={statusFilterOptions}
            placeholder="Status"
            searchPlaceholder="Pesquisar status"
          />
          <SearchableSelect
            value={filters.origin}
            onValueChange={(value) => setFilters((current) => ({ ...current, origin: value }))}
            options={originFilterOptions}
            placeholder="Origem"
            searchPlaceholder="Pesquisar origem"
          />
          <Input
            className="xl:col-span-2"
            placeholder="Buscar por usuario, dashboard, IP, endpoint ou descricao"
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          />
          <Button className="xl:col-start-4" onClick={handleApplyFilters} disabled={isLoading}>
            Aplicar filtros
          </Button>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {isLoading && !insights
          ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-2xl" />)
          : summaryCards.map((card) => {
              const Icon = card.icon
              return (
                <Card key={card.title} className="border-border/70 shadow-card">
                  <CardHeader className="pb-3">
                    <CardDescription>{card.title}</CardDescription>
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-2xl">{card.value}</CardTitle>
                      <div className="rounded-xl bg-primary/10 p-2 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{card.description}</p>
                  </CardContent>
                </Card>
              )
            })}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
        <Card className="border-border/70 shadow-card">
          <CardHeader>
            <CardTitle>Linha do tempo detalhada</CardTitle>
            <CardDescription>Ultimas acoes reais executadas na plataforma, com leitura operacional por usuario.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && !insights ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : insights?.activities.length ? (
              <div className="space-y-3">
                {insights.activities.map((activity) => (
                  <div key={activity.id} className="rounded-xl border border-border/70 bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{activity.title}</p>
                          <Badge variant={levelVariantMap[activity.level]}>
                            {activity.level === 'info' ? 'Info' : activity.level === 'warn' ? 'Alerta' : 'Erro'}
                          </Badge>
                          <Badge variant="neutral">{categoryLabelMap[activity.category]}</Badge>
                          {activity.kind === 'access' && activity.status ? (
                            <Badge variant={statusVariantMap[activity.status]}>{activity.status}</Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-slate-700">{activity.description}</p>
                      </div>
                      <p className="text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                        {formatDate(activity.timestamp)}
                      </p>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <span className="font-medium text-slate-700">Usuario:</span> {activity.userName}
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">Tenant:</span> {activity.tenantName}
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">Dashboard:</span> {activity.dashboardName || '-'}
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">Origem:</span> {activity.origin || activity.method || '-'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nenhuma atividade encontrada"
                description="Nao houve eventos ou acessos com o recorte atual."
                icon={Activity}
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/70 shadow-card">
            <CardHeader>
              <CardTitle>Usuarios mais ativos</CardTitle>
              <CardDescription>Ranking calculado com base no volume de acoes e no tempo estimado de atividade.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading && !insights ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 rounded-xl" />
                  ))}
                </div>
              ) : insights?.topUsers.length ? (
                <div className="space-y-3">
                  {insights.topUsers.map((user) => (
                    <div key={`${user.userId ?? user.userName}`} className="rounded-xl border border-border/70 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{user.userName}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatNumber(user.activityCount)} acoes, {formatNumber(user.accessCount)} acessos, {formatMinutes(user.estimatedMinutes)}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDate(user.lastActivityAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Sem ranking no periodo"
                  description="Nenhuma atividade suficiente para montar ranking de usuarios."
                  icon={UserRound}
                />
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-card">
            <CardHeader>
              <CardTitle>Resumo do recorte</CardTitle>
              <CardDescription>Leitura direta do impacto operacional do periodo filtrado.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <CompactMetric label="Total de atividades" value={insights ? formatNumber(insights.summary.totalActivities) : '-'} />
              <CompactMetric label="Erros" value={insights ? formatNumber(insights.summary.errorEvents) : '-'} />
              <CompactMetric label="Negacoes" value={insights ? formatNumber(insights.summary.deniedEvents) : '-'} />
              <CompactMetric label="Mudancas admin" value={insights ? formatNumber(insights.summary.adminChanges) : '-'} />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-4 border-border/70 shadow-card">
        <CardHeader>
          <CardTitle>Tabela de acessos</CardTitle>
          <CardDescription>
            Visao tabular mantida para consulta operacional e exportacao, agora enriquecida com detalhes da ocorrencia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Dashboard</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {insights?.accessLogs.length ? (
                  insights.accessLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium text-slate-900">{log.userName}</TableCell>
                      <TableCell>{log.tenantName}</TableCell>
                      <TableCell>{log.dashboardName}</TableCell>
                      <TableCell>{log.ipAddress}</TableCell>
                      <TableCell>{formatDate(log.accessedAt)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariantMap[log.status]}>
                          {log.status === 'success' ? 'Sucesso' : log.status === 'denied' ? 'Negado' : 'Erro'}
                        </Badge>
                      </TableCell>
                      <TableCell className="uppercase text-xs tracking-[0.05em] text-muted-foreground">
                        {log.origin}
                      </TableCell>
                      <TableCell className="max-w-[320px] text-sm text-muted-foreground">
                        {log.details || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-20 text-center text-sm text-muted-foreground">
                      Nenhum log encontrado com os filtros selecionados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

const CompactMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-border/70 bg-slate-50/70 p-4">
    <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
    <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
  </div>
)

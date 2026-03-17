import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/page-header'
import { SearchableSelect } from '@/components/shared/searchable-select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePlatformStore } from '@/hooks/use-platform-store'
import { useTenantScope } from '@/hooks/use-tenant-scope'
import { formatDate } from '@/lib/utils'
import type { AccessStatus } from '@/types/entities'

const statusVariantMap: Record<AccessStatus, 'success' | 'warning' | 'danger'> = {
  success: 'success',
  denied: 'warning',
  error: 'danger',
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

export const AuditPage = () => {
  const { accessLogs, users, dashboards, tenants } = usePlatformStore()
  const { isSuperAdmin, userTenantName, filterByTenant } = useTenantScope()
  const [period, setPeriod] = useState('7d')
  const [tenant, setTenant] = useState(isSuperAdmin ? 'all' : (userTenantName ?? 'all'))
  const [user, setUser] = useState('all')
  const [dashboard, setDashboard] = useState('all')
  const [status, setStatus] = useState('all')
  const [origin, setOrigin] = useState('all')
  const [search, setSearch] = useState('')

  const scopedLogs = useMemo(
    () => filterByTenant(accessLogs, (item) => ({ tenantId: item.tenantId })),
    [accessLogs, filterByTenant],
  )
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
      ...scopedTenants.map((item) => ({ value: item.name, label: item.name })),
    ],
    [scopedTenants],
  )
  const userFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'Todos os usuarios' },
      ...scopedUsers.map((item) => {
        const fullName = `${item.firstName} ${item.lastName}`
        return { value: fullName, label: fullName }
      }),
    ],
    [scopedUsers],
  )
  const dashboardFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'Todos os dashboards' },
      ...scopedDashboards.map((item) => ({ value: item.name, label: item.name })),
    ],
    [scopedDashboards],
  )

  useEffect(() => {
    if (isSuperAdmin) {
      setTenant('all')
      return
    }
    setTenant(userTenantName ?? 'all')
  }, [isSuperAdmin, userTenantName])

  const filteredLogs = useMemo(() => {
    const now = new Date('2026-03-08T23:59:59Z').getTime()

    return scopedLogs.filter((log) => {
      const logTime = new Date(log.accessedAt).getTime()
      const diffInDays = (now - logTime) / (1000 * 60 * 60 * 24)
      const matchesPeriod =
        period === 'all' || (period === '7d' && diffInDays <= 7) || (period === '30d' && diffInDays <= 30)
      const matchesTenant =
        !isSuperAdmin || tenant === 'all' ? true : log.tenantName === tenant
      const matchesUser = user === 'all' || log.userName === user
      const matchesDashboard = dashboard === 'all' || log.dashboardName === dashboard
      const matchesStatus = status === 'all' || log.status === status
      const matchesOrigin = origin === 'all' || log.origin === origin
      const matchesSearch = `${log.userName} ${log.ipAddress}`.toLowerCase().includes(search.toLowerCase())

      return (
        matchesPeriod &&
        matchesTenant &&
        matchesUser &&
        matchesDashboard &&
        matchesStatus &&
        matchesOrigin &&
        matchesSearch
      )
    })
  }, [dashboard, isSuperAdmin, origin, period, scopedLogs, search, status, tenant, user])

  const exportCsv = () => {
    if (filteredLogs.length === 0) {
      toast.error('Nao ha logs para exportar.')
      return
    }

    const headers = ['usuario', 'tenant', 'dashboard', 'ip', 'acessado_em', 'status', 'origem']
    const rows = filteredLogs.map((item) => [
      item.userName,
      item.tenantName,
      item.dashboardName,
      item.ipAddress,
      item.accessedAt,
      item.status,
      item.origin,
    ])
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Arquivo CSV exportado.')
  }

  return (
    <section className="animate-fade-in">
      <PageHeader
        title="Auditoria de acessos"
        description="Rastreamento completo de visualizacoes, negacoes e erros por tenant."
        actions={<Button variant="outline" onClick={exportCsv}>Exportar CSV</Button>}
      />

      <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-card">
        <div className="grid gap-3 xl:grid-cols-4">
          <SearchableSelect
            value={period}
            onValueChange={setPeriod}
            options={periodFilterOptions}
            placeholder="Periodo"
            searchPlaceholder="Pesquisar periodo"
          />
          {isSuperAdmin ? (
            <SearchableSelect
              value={tenant}
              onValueChange={setTenant}
              options={tenantFilterOptions}
              placeholder="Tenant"
              searchPlaceholder="Pesquisar tenant"
            />
          ) : null}
          <SearchableSelect
            value={user}
            onValueChange={setUser}
            options={userFilterOptions}
            placeholder="Usuario"
            searchPlaceholder="Pesquisar usuario"
          />
          <SearchableSelect
            value={dashboard}
            onValueChange={setDashboard}
            options={dashboardFilterOptions}
            placeholder="Dashboard"
            searchPlaceholder="Pesquisar dashboard"
          />
          <SearchableSelect
            value={status}
            onValueChange={setStatus}
            options={statusFilterOptions}
            placeholder="Status"
            searchPlaceholder="Pesquisar status"
          />
          <SearchableSelect
            value={origin}
            onValueChange={setOrigin}
            options={originFilterOptions}
            placeholder="Origem"
            searchPlaceholder="Pesquisar origem"
          />
          <Input
            className="xl:col-span-2"
            placeholder="Buscar por usuario ou IP"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-border/70">
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium text-slate-900">{log.userName}</TableCell>
                    <TableCell>{log.tenantName}</TableCell>
                    <TableCell>{log.dashboardName}</TableCell>
                    <TableCell>{log.ipAddress}</TableCell>
                    <TableCell>{formatDate(log.accessedAt)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariantMap[log.status]}>
                        {log.status === 'success'
                          ? 'Sucesso'
                          : log.status === 'denied'
                            ? 'Negado'
                            : 'Erro'}
                      </Badge>
                    </TableCell>
                    <TableCell className="uppercase text-xs tracking-[0.05em] text-muted-foreground">
                      {log.origin}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-20 text-center text-sm text-muted-foreground">
                    Nenhum log encontrado com os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  )
}

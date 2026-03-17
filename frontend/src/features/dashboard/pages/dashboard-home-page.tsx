import { AlertTriangle, BarChart3, Building2, LogIn, Users } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { Button } from '@/components/ui/button'
import { usePlatformStore } from '@/hooks/use-platform-store'
import { useTenantScope } from '@/hooks/use-tenant-scope'
import { AccessChartCard } from '@/features/dashboard/components/access-chart-card'
import { RecentActivityCard } from '@/features/dashboard/components/recent-activity-card'
import { TopDashboardsCard } from '@/features/dashboard/components/top-dashboards-card'

export const DashboardHomePage = () => {
  const { users, dashboards, tenants, accessLogs, activities, accessSeries } = usePlatformStore()
  const { filterByTenant, isSuperAdmin, userRole } = useTenantScope()
  const canManagePlatform = userRole === 'super_admin' || userRole === 'analyst'

  const scopedUsers = useMemo(
    () => filterByTenant(users, (item) => ({ tenantId: item.tenantId })),
    [filterByTenant],
  )
  const scopedDashboards = useMemo(
    () => filterByTenant(dashboards, (item) => ({ tenantId: item.tenantId })),
    [filterByTenant],
  )
  const scopedTenants = useMemo(
    () => filterByTenant(tenants, (item) => ({ tenantId: item.id })),
    [filterByTenant],
  )
  const scopedLogs = useMemo(
    () => filterByTenant(accessLogs, (item) => ({ tenantId: item.tenantId })),
    [filterByTenant],
  )
  const scopedActivities = useMemo(
    () =>
      filterByTenant(activities, (item) => ({
        tenantId: item.tenantId,
      })),
    [filterByTenant],
  )

  const kpiMetrics = {
    users: scopedUsers.length,
    dashboards: scopedDashboards.length,
    activeTenants: isSuperAdmin
      ? tenants.filter((tenant) => tenant.status === 'active').length
      : scopedTenants.filter((tenant) => tenant.status === 'active').length,
    accesses7d: scopedLogs.filter((item) => item.status === 'success').length,
  }

  const scopedTopDashboards = useMemo(
    () =>
      [...scopedDashboards]
        .sort((a, b) => b.views7d - a.views7d)
        .slice(0, 4)
        .map((item) => ({
          id: item.id,
          name: item.name,
          views: item.views7d,
        })),
    [scopedDashboards],
  )
  const scopedAccessSeries = useMemo(() => {
    if (isSuperAdmin) return accessSeries

    const byDate = scopedLogs.reduce<Record<string, number>>((acc, log) => {
      const dateKey = log.accessedAt.slice(0, 10)
      acc[dateKey] = (acc[dateKey] ?? 0) + 1
      return acc
    }, {})

    return accessSeries.map((point) => ({
      date: point.date,
      accesses: byDate[point.date] ?? 0,
    }))
  }, [isSuperAdmin, scopedLogs])

  const globalLimitAlerts = useMemo(() => {
    if (!isSuperAdmin) return []

    return tenants
      .filter((tenant) => tenant.usersLimitReached || tenant.dashboardsLimitReached)
      .map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        users: `${tenant.usersCount}/${tenant.maxUsers}`,
        dashboards: `${tenant.dashboardsCount}/${tenant.maxDashboards}`,
      }))
  }, [isSuperAdmin, tenants])

  return (
    <section className="animate-fade-in">
      <PageHeader
        title="Visao executiva"
        description="Panorama consolidado de tenants, consumo e governanca da plataforma."
        actions={canManagePlatform ? (
          <>
            <Button variant="outline" asChild>
              <Link to="/audit">Ver auditoria</Link>
            </Button>
            <Button asChild>
              <Link to="/dashboards">Novo dashboard</Link>
            </Button>
          </>
        ) : undefined}
      />

      {globalLimitAlerts.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50/85 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-rose-700">
            <AlertTriangle className="h-4 w-4" />
            Aviso global: tenants no limite contratado
          </p>
          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {globalLimitAlerts.map((alert) => (
              <div key={alert.id} className="rounded-xl border border-rose-200/80 bg-white p-3">
                <p className="text-sm font-semibold text-slate-900">{alert.name}</p>
                <p className="text-xs text-slate-600">Usuarios: {alert.users}</p>
                <p className="text-xs text-slate-600">Dashboards: {alert.dashboards}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total de usuarios" value={`${kpiMetrics.users}`} trend="+8% vs semana anterior" icon={Users} />
        <StatCard label="Dashboards ativos" value={`${kpiMetrics.dashboards}`} trend="+5 novos publicados" icon={BarChart3} />
        <StatCard label="Tenants ativos" value={`${kpiMetrics.activeTenants}`} trend="2 com onboarding em andamento" icon={Building2} />
        <StatCard label="Acessos em 7 dias" value={`${kpiMetrics.accesses7d}`} trend="+12% em relacao ao periodo anterior" icon={LogIn} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <AccessChartCard data={scopedAccessSeries} />
        <TopDashboardsCard items={scopedTopDashboards} />
      </div>

      <div className="mt-4">
        <RecentActivityCard items={scopedActivities} />
      </div>
    </section>
  )
}

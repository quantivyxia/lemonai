import { lazy, Suspense, useEffect, useState } from 'react'

import { PageHeader } from '@/components/shared/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardsTable } from '@/features/dashboards/components/dashboards-table'
import { useAuth } from '@/hooks/use-auth'
import { apiRequest } from '@/services/api-client'

const CulturaDashboard = lazy(() => import('../cultura/cultura-dashboard').then((module) => ({ default: module.CulturaDashboard })))
const BaianaDashboard = lazy(() => import('../baiana/baiana-dashboard').then((module) => ({ default: module.BaianaDashboard })))
type PythonDashboard = { id: 'cultura-inglesa' | 'faculdade-baiana'; name: string }

export const DashboardsPage = () => {
  const { user, actorUser } = useAuth()
  // Remount on identity changes, discarding the previous tenant's data and tab.
  return <ScopedDashboardsPage key={`${actorUser?.id}:${user?.id}:${user?.tenantId}`} />
}

const ScopedDashboardsPage = () => {
  const [dashboards, setDashboards] = useState<PythonDashboard[]>([])
  const [selected, setSelected] = useState<string>('')
  const pythonAvailable = dashboards.length > 0

  useEffect(() => {
    let cancelled = false
    void apiRequest<{ dashboards: PythonDashboard[] }>('/dashboards/python/catalog/', { cache: 'no-store' })
      .then(({ dashboards: items }) => {
        if (!cancelled) {
          const available = items.filter(item => ['cultura-inglesa', 'faculdade-baiana'].includes(item.id))
          setDashboards(available)
          setSelected(available[0]?.id ?? '')
        }
      })
      .catch(() => { if (!cancelled) setDashboards([]) })
    return () => { cancelled = true }
  }, [])

  return (
    <section className="animate-fade-in">
      <PageHeader
        title="Gestao de dashboards"
        description="Organize o catalogo por tenant, workspace e categoria com controle de status."
      />
      <Tabs defaultValue="dashboards">
        {pythonAvailable && <TabsList aria-label="Abas de dashboards" className="mb-4">
          <TabsTrigger value="dashboards">Gestao de dashboards</TabsTrigger>
          <TabsTrigger value="python">Dashboard python</TabsTrigger>
        </TabsList>}
        <TabsContent value="dashboards" forceMount className="data-[state=inactive]:hidden">
          <DashboardsTable />
        </TabsContent>
        {pythonAvailable && <TabsContent value="python">
          {dashboards.length > 1 && <label className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            Cliente
            <select aria-label="Cliente do dashboard" value={selected} onChange={event => setSelected(event.target.value)}
              className="rounded-xl border bg-card px-3 py-2 text-foreground">
              {dashboards.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>}
          <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Carregando dashboard...</p>}>
            {selected === 'cultura-inglesa' && <CulturaDashboard />}
            {selected === 'faculdade-baiana' && <BaianaDashboard />}
          </Suspense>
        </TabsContent>}
      </Tabs>
    </section>
  )
}

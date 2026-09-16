import { lazy, Suspense, useEffect, useState } from 'react'

import { PageHeader } from '@/components/shared/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardsTable } from '@/features/dashboards/components/dashboards-table'
import { useAuth } from '@/hooks/use-auth'
import { apiRequest } from '@/services/api-client'

const CulturaDashboard = lazy(() => import('../cultura/cultura-dashboard').then((module) => ({ default: module.CulturaDashboard })))

export const DashboardsPage = () => {
  const { user, actorUser } = useAuth()
  // Remount on identity changes, discarding the previous tenant's data and tab.
  return <ScopedDashboardsPage key={`${actorUser?.id}:${user?.id}:${user?.tenantId}`} />
}

const ScopedDashboardsPage = () => {
  const [pythonAvailable, setPythonAvailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    void apiRequest<{ available: boolean }>('/dashboards/python/', { cache: 'no-store' })
      .then(({ available }) => { if (!cancelled) setPythonAvailable(available) })
      .catch(() => { if (!cancelled) setPythonAvailable(false) })
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
          <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Carregando dashboard...</p>}>
            <CulturaDashboard />
          </Suspense>
        </TabsContent>}
      </Tabs>
    </section>
  )
}

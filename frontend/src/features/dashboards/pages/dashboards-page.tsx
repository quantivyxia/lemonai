import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardsTable } from '@/features/dashboards/components/dashboards-table'

export const DashboardsPage = () => {
  return (
    <section className="animate-fade-in">
      <PageHeader
        title="Gestao de dashboards"
        description="Organize o catalogo por tenant, workspace e categoria com controle de status."
      />
      <Tabs defaultValue="dashboards">
        <TabsList aria-label="Abas de dashboards" className="mb-4">
          <TabsTrigger value="dashboards">Gestao de dashboards</TabsTrigger>
          <TabsTrigger value="python">Dashboard python</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboards" forceMount className="data-[state=inactive]:hidden">
          <DashboardsTable />
        </TabsContent>
        <TabsContent value="python">
          <Card>
            <CardHeader>
              <CardTitle>Dashboard python</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Nenhum dashboard Python cadastrado.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  )
}

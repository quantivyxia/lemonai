import { PageHeader } from '@/components/shared/page-header'
import { DashboardsTable } from '@/features/dashboards/components/dashboards-table'

export const DashboardsPage = () => {
  return (
    <section className="animate-fade-in">
      <PageHeader
        title="Gestao de dashboards"
        description="Organize o catalogo por tenant, workspace e categoria com controle de status."
      />
      <DashboardsTable />
    </section>
  )
}

import { PageHeader } from '@/components/shared/page-header'
import { UsersTable } from '@/features/users/components/users-table'

export const UsersPage = () => {
  return (
    <section className="animate-fade-in">
      <PageHeader
        title="Gestao de usuarios"
        description="Administre perfis, grupos e status de acesso por tenant."
      />
      <UsersTable />
    </section>
  )
}

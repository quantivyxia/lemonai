import { AlertTriangle, Building2, Palette, Plus, Search, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'
import { usePlatformStore } from '@/hooks/use-platform-store'
import { useTenantScope } from '@/hooks/use-tenant-scope'
import { formatDate } from '@/lib/utils'
import type { Tenant } from '@/types/entities'

type TenantForm = {
  id?: string
  name: string
  status: Tenant['status']
  maxUsers: number
  maxDashboards: number
  createdAt?: string
}

export const TenantsPage = () => {
  const { isViewAsMode } = useAuth()
  const { tenants, upsertTenant, deleteTenant } = usePlatformStore()
  const { isSuperAdmin, filterByTenant, userTenantName } = useTenantScope()
  const isReadOnly = isViewAsMode
  const [searchTerm, setSearchTerm] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [form, setForm] = useState<TenantForm>({
    name: '',
    status: 'active',
    maxUsers: 25,
    maxDashboards: 20,
  })

  const scopedTenants = useMemo(
    () => filterByTenant(tenants, (tenant) => ({ tenantId: tenant.id })),
    [filterByTenant, tenants],
  )

  const filteredTenants = useMemo(
    () =>
      scopedTenants.filter((tenant) => tenant.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [scopedTenants, searchTerm],
  )

  const tenantsAtLimit = useMemo(
    () =>
      scopedTenants.filter(
        (tenant) => tenant.usersLimitReached || tenant.dashboardsLimitReached,
      ),
    [scopedTenants],
  )

  const openCreate = () => {
    if (isReadOnly) return

    setForm({
      name: '',
      status: 'active',
      maxUsers: 25,
      maxDashboards: 20,
    })
    setIsDialogOpen(true)
  }

  const openEdit = (tenant: Tenant) => {
    if (!isSuperAdmin || isReadOnly) return

    setForm({
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      maxUsers: tenant.maxUsers,
      maxDashboards: tenant.maxDashboards,
      createdAt: tenant.createdAt,
    })
    setIsDialogOpen(true)
  }

  const submitForm = async () => {
    if (isReadOnly) {
      toast.error('Modo "Ver tela do usuario" permite apenas visualizacao.')
      return
    }

    if (!form.name.trim()) {
      toast.error('Preencha o nome da empresa.')
      return
    }
    if (!Number.isFinite(form.maxUsers) || form.maxUsers < 1) {
      toast.error('O limite de usuarios deve ser maior que zero.')
      return
    }
    if (!Number.isFinite(form.maxDashboards) || form.maxDashboards < 1) {
      toast.error('O limite de dashboards deve ser maior que zero.')
      return
    }

    try {
      await upsertTenant({
        id: form.id,
        name: form.name.trim(),
        status: form.status,
        maxUsers: Math.floor(form.maxUsers),
        maxDashboards: Math.floor(form.maxDashboards),
        createdAt: form.createdAt ?? new Date().toISOString(),
      })

      toast.success(form.id ? 'Tenant atualizado.' : 'Tenant criado com sucesso.')
      setIsDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar o tenant.')
    }
  }

  const handleDeleteTenant = async (tenant: Tenant) => {
    if (!isSuperAdmin || isReadOnly) return

    const confirmed = window.confirm(
      `Excluir o tenant "${tenant.name}"? Essa acao remove dashboards, workspaces, grupos e conexoes vinculadas.`,
    )
    if (!confirmed) return

    try {
      await deleteTenant(tenant.id)
      toast.success('Tenant excluido com sucesso.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel excluir o tenant.')
    }
  }

  return (
    <section className="animate-fade-in">
      <PageHeader
        title="Gestao de tenants e clientes"
        description="Controle de empresas, limites de consumo e identidade visual no ambiente multi-tenant."
        actions={
          isSuperAdmin && !isReadOnly ? (
            <Button className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Novo tenant
            </Button>
          ) : undefined
        }
      />

      {isReadOnly ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Visualizacao simulada ativa. Os tenants abaixo refletem o escopo do usuario selecionado, mas alteracoes estao bloqueadas.
        </div>
      ) : null}

      {isSuperAdmin && tenantsAtLimit.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50/85 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-rose-700">
            <AlertTriangle className="h-4 w-4" />
            Aviso global: {tenantsAtLimit.length} tenant(s) atingiram limite de uso.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {tenantsAtLimit.map((tenant) => (
              <Badge key={tenant.id} variant="danger">
                {tenant.name}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Empresas ativas</p>
          <p className="mt-1 font-display text-2xl font-semibold text-slate-900">
            {filteredTenants.filter((tenant) => tenant.status === 'active').length}
          </p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Usuarios vinculados</p>
          <p className="mt-1 font-display text-2xl font-semibold text-slate-900">
            {filteredTenants.reduce((sum, tenant) => sum + tenant.usersCount, 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Alertas de limite</p>
          <p className="mt-1 font-display text-2xl font-semibold text-slate-900">
            {
              filteredTenants.filter(
                (tenant) => tenant.usersLimitReached || tenant.dashboardsLimitReached,
              ).length
            }
          </p>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-border/70 bg-white p-4 shadow-card">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por empresa"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        {!isSuperAdmin ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Escopo atual: {userTenantName}. Sua conta nao acessa tenants de outras empresas.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {filteredTenants.map((tenant) => (
          <article
            key={tenant.id}
            className="rounded-2xl border border-border/70 bg-white p-5 shadow-card transition hover:-translate-y-px"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-lg font-semibold text-slate-900">{tenant.name}</h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Criado em {formatDate(tenant.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={tenant.status === 'active' ? 'success' : 'neutral'}>
                  {tenant.status === 'active' ? 'Ativo' : 'Inativo'}
                </Badge>
                {tenant.usersLimitReached || tenant.dashboardsLimitReached ? (
                  <Badge variant="danger">Limite atingido</Badge>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/70 p-3">
                <p className="text-xs uppercase tracking-[0.04em] text-muted-foreground">Usuarios</p>
                <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-slate-900">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  {tenant.usersCount}/{tenant.maxUsers}
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      tenant.usersLimitReached ? 'bg-rose-500' : 'bg-primary/80'
                    }`}
                    style={{ width: `${Math.min(tenant.usersUsagePercent, 100)}%` }}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-border/70 p-3">
                <p className="text-xs uppercase tracking-[0.04em] text-muted-foreground">Dashboards</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {tenant.dashboardsCount}/{tenant.maxDashboards}
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      tenant.dashboardsLimitReached ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(tenant.dashboardsUsagePercent, 100)}%` }}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-border/70 p-3">
                <p className="text-xs uppercase tracking-[0.04em] text-muted-foreground">Branding</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {tenant.brandingConfigured ? 'Configurado' : 'Pendente'}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 p-3">
                <p className="text-xs uppercase tracking-[0.04em] text-muted-foreground">Governanca</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {tenant.usersLimitReached || tenant.dashboardsLimitReached ? 'Requer acao comercial' : 'Dentro do contratado'}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              {isSuperAdmin && !isReadOnly ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => openEdit(tenant)}>
                    Editar tenant
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => void handleDeleteTenant(tenant)}>
                    Excluir tenant
                  </Button>
                </>
              ) : null}
              <Button variant="subtle" size="sm" asChild>
                <Link to={`/settings/branding?tenant=${tenant.id}`}>
                  <Palette className="mr-1 h-4 w-4" />
                  White-label
                </Link>
              </Button>
            </div>
          </article>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar tenant' : 'Novo tenant'}</DialogTitle>
            <DialogDescription>
              Defina governanca de consumo por cliente para usuarios e dashboards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Nome da empresa</label>
              <Input
                className="mt-1"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Status</label>
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/35"
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, status: event.target.value as Tenant['status'] }))
                  }
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Limite de usuarios</label>
                <Input
                  type="number"
                  min={1}
                  className="mt-1"
                  value={form.maxUsers}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      maxUsers: Number(event.target.value || 0),
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Limite de dashboards</label>
              <Input
                type="number"
                min={1}
                className="mt-1"
                value={form.maxDashboards}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    maxDashboards: Number(event.target.value || 0),
                  }))
                }
              />
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/25 p-3 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Quando o tenant atingir os limites, o perfil global recebera aviso para acao comercial.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submitForm} disabled={isReadOnly}>Salvar alteracoes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}


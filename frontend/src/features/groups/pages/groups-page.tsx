import { Layers3, Plus, Trash2, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { MultiSelectDropdown } from '@/components/shared/multi-select-dropdown'
import { PageHeader } from '@/components/shared/page-header'
import { SearchableSelect } from '@/components/shared/searchable-select'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'
import { usePlatformStore } from '@/hooks/use-platform-store'
import { useTenantScope } from '@/hooks/use-tenant-scope'
import type { UserGroup } from '@/types/entities'

type GroupForm = {
  id?: string
  tenantId: string
  name: string
  description: string
  users: string[]
  dashboards: string[]
}

export const GroupsPage = () => {
  const { isSuperAdmin, userTenantId, userTenantName } = useTenantScope()
  const { isViewAsMode, user } = useAuth()
  const { groups, tenants, users, dashboards, upsertGroup, deleteGroup } = usePlatformStore()
  const isViewer = user?.role === 'viewer'
  const isReadOnly = isViewer || isViewAsMode
  const viewerName = user?.name.trim().toLowerCase() ?? ''

  const [selectedTenantId, setSelectedTenantId] = useState(isSuperAdmin ? 'all' : (userTenantId ?? 'all'))
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [form, setForm] = useState<GroupForm>({
    tenantId: userTenantId ?? tenants[0]?.id ?? '',
    name: '',
    description: '',
    users: [],
    dashboards: [],
  })

  const scopedGroups = useMemo(
    () => {
      const tenantScoped = isSuperAdmin ? groups : groups.filter((group) => group.tenantId === userTenantId)
      if (!isViewer) return tenantScoped

      return tenantScoped.filter((group) =>
        group.users.some((groupUser) => groupUser.trim().toLowerCase() === viewerName),
      )
    },
    [groups, isSuperAdmin, isViewer, userTenantId, viewerName],
  )
  const scopedUsers = useMemo(
    () => (isSuperAdmin ? users : users.filter((user) => user.tenantId === userTenantId)),
    [isSuperAdmin, userTenantId, users],
  )
  const scopedDashboards = useMemo(
    () => (isSuperAdmin ? dashboards : dashboards.filter((dashboard) => dashboard.tenantId === userTenantId)),
    [dashboards, isSuperAdmin, userTenantId],
  )
  const filteredGroups = useMemo(
    () => scopedGroups.filter((group) => selectedTenantId === 'all' || group.tenantId === selectedTenantId),
    [scopedGroups, selectedTenantId],
  )
  const tenantFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'Todos os tenants' },
      ...tenants.map((tenant) => ({ value: tenant.id, label: tenant.name })),
    ],
    [tenants],
  )
  const selectedGroup =
    filteredGroups.find((group) => group.id === selectedGroupId) ?? filteredGroups[0] ?? null
  const tenantUsers = useMemo(
    () => scopedUsers.filter((item) => item.tenantId === form.tenantId),
    [form.tenantId, scopedUsers],
  )
  const tenantDashboards = useMemo(
    () => scopedDashboards.filter((item) => item.tenantId === form.tenantId),
    [form.tenantId, scopedDashboards],
  )
  const tenantUserOptions = useMemo(
    () =>
      tenantUsers.map((item) => {
        const fullName = `${item.firstName} ${item.lastName}`
        return { value: fullName, label: fullName, keywords: item.email }
      }),
    [tenantUsers],
  )
  const tenantDashboardOptions = useMemo(
    () => tenantDashboards.map((item) => ({ value: item.name, label: item.name })),
    [tenantDashboards],
  )

  useEffect(() => {
    if (!isSuperAdmin && userTenantId) {
      setSelectedTenantId(userTenantId)
    }
  }, [isSuperAdmin, userTenantId])

  useEffect(() => {
    if (!selectedGroup) return
    setSelectedGroupId(selectedGroup.id)
  }, [selectedGroup?.id])

  useEffect(() => {
    if (!isDialogOpen) return

    const validUsers = new Set(tenantUserOptions.map((item) => item.value))
    const validDashboards = new Set(tenantDashboardOptions.map((item) => item.value))
    setForm((current) => ({
      ...current,
      users: current.users.filter((item) => validUsers.has(item)),
      dashboards: current.dashboards.filter((item) => validDashboards.has(item)),
    }))
  }, [isDialogOpen, tenantDashboardOptions, tenantUserOptions])

  const openCreate = () => {
    if (isReadOnly) return
    setForm({
      tenantId: userTenantId ?? tenants[0]?.id ?? '',
      name: '',
      description: '',
      users: [],
      dashboards: [],
    })
    setIsDialogOpen(true)
  }

  const openEdit = (group: UserGroup) => {
    if (isReadOnly) return
    setForm({
      id: group.id,
      tenantId: group.tenantId,
      name: group.name,
      description: group.description,
      users: group.users,
      dashboards: group.dashboards,
    })
    setIsDialogOpen(true)
  }

  const submitForm = async () => {
    if (isReadOnly) return

    if (!form.name.trim() || !form.description.trim()) {
      toast.error('Preencha nome e descricao.')
      return
    }

    try {
      await upsertGroup({
        id: form.id,
        tenantId: form.tenantId,
        name: form.name.trim(),
        description: form.description.trim(),
        users: form.users,
        dashboards: form.dashboards,
      })
      toast.success(form.id ? 'Grupo atualizado.' : 'Grupo criado com sucesso.')
      setIsDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar o grupo.')
    }
  }

  const handleDeleteGroup = async (group: UserGroup) => {
    if (isReadOnly) return
    const confirmed = window.confirm(`Deseja excluir o grupo "${group.name}"?`)
    if (!confirmed) return

    try {
      await deleteGroup(group.id)
      if (selectedGroupId === group.id) {
        setSelectedGroupId('')
      }
      toast.success('Grupo excluido com sucesso.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel excluir o grupo.')
    }
  }

  return (
    <>
      <section className="animate-fade-in">
        <PageHeader
          title="Gestao de grupos"
          description={
            isReadOnly
              ? 'Visualize apenas os grupos aos quais voce pertence.'
              : 'Crie grupos por area ou cliente e associe usuarios e dashboards em lote.'
          }
          actions={!isReadOnly ? (
            <Button className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Novo grupo
            </Button>
          ) : undefined}
        />

        {isSuperAdmin ? (
          <div className="mb-4 max-w-[260px]">
            <SearchableSelect
              value={selectedTenantId}
              onValueChange={setSelectedTenantId}
              options={tenantFilterOptions}
              placeholder="Filtrar por tenant"
              searchPlaceholder="Pesquisar tenant"
            />
          </div>
        ) : (
          <div className="mb-4">
            <Badge variant="neutral">Escopo do tenant: {userTenantName}</Badge>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-3">
            {filteredGroups.map((group) => (
              <div
                key={group.id}
                className={`w-full rounded-2xl border bg-white p-4 text-left shadow-card transition ${
                  selectedGroup?.id === group.id
                    ? 'border-primary/35 ring-2 ring-primary/15'
                    : 'border-border/70 hover:border-primary/30'
                }`}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedGroupId(group.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedGroupId(group.id)
                  }
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-base font-semibold text-slate-900">{group.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
                  </div>
                  <Badge variant="neutral">{group.tenantName}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{group.users.length} usuarios</span>
                  <span>{group.dashboards.length} dashboards</span>
                </div>
                {!isReadOnly ? (
                  <div className="mt-3 flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation()
                        openEdit(group)
                      }}
                    >
                      Editar grupo
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-rose-600 hover:text-rose-700"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleDeleteGroup(group)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border/70 bg-white p-5 shadow-card">
            {selectedGroup ? (
              <>
                <div className="mb-4">
                  <h3 className="font-display text-lg font-semibold text-slate-900">{selectedGroup.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedGroup.description}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      <UsersRound className="h-3.5 w-3.5" />
                      Usuarios associados
                    </p>
                    <div className="space-y-2">
                      {selectedGroup.users.map((user) => (
                        <div key={user} className="rounded-xl border border-border/70 px-3 py-2 text-sm text-slate-700">
                          {user}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      <Layers3 className="h-3.5 w-3.5" />
                      Dashboards associados
                    </p>
                    <div className="space-y-2">
                      {selectedGroup.dashboards.map((dashboard) => (
                        <div key={dashboard} className="rounded-xl border border-border/70 px-3 py-2 text-sm text-slate-700">
                          {dashboard}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum grupo encontrado para o filtro selecionado.</p>
            )}
          </div>
        </div>
      </section>

      {!isReadOnly ? (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? 'Editar grupo' : 'Criar novo grupo'}</DialogTitle>
              <DialogDescription>
                Defina um agrupamento para simplificar permissao por area, setor ou cliente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {isSuperAdmin ? (
                <div>
                  <label className="text-sm font-medium text-slate-700">Tenant</label>
                  <Select
                    value={form.tenantId}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, tenantId: value, users: [], dashboards: [] }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div>
                <label className="text-sm font-medium text-slate-700">Nome do grupo</label>
                <Input className="mt-1" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Descricao</label>
                <textarea
                  className="mt-1 flex min-h-[90px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/35"
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">Usuarios</p>
                <MultiSelectDropdown
                  values={form.users}
                  onChange={(values) => setForm((current) => ({ ...current, users: values }))}
                  options={tenantUserOptions}
                  placeholder={tenantUserOptions.length > 0 ? 'Selecione usuarios' : 'Nenhum usuario disponivel'}
                  searchPlaceholder="Pesquisar usuario"
                  emptyMessage="Nenhum usuario encontrado."
                  disabled={tenantUserOptions.length === 0}
                />
                {tenantUserOptions.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Esse tenant ainda nao possui usuarios para associar.
                  </p>
                ) : null}
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">Dashboards</p>
                <MultiSelectDropdown
                  values={form.dashboards}
                  onChange={(values) => setForm((current) => ({ ...current, dashboards: values }))}
                  options={tenantDashboardOptions}
                  placeholder={tenantDashboardOptions.length > 0 ? 'Selecione dashboards' : 'Nenhum dashboard disponivel'}
                  searchPlaceholder="Pesquisar dashboard"
                  emptyMessage="Nenhum dashboard encontrado."
                  disabled={tenantDashboardOptions.length === 0}
                />
                {tenantDashboardOptions.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Esse tenant ainda nao possui dashboards para associar.
                  </p>
                ) : null}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={submitForm}>{form.id ? 'Salvar grupo' : 'Criar grupo'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}

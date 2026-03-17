import { Link2, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/hooks/use-auth'
import { usePlatformStore } from '@/hooks/use-platform-store'
import { useTenantScope } from '@/hooks/use-tenant-scope'
import { formatDate } from '@/lib/utils'
import type { Workspace, WorkspaceStatus } from '@/types/entities'

type WorkspaceForm = {
  id?: string
  tenantId: string
  name: string
  externalWorkspaceId: string
  status: WorkspaceStatus
  lastSyncAt: string
}

const statusVariantMap: Record<WorkspaceStatus, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  syncing: 'warning',
  inactive: 'neutral',
}

export const WorkspacesPage = () => {
  const { isViewAsMode } = useAuth()
  const { workspaces, tenants, upsertWorkspace, deleteWorkspace } = usePlatformStore()
  const { isSuperAdmin, userRole, userTenantId, userTenantName, filterByTenant } = useTenantScope()
  const isViewer = userRole === 'viewer'
  const isReadOnly = isViewer || isViewAsMode
  const [tenantFilter, setTenantFilter] = useState(isSuperAdmin ? 'all' : (userTenantName ?? 'all'))
  const [searchTerm, setSearchTerm] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [form, setForm] = useState<WorkspaceForm>({
    tenantId: userTenantId ?? tenants[0]?.id ?? '',
    name: '',
    externalWorkspaceId: '',
    status: 'active',
    lastSyncAt: new Date().toISOString(),
  })

  const scopedWorkspaces = useMemo(
    () => filterByTenant(workspaces, (item) => ({ tenantId: item.tenantId })),
    [filterByTenant, workspaces],
  )
  const tenantFilterOptions = useMemo(
    () =>
      isSuperAdmin
        ? tenants
        : tenants.filter((tenant) => tenant.id === userTenantId),
    [isSuperAdmin, tenants, userTenantId],
  )
  const tenantFilterSelectOptions = useMemo(
    () => [
      { value: 'all', label: 'Todos os tenants' },
      ...tenantFilterOptions.map((tenant) => ({ value: tenant.name, label: tenant.name })),
    ],
    [tenantFilterOptions],
  )

  const filteredData = useMemo(
    () =>
      scopedWorkspaces.filter((workspace) => {
        const matchesTenant = !isSuperAdmin || tenantFilter === 'all' || workspace.tenantName === tenantFilter
        const matchesSearch = `${workspace.name} ${workspace.externalWorkspaceId}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
        return matchesTenant && matchesSearch
      }),
    [isSuperAdmin, scopedWorkspaces, searchTerm, tenantFilter],
  )

  const openCreate = () => {
    if (isReadOnly) return
    setForm({
      tenantId: userTenantId ?? tenants[0]?.id ?? '',
      name: '',
      externalWorkspaceId: '',
      status: 'active',
      lastSyncAt: new Date().toISOString(),
    })
    setIsDialogOpen(true)
  }

  const openEdit = (workspace: Workspace) => {
    if (isReadOnly) return
    setForm({
      id: workspace.id,
      tenantId: workspace.tenantId,
      name: workspace.name,
      externalWorkspaceId: workspace.externalWorkspaceId,
      status: workspace.status,
      lastSyncAt: workspace.lastSyncAt,
    })
    setIsDialogOpen(true)
  }

  const submitForm = async () => {
    if (isReadOnly) return
    if (!form.tenantId || !form.name.trim() || !form.externalWorkspaceId.trim()) {
      toast.error('Preencha tenant, nome e external workspace id.')
      return
    }

    try {
      await upsertWorkspace({
        id: form.id,
        tenantId: form.tenantId,
        name: form.name.trim(),
        externalWorkspaceId: form.externalWorkspaceId.trim(),
        status: form.status,
        lastSyncAt: form.lastSyncAt || new Date().toISOString(),
      })
      toast.success(form.id ? 'Workspace atualizado.' : 'Workspace criado com sucesso.')
      setIsDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar o workspace.')
    }
  }

  const handleDeleteWorkspace = async (workspace: Workspace) => {
    if (isReadOnly) return

    const warning = workspace.dashboardsCount > 0
      ? `Excluir o workspace "${workspace.name}" vai remover ${workspace.dashboardsCount} dashboard(s) vinculados. Deseja continuar?`
      : `Deseja excluir o workspace "${workspace.name}"?`

    if (!window.confirm(warning)) return

    try {
      await deleteWorkspace(workspace.id)
      toast.success('Workspace excluido com sucesso.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel excluir o workspace.')
    }
  }

  return (
    <>
      <section className="animate-fade-in">
        <PageHeader
          title="Gestao de workspaces"
          description={
            isReadOnly
              ? 'Visualizacao em modo leitura dos workspaces disponiveis.'
              : 'Organize ambientes externos, sincronizacao e mapeamento tecnico por tenant.'
          }
          actions={!isReadOnly ? (
            <Button className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Novo workspace
            </Button>
          ) : undefined}
        />

        <div className="rounded-2xl border border-border/70 bg-white p-5 shadow-card">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col gap-3 md:flex-row">
              <div className="relative w-full md:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por nome ou workspace id"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              {isSuperAdmin ? (
                <SearchableSelect
                  value={tenantFilter}
                  onValueChange={setTenantFilter}
                  options={tenantFilterSelectOptions}
                  placeholder="Tenant"
                  searchPlaceholder="Pesquisar tenant"
                  triggerClassName="w-full md:max-w-[240px]"
                />
              ) : null}
            </div>
              <Button
                variant="outline"
                className="gap-2"
                disabled={isReadOnly}
                onClick={() => toast.success('Sincronizacao simulada no frontend.')}
              >
              <RefreshCcw className="h-4 w-4" />
              Sincronizar todos
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>External Workspace ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ultimo Sync</TableHead>
                  <TableHead>Dashboards</TableHead>
                  <TableHead>Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length > 0 ? (
                  filteredData.map((workspace) => (
                    <TableRow key={workspace.id}>
                      <TableCell className="font-medium text-slate-900">{workspace.name}</TableCell>
                      <TableCell>{workspace.tenantName}</TableCell>
                      <TableCell className="font-mono text-xs">{workspace.externalWorkspaceId}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariantMap[workspace.status]}>{workspace.status}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(workspace.lastSyncAt)}</TableCell>
                      <TableCell>{workspace.dashboardsCount}</TableCell>
                      <TableCell>
                        {isReadOnly ? (
                          <Badge variant="neutral">Somente leitura</Badge>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(workspace)}>
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-rose-600 hover:text-rose-700"
                              onClick={() => void handleDeleteWorkspace(workspace)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-20 text-center text-sm text-muted-foreground">
                      Nenhum workspace encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      {!isReadOnly ? (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? 'Editar workspace' : 'Novo workspace'}</DialogTitle>
              <DialogDescription>
                Configure identificadores tecnicos e status de sincronizacao.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              {isSuperAdmin ? (
                <div>
                  <label className="text-sm font-medium text-slate-700">Tenant</label>
                  <Select value={form.tenantId} onValueChange={(value) => setForm((current) => ({ ...current, tenantId: value }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tenantFilterOptions.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div>
                <label className="text-sm font-medium text-slate-700">Nome do workspace</label>
                <Input className="mt-1" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">External Workspace ID</label>
                <Input className="mt-1" value={form.externalWorkspaceId} onChange={(event) => setForm((current) => ({ ...current, externalWorkspaceId: event.target.value }))} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">Status</label>
                  <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as WorkspaceStatus }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="syncing">Sincronizando</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Ultimo sync (ISO)</label>
                  <Input className="mt-1" value={form.lastSyncAt} onChange={(event) => setForm((current) => ({ ...current, lastSyncAt: event.target.value }))} />
                </div>
              </div>
              <p className="rounded-lg border border-border/70 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
                <Link2 className="mr-1 inline h-3.5 w-3.5" />
                Estes dados sao usados para mapear dashboards e preparar embed token no backend.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={submitForm}>{form.id ? 'Salvar' : 'Criar workspace'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}

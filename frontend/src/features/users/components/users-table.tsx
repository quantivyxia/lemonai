import { flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table'
import { Copy, Eye, EyeOff, Filter, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { MultiSelectDropdown } from '@/components/shared/multi-select-dropdown'
import { SearchableSelect } from '@/components/shared/searchable-select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
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
import type { User } from '@/types/entities'

const roleLabelMap: Record<User['role'], string> = {
  super_admin: 'Super_admin',
  analyst: 'Analista',
  viewer: 'Usuario',
}

const userStatusFilterOptions = [
  { value: 'all', label: 'Todos os status' },
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
]

type UserForm = {
  id?: string
  firstName: string
  lastName: string
  email: string
  tenantId: string
  role: User['role']
  groupIds: string[]
  dashboardIds: string[]
  password: string
  status: User['status']
}

export const UsersTable = () => {
  const navigate = useNavigate()
  const { actorUser, isViewAsMode, startViewAs } = useAuth()
  const { isSuperAdmin, userTenantName, userTenantId, filterByTenant } = useTenantScope()
  const { users, tenants, groups, dashboards, upsertUser, toggleUserStatus, deleteUser, deleteUsers } = usePlatformStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [tenantFilter, setTenantFilter] = useState(isSuperAdmin ? 'all' : (userTenantName ?? 'all'))
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState<UserForm>({
    tenantId: userTenantId ?? tenants[0]?.id ?? '',
    firstName: '',
    lastName: '',
    email: '',
    role: 'viewer',
    groupIds: [],
    dashboardIds: [],
    password: '',
    status: 'active',
  })

  const buildSuggestedPassword = () => {
    const randomDigits = Math.floor(100000 + Math.random() * 900000)
    return `${randomDigits}`
  }

  const scopedUsers = useMemo(
    () => filterByTenant(users, (item) => ({ tenantId: item.tenantId })),
    [filterByTenant, users],
  )
  const tenantFilterOptions = useMemo(
    () =>
      isSuperAdmin
        ? tenants
        : tenants.filter((tenant) => tenant.name === userTenantName),
    [isSuperAdmin, tenants, userTenantName],
  )
  const tenantFilterSelectOptions = useMemo(
    () => [
      { value: 'all', label: 'Todos os tenants' },
      ...tenantFilterOptions.map((tenant) => ({ value: tenant.name, label: tenant.name })),
    ],
    [tenantFilterOptions],
  )
  const groupOptions = useMemo(
    () =>
      groups
        .filter((group) => group.tenantId === form.tenantId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [form.tenantId, groups],
  )
  const dashboardOptions = useMemo(
    () =>
      dashboards
        .filter((dashboard) => dashboard.tenantId === form.tenantId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [dashboards, form.tenantId],
  )
  const dashboardNameById = useMemo(
    () => new Map(dashboards.map((dashboard) => [dashboard.id, dashboard.name])),
    [dashboards],
  )

  useEffect(() => {
    setTenantFilter(isSuperAdmin ? 'all' : (userTenantName ?? 'all'))
  }, [isSuperAdmin, userTenantName])

  useEffect(() => {
    if (!isDialogOpen) return

    setForm((current) => ({
      ...current,
      groupIds: current.groupIds.filter((groupId) => groupOptions.some((group) => group.id === groupId)),
      dashboardIds: current.dashboardIds.filter((dashboardId) =>
        dashboardOptions.some((dashboard) => dashboard.id === dashboardId),
      ),
    }))
  }, [dashboardOptions, groupOptions, isDialogOpen])

  const filteredData = useMemo(() => {
    return scopedUsers.filter((user) => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase()
      const matchesSearch =
        fullName.includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesTenant = !isSuperAdmin || tenantFilter === 'all' || user.tenantName === tenantFilter
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter
      return matchesSearch && matchesTenant && matchesStatus
    })
  }, [isSuperAdmin, scopedUsers, searchTerm, statusFilter, tenantFilter])

  useEffect(() => {
    const visibleIds = new Set(filteredData.map((user) => user.id))
    setSelectedUserIds((current) => current.filter((id) => visibleIds.has(id)))
  }, [filteredData])

  const openCreateDialog = () => {
    if (isViewAsMode) return
    const nextTenantId = userTenantId ?? tenants[0]?.id ?? ''
    setShowPassword(false)
    setForm({
      tenantId: nextTenantId,
      firstName: '',
      lastName: '',
      email: '',
      role: 'viewer',
      groupIds: [],
      dashboardIds: [],
      password: buildSuggestedPassword(),
      status: 'active',
    })
    setIsDialogOpen(true)
  }

  const openEditDialog = (user: User) => {
    if (isViewAsMode) return
    setShowPassword(false)
    setForm({
      id: user.id,
      tenantId: user.tenantId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      groupIds: user.groupIds ?? [],
      dashboardIds: user.dashboardIds ?? [],
      password: user.password ?? '',
      status: user.status,
    })
    setIsDialogOpen(true)
  }

  const submitForm = async () => {
    if (isViewAsMode) {
      toast.error('Modo "Ver tela do usuario" permite apenas visualizacao.')
      return
    }
    const isCreate = !form.id

    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      toast.error('Preencha nome, sobrenome e e-mail.')
      return
    }
    if (isCreate && !form.password.trim()) {
      toast.error('Defina uma senha inicial para o usuario.')
      return
    }
    if (form.password.trim() && !/^\d{6}$/.test(form.password.trim())) {
      toast.error('A senha inicial deve ter exatamente 6 digitos numericos.')
      return
    }

    try {
      const selectedGroups = groupOptions
        .filter((group) => form.groupIds.includes(group.id))
        .map((group) => group.name)

      await upsertUser({
        id: form.id,
        tenantId: form.tenantId,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        role: form.role,
        group: selectedGroups[0] ?? '',
        groups: selectedGroups,
        groupIds: form.groupIds,
        dashboardIds: form.dashboardIds,
        ...((isCreate || form.password.trim()) ? { password: form.password.trim() } : {}),
        status: form.status,
      })
      toast.success(form.id ? 'Usuario atualizado.' : 'Usuario criado com sucesso.')
      setIsDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar o usuario.')
    }
  }

  const refreshPasswordSuggestion = () => {
    setForm((current) => ({ ...current, password: buildSuggestedPassword() }))
  }

  const copyPasswordToClipboard = async () => {
    if (!form.password.trim()) return
    await navigator.clipboard.writeText(form.password.trim())
    toast.success('Senha copiada para a area de transferencia.')
  }

  const handleDeleteUser = async (target: User) => {
    if (isViewAsMode) {
      toast.error('Modo "Ver tela do usuario" permite apenas visualizacao.')
      return
    }

    if (actorUser?.id === target.id) {
      toast.error('Voce nao pode excluir seu proprio usuario.')
      return
    }

    const confirmed = window.confirm(`Deseja excluir o usuario "${target.firstName} ${target.lastName}"?`)
    if (!confirmed) return

    try {
      await deleteUser(target.id)
      setSelectedUserIds((current) => current.filter((id) => id !== target.id))
      toast.success('Usuario excluido com sucesso.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel excluir o usuario.')
    }
  }

  const handleDeleteSelectedUsers = async () => {
    if (isViewAsMode) {
      toast.error('Modo "Ver tela do usuario" permite apenas visualizacao.')
      return
    }

    if (selectedUserIds.length === 0) return

    const idsToDelete = [...new Set(selectedUserIds.filter((id) => id !== actorUser?.id))]
    const skippedOwnUser = selectedUserIds.length - idsToDelete.length

    if (idsToDelete.length === 0) {
      toast.error('Nenhum usuario valido selecionado para exclusao.')
      return
    }

    const confirmed = window.confirm(`Deseja excluir ${idsToDelete.length} usuario(s) selecionado(s)?`)
    if (!confirmed) return

    try {
      await deleteUsers(idsToDelete)
      setSelectedUserIds([])
      toast.success(
        skippedOwnUser > 0
          ? `${idsToDelete.length} usuario(s) excluido(s). ${skippedOwnUser} ignorado(s) por ser sua propria conta.`
          : `${idsToDelete.length} usuario(s) excluido(s) com sucesso.`,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel excluir usuarios selecionados.')
    }
  }

  const handleStartViewAs = (target: User) => {
    startViewAs({
      id: target.id,
      name: `${target.firstName} ${target.lastName}`.trim(),
      email: target.email,
      role: target.role,
      tenantId: target.tenantId,
      tenantName: target.tenantName,
    })
    toast.success(`Visualizacao iniciada como ${target.firstName} ${target.lastName}.`)
    void navigate('/')
  }

  const table = useReactTable({
    data: filteredData,
    columns: [
      {
        id: 'select',
        header: ({ table }) => {
          const pageUserIds = table.getRowModel().rows.map((row) => row.original.id)
          const selectedInPage = pageUserIds.filter((id) => selectedUserIds.includes(id)).length
          const checkedState: boolean | 'indeterminate' =
            pageUserIds.length === 0 ? false : selectedInPage === pageUserIds.length ? true : selectedInPage > 0 ? 'indeterminate' : false

          return (
            <Checkbox
              checked={checkedState}
              onCheckedChange={(checked) => {
                const shouldCheck = !!checked
                setSelectedUserIds((current) =>
                  shouldCheck
                    ? [...new Set([...current, ...pageUserIds])]
                    : current.filter((id) => !pageUserIds.includes(id)),
                )
              }}
              aria-label="Selecionar usuarios exibidos"
            />
          )
        },
        cell: ({ row }) => (
          <Checkbox
            checked={selectedUserIds.includes(row.original.id)}
            onCheckedChange={(checked) =>
              setSelectedUserIds((current) =>
                checked === true
                  ? [...new Set([...current, row.original.id])]
                  : current.filter((id) => id !== row.original.id),
              )
            }
            aria-label={`Selecionar usuario ${row.original.firstName} ${row.original.lastName}`}
          />
        ),
      },
      {
        accessorKey: 'firstName',
        header: 'Usuario',
        cell: ({ row }) => {
          const fullName = `${row.original.firstName} ${row.original.lastName}`
          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback>
                  {row.original.firstName.slice(0, 1)}
                  {row.original.lastName.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-slate-900">{fullName}</p>
                <p className="text-xs text-muted-foreground">{row.original.email}</p>
              </div>
            </div>
          )
        },
      },
      { accessorKey: 'tenantName', header: 'Tenant' },
      { accessorKey: 'role', header: 'Perfil', cell: ({ row }) => roleLabelMap[row.original.role] },
      {
        accessorKey: 'group',
        header: 'Grupos',
        cell: ({ row }) => {
          const groupNames = row.original.groups?.length > 0
            ? row.original.groups
            : (row.original.group ? [row.original.group] : [])
          if (groupNames.length === 0) return '-'
          return groupNames.join(', ')
        },
      },
      {
        id: 'dashboards',
        header: 'Dashboards',
        cell: ({ row }) => {
          const direct = row.original.dashboardIds ?? []
          const fromGroups = groups
            .filter((group) => (row.original.groupIds ?? []).includes(group.id))
            .flatMap((group) => group.dashboards)
          const names = [...new Set([...direct.map((id) => dashboardNameById.get(id) ?? id), ...fromGroups])]
          if (names.length === 0) return '-'
          return names.length <= 2 ? names.join(', ') : `${names[0]}, ${names[1]} +${names.length - 2}`
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'active' ? 'success' : 'neutral'}>
            {row.original.status === 'active' ? 'Ativo' : 'Inativo'}
          </Badge>
        ),
      },
      { accessorKey: 'lastAccessAt', header: 'Ultimo acesso', cell: ({ row }) => formatDate(row.original.lastAccessAt) },
      {
        id: 'actions',
        header: 'Acoes',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => openEditDialog(row.original)}>
              Editar
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              title="Excluir usuario"
              onClick={() => void handleDeleteUser(row.original)}
              disabled={isViewAsMode || actorUser?.id === row.original.id}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {!isViewAsMode ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Ver tela do usuario"
                aria-label={`Ver tela do usuario ${row.original.firstName} ${row.original.lastName}`}
                onClick={() => handleStartViewAs(row.original)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (isViewAsMode) {
                  toast.error('Modo "Ver tela do usuario" permite apenas visualizacao.')
                  return
                }
                try {
                  await toggleUserStatus(row.original.id)
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Nao foi possivel atualizar o status.')
                }
              }}
            >
              {row.original.status === 'active' ? 'Desativar' : 'Ativar'}
            </Button>
          </div>
        ),
      },
    ],
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <>
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 md:flex-row">
              <div className="relative w-full md:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por nome ou e-mail"
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
                  triggerClassName="w-full md:max-w-[220px]"
                />
              ) : null}
              <SearchableSelect
                value={statusFilter}
                onValueChange={setStatusFilter}
                options={userStatusFilterOptions}
                placeholder="Status"
                searchPlaceholder="Pesquisar status"
                triggerClassName="w-full md:max-w-[180px]"
              />
            </div>
            <div className="flex items-center gap-2">
              {selectedUserIds.length > 0 && !isViewAsMode ? (
                <Button variant="destructive" className="gap-2" onClick={() => void handleDeleteSelectedUsers()}>
                  <Trash2 className="h-4 w-4" />
                  Excluir selecionados ({selectedUserIds.length})
                </Button>
              ) : null}
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Filtros
              </Button>
              <Button className="gap-2" onClick={openCreateDialog} disabled={isViewAsMode}>
                <Plus className="h-4 w-4" />
                Novo usuario
              </Button>
            </div>
          </div>

          {isViewAsMode ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Visualizacao simulada ativa. Os dados abaixo representam o ambiente do usuario, mas alteracoes estao bloqueadas.
            </div>
          ) : null}

          <div className="rounded-xl border border-border/70">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell className="h-20 text-center text-sm text-muted-foreground" colSpan={table.getAllLeafColumns().length}>
                      Nenhum usuario encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{table.getRowModel().rows.length} registros exibidos</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                Proxima
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar usuario' : 'Novo usuario'}</DialogTitle>
            <DialogDescription>Gerencie perfil, grupo e tenant do usuario.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {isSuperAdmin ? (
              <div>
                <label className="text-sm font-medium text-slate-700">Tenant</label>
                <Select
                  value={form.tenantId}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      tenantId: value,
                      groupIds: [],
                      dashboardIds: [],
                      password: current.id ? current.password : buildSuggestedPassword(),
                    }))
                  }
                >
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
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Nome</label>
                <Input className="mt-1" value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Sobrenome</label>
                <Input className="mt-1" value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">E-mail</label>
              <Input className="mt-1" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">
                {form.id ? 'Senha do usuario' : 'Senha inicial'}
              </label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder={form.id ? 'Visualize ou altere a senha' : ''}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowPassword((current) => !current)}
                  title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={refreshPasswordSuggestion}
                  title={form.id ? 'Gerar nova senha' : 'Gerar nova sugestao'}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyPasswordToClipboard}
                  title="Copiar senha"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {form.id
                  ? 'Voce pode visualizar ou trocar a senha. Use 6 digitos numericos.'
                  : 'Sugestao automatica: senha numerica de 6 digitos.'}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Perfil</label>
                <Select value={form.role} onValueChange={(value) => setForm((current) => ({ ...current, role: value as User['role'] }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isSuperAdmin ? <SelectItem value="super_admin">Super_admin</SelectItem> : null}
                    <SelectItem value="analyst">Analista</SelectItem>
                    <SelectItem value="viewer">Usuario</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Status</label>
                <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as User['status'] }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Grupos (multiplos)</label>
                <div className="mt-1">
                  <MultiSelectDropdown
                    values={form.groupIds}
                    onChange={(values) => setForm((current) => ({ ...current, groupIds: values }))}
                    options={groupOptions.map((group) => ({ value: group.id, label: group.name }))}
                    placeholder={groupOptions.length > 0 ? 'Selecione os grupos' : 'Nenhum grupo disponivel'}
                    searchPlaceholder="Pesquisar grupo"
                    emptyMessage="Nenhum grupo encontrado."
                    disabled={groupOptions.length === 0}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Dashboards (acesso direto)</label>
                <div className="mt-1">
                  <MultiSelectDropdown
                    values={form.dashboardIds}
                    onChange={(values) => setForm((current) => ({ ...current, dashboardIds: values }))}
                    options={dashboardOptions.map((dashboard) => ({ value: dashboard.id, label: dashboard.name }))}
                    placeholder={dashboardOptions.length > 0 ? 'Selecione dashboards' : 'Nenhum dashboard disponivel'}
                    searchPlaceholder="Pesquisar dashboard"
                    emptyMessage="Nenhum dashboard encontrado."
                    disabled={dashboardOptions.length === 0}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submitForm} disabled={isViewAsMode}>{form.id ? 'Salvar' : 'Criar usuario'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}


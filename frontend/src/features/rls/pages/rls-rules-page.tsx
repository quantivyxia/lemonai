import { Copy, Plus, Search, ShieldAlert, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { MultiSelectDropdown } from '@/components/shared/multi-select-dropdown'
import { PageHeader } from '@/components/shared/page-header'
import { SearchableSelect } from '@/components/shared/searchable-select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { usePlatformStore } from '@/hooks/use-platform-store'
import { useTenantScope } from '@/hooks/use-tenant-scope'
import { formatDate } from '@/lib/utils'
import {
  getRLSRuleSummary,
  getRLSRuleTechnicalPreview,
  resolveColumnLabel,
  resolveDashboardName,
  resolveUserName,
} from '@/features/rls/lib/rls-helpers'
import type {
  RLSRule,
  RLSRuleFilters,
  RLSRuleFormData,
  RLSRuleGroupedByDashboard,
  RLSRuleGroupedByUser,
} from '@/types/entities'

type RuleFormState = RLSRuleFormData & { id?: string }

const defaultFilters: RLSRuleFilters = {
  userId: 'all',
  dashboardId: 'all',
  columnName: 'all',
  status: 'all',
  search: '',
}

const defaultForm: RuleFormState = {
  dashboardId: '',
  userId: '',
  tableName: '',
  columnName: '',
  operator: 'in',
  ruleType: 'allow',
  values: [],
  notes: '',
  isActive: true,
}

const ruleStatusFilterOptions = [
  { value: 'all', label: 'Todos os status' },
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
]

export const RLSRulesPage = () => {
  const { isViewAsMode } = useAuth()
  const {
    dashboards,
    users,
    dashboardColumns,
    rlsRules,
    upsertRLSRule,
    deleteRLSRule,
    toggleRLSRuleStatus,
    duplicateRLSRule,
  } = usePlatformStore()
  const { canManageRLS, filterByTenant } = useTenantScope()
  const isReadOnly = isViewAsMode

  const [activeTab, setActiveTab] = useState('rules')
  const [filters, setFilters] = useState<RLSRuleFilters>(defaultFilters)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<RuleFormState>(defaultForm)
  const [valueInput, setValueInput] = useState('')
  const [userViewId, setUserViewId] = useState('all')
  const [dashboardViewId, setDashboardViewId] = useState('all')

  const scopedDashboards = useMemo(
    () => filterByTenant(dashboards, (i) => ({ tenantId: i.tenantId })),
    [dashboards, filterByTenant],
  )
  const scopedUsers = useMemo(
    () => filterByTenant(users, (i) => ({ tenantId: i.tenantId })),
    [filterByTenant, users],
  )
  const scopedRules = useMemo(
    () => filterByTenant(rlsRules, (i) => ({ tenantId: i.tenantId })),
    [filterByTenant, rlsRules],
  )
  const scopedColumns = useMemo(() => {
    const dashboardIds = new Set(scopedDashboards.map((d) => d.id))
    return dashboardColumns.filter((c) => dashboardIds.has(c.dashboardId))
  }, [dashboardColumns, scopedDashboards])

  const formColumns = useMemo(
    () => scopedColumns.filter((c) => c.dashboardId === form.dashboardId),
    [form.dashboardId, scopedColumns],
  )
  const formValues = useMemo(
    () => formColumns.find((c) => c.name === form.columnName)?.values ?? [],
    [form.columnName, formColumns],
  )
  const formCatalogValueOptions = useMemo(
    () => formValues.map((value) => ({ value, label: value })),
    [formValues],
  )
  const formUsers = useMemo(() => {
    const tenantId = scopedDashboards.find((d) => d.id === form.dashboardId)?.tenantId
    return tenantId ? scopedUsers.filter((u) => u.tenantId === tenantId) : scopedUsers
  }, [form.dashboardId, scopedDashboards, scopedUsers])

  useEffect(() => {
    if (userViewId !== 'all' && !scopedUsers.some((u) => u.id === userViewId)) setUserViewId('all')
    if (dashboardViewId !== 'all' && !scopedDashboards.some((d) => d.id === dashboardViewId)) setDashboardViewId('all')
  }, [dashboardViewId, scopedDashboards, scopedUsers, userViewId])

  useEffect(() => {
    if (form.userId && !formUsers.some((u) => u.id === form.userId)) setForm((c) => ({ ...c, userId: '' }))
    if (form.values.length > 0 && formValues.length > 0) {
      const allowed = new Set(formValues)
      const next = form.values.filter((v) => allowed.has(v))
      if (next.length !== form.values.length) setForm((c) => ({ ...c, values: next }))
    }
  }, [form.columnName, form.userId, form.values, formColumns, formUsers, formValues])

  const columnFilterOptions = useMemo(() => [...new Set(scopedColumns.map((c) => c.name))].sort(), [scopedColumns])
  const userFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'Todos os usuarios' },
      ...scopedUsers.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` })),
    ],
    [scopedUsers],
  )
  const dashboardFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'Todos os dashboards' },
      ...scopedDashboards.map((d) => ({ value: d.id, label: d.name })),
    ],
    [scopedDashboards],
  )
  const columnFilterSelectOptions = useMemo(
    () => [
      { value: 'all', label: 'Todas as colunas' },
      ...columnFilterOptions.map((column) => ({ value: column, label: column })),
    ],
    [columnFilterOptions],
  )

  const filteredRules = useMemo(() => {
    return scopedRules.filter((rule) => {
      if (filters.userId !== 'all' && rule.userId !== filters.userId) return false
      if (filters.dashboardId !== 'all' && rule.dashboardId !== filters.dashboardId) return false
      if (filters.columnName !== 'all' && rule.columnName !== filters.columnName) return false
      if (filters.status === 'active' && !rule.isActive) return false
      if (filters.status === 'inactive' && rule.isActive) return false

      const dashboardName = resolveDashboardName(scopedDashboards, rule.dashboardId)
      const userName = resolveUserName(scopedUsers, rule.userId)
      const columnLabel = resolveColumnLabel(scopedColumns, rule.dashboardId, rule.columnName)
      const blob = `${dashboardName} ${userName} ${columnLabel} ${getRLSRuleSummary(rule, dashboardName, userName, columnLabel)} ${getRLSRuleTechnicalPreview(rule)} ${rule.notes ?? ''}`.toLowerCase()
      return blob.includes(filters.search.toLowerCase())
    })
  }, [filters, scopedColumns, scopedDashboards, scopedRules, scopedUsers])

  const groupedByUser = useMemo<RLSRuleGroupedByUser[]>(() => {
    const map = new Map<string, RLSRule[]>()
    scopedRules.forEach((rule) => {
      if (userViewId !== 'all' && rule.userId !== userViewId) return
      map.set(rule.userId, [...(map.get(rule.userId) ?? []), rule])
    })
    return [...map.entries()]
      .map(([userId, rules]) => ({ userId, userName: resolveUserName(scopedUsers, userId), rules }))
      .sort((a, b) => a.userName.localeCompare(b.userName))
  }, [scopedRules, scopedUsers, userViewId])

  const groupedByDashboard = useMemo<RLSRuleGroupedByDashboard[]>(() => {
    const map = new Map<string, RLSRule[]>()
    scopedRules.forEach((rule) => {
      if (dashboardViewId !== 'all' && rule.dashboardId !== dashboardViewId) return
      map.set(rule.dashboardId, [...(map.get(rule.dashboardId) ?? []), rule])
    })
    return [...map.entries()]
      .map(([dashboardId, rules]) => ({ dashboardId, dashboardName: resolveDashboardName(scopedDashboards, dashboardId), rules }))
      .sort((a, b) => a.dashboardName.localeCompare(b.dashboardName))
  }, [dashboardViewId, scopedDashboards, scopedRules])

  const openCreate = () => {
    if (isReadOnly) return
    const d = scopedDashboards[0]
    const usersByDashboard = d ? scopedUsers.filter((u) => u.tenantId === d.tenantId) : scopedUsers
    setForm({ ...defaultForm, dashboardId: d?.id ?? '', userId: usersByDashboard[0]?.id ?? '' })
    setValueInput('')
    setDialogOpen(true)
  }

  const openEdit = (rule: RLSRule) => {
    if (isReadOnly) return
    setForm({
      id: rule.id,
      dashboardId: rule.dashboardId,
      userId: rule.userId,
      tableName: rule.tableName,
      columnName: rule.columnName,
      operator: rule.operator,
      ruleType: rule.ruleType,
      values: rule.values,
      notes: rule.notes ?? '',
      isActive: rule.isActive,
    })
    setValueInput('')
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setValueInput('')
    setForm(defaultForm)
  }

  const addValueToForm = (rawValue: string) => {
    const normalizedValue = rawValue.trim()
    if (!normalizedValue) return
    setForm((current) => {
      if (current.values.includes(normalizedValue)) return current
      return { ...current, values: [...current.values, normalizedValue] }
    })
  }

  const submit = async () => {
    if (isReadOnly) {
      toast.error('Modo "Ver tela do usuario" permite apenas visualizacao.')
      return
    }
    if (!form.dashboardId || !form.userId || !form.tableName.trim() || !form.columnName || form.values.length === 0) {
      toast.error('Preencha dashboard, usuario, tabela, coluna e ao menos um valor.')
      return
    }
    const dashboard = scopedDashboards.find((d) => d.id === form.dashboardId)
    const user = scopedUsers.find((u) => u.id === form.userId)
    const selectedCatalogColumn = formColumns.find((c) => c.name === form.columnName)
    if (!dashboard || !user || dashboard.tenantId !== user.tenantId) {
      toast.error('Verifique tenant e usuario selecionados.')
      return
    }
    if (selectedCatalogColumn && selectedCatalogColumn.values.length > 0) {
      const allowed = new Set(selectedCatalogColumn.values)
      if (!form.values.every((v) => allowed.has(v))) {
        toast.error('Um ou mais valores nao pertencem a coluna escolhida.')
        return
      }
    }

    const hasEmptyValue = form.values.some((value) => !value.trim())
    if (hasEmptyValue) {
      toast.error('Remova valores vazios da regra.')
      return
    }

    try {
      await upsertRLSRule({
        id: form.id,
        dashboardId: form.dashboardId,
        userId: form.userId,
        tableName: form.tableName.trim(),
        columnName: form.columnName,
        operator: form.operator,
        ruleType: form.ruleType,
        values: form.values,
        notes: '',
        isActive: form.isActive,
      })
      toast.success(form.id ? 'Regra atualizada.' : 'Regra criada com sucesso.')
      closeDialog()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar a regra.')
    }
  }

  if (!canManageRLS) {
    return (
      <section className="animate-fade-in">
        <Card>
          <CardHeader>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <CardTitle>Acesso restrito</CardTitle>
            <CardDescription>Perfil Usuario nao pode criar ou gerenciar regras de RLS.</CardDescription>
          </CardHeader>
        </Card>
      </section>
    )
  }

  return (
    <>
      <section className="animate-fade-in">
        <PageHeader
          title="Regras de RLS"
          description="Controle quais dados cada usuario pode ver em cada dashboard."
          actions={
            !isReadOnly ? <Button className="gap-2" onClick={openCreate}><Plus className="h-4 w-4" />Nova regra</Button> : undefined
          }
        />

        {isReadOnly ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Visualizacao simulada ativa. As regras abaixo refletem o usuario selecionado, mas alteracoes estao bloqueadas.
          </div>
        ) : null}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="rules">Regras</TabsTrigger>
            <TabsTrigger value="by-user">Por usuario</TabsTrigger>
            <TabsTrigger value="by-dashboard">Por dashboard</TabsTrigger>
          </TabsList>

          <TabsContent value="rules">
            <Card>
              <CardContent className="p-5">
                <div className="mb-4 grid gap-3 xl:grid-cols-5">
                  <SearchableSelect
                    value={filters.userId}
                    onValueChange={(v) => setFilters((c) => ({ ...c, userId: v }))}
                    options={userFilterOptions}
                    placeholder="Usuario"
                    searchPlaceholder="Pesquisar usuario"
                  />
                  <SearchableSelect
                    value={filters.dashboardId}
                    onValueChange={(v) => setFilters((c) => ({ ...c, dashboardId: v }))}
                    options={dashboardFilterOptions}
                    placeholder="Dashboard"
                    searchPlaceholder="Pesquisar dashboard"
                  />
                  <SearchableSelect
                    value={filters.columnName}
                    onValueChange={(v) => setFilters((c) => ({ ...c, columnName: v }))}
                    options={columnFilterSelectOptions}
                    placeholder="Coluna"
                    searchPlaceholder="Pesquisar coluna"
                  />
                  <SearchableSelect
                    value={filters.status}
                    onValueChange={(v) => setFilters((c) => ({ ...c, status: v as RLSRuleFilters['status'] }))}
                    options={ruleStatusFilterOptions}
                    placeholder="Status"
                    searchPlaceholder="Pesquisar status"
                  />
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Buscar regra" value={filters.search} onChange={(e) => setFilters((c) => ({ ...c, search: e.target.value }))} />
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dashboard</TableHead><TableHead>Usuario</TableHead><TableHead>Tabela</TableHead><TableHead>Coluna</TableHead><TableHead>Tipo</TableHead><TableHead>Valores</TableHead><TableHead>Status</TableHead><TableHead>Atualizado</TableHead><TableHead>Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRules.length > 0 ? filteredRules.map((rule) => {
                        const dashboardName = resolveDashboardName(scopedDashboards, rule.dashboardId)
                        const userName = resolveUserName(scopedUsers, rule.userId)
                        const columnLabel = resolveColumnLabel(scopedColumns, rule.dashboardId, rule.columnName)
                        const technical = getRLSRuleTechnicalPreview(rule)
                        return (
                          <TableRow key={rule.id}>
                            <TableCell className="font-medium text-slate-900">{dashboardName}</TableCell>
                            <TableCell>{userName}</TableCell>
                            <TableCell>{rule.tableName || '-'}</TableCell>
                            <TableCell>{columnLabel}</TableCell>
                            <TableCell><Badge variant={rule.ruleType === 'allow' ? 'success' : 'warning'}>{rule.ruleType}</Badge></TableCell>
                            <TableCell><div className="max-w-[320px]"><p className="truncate text-sm">{rule.values.join(', ')}</p><p className="mt-1 text-xs text-muted-foreground">{technical}</p></div></TableCell>
                            <TableCell><button className="inline-flex" type="button" onClick={async () => {
                              if (isReadOnly) {
                                toast.error('Modo "Ver tela do usuario" permite apenas visualizacao.')
                                return
                              }
                              try {
                                await toggleRLSRuleStatus(rule.id)
                              } catch (error) {
                                toast.error(error instanceof Error ? error.message : 'Nao foi possivel atualizar o status.')
                              }
                            }}><Badge variant={rule.isActive ? 'success' : 'neutral'}>{rule.isActive ? 'Ativo' : 'Inativo'}</Badge></button></TableCell>
                            <TableCell>{formatDate(rule.updatedAt)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => openEdit(rule)}>Editar</Button>
                                <Button size="icon" variant="ghost" onClick={async () => {
                                  if (isReadOnly) {
                                    toast.error('Modo "Ver tela do usuario" permite apenas visualizacao.')
                                    return
                                  }
                                  try {
                                    await duplicateRLSRule(rule.id)
                                    toast.success('Regra duplicada com status inativo.')
                                  } catch (error) {
                                    toast.error(error instanceof Error ? error.message : 'Nao foi possivel duplicar a regra.')
                                  }
                                }}><Copy className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={async () => {
                                  if (isReadOnly) {
                                    toast.error('Modo "Ver tela do usuario" permite apenas visualizacao.')
                                    return
                                  }
                                  try {
                                    await deleteRLSRule(rule.id)
                                    toast.success('Regra removida.')
                                  } catch (error) {
                                    toast.error(error instanceof Error ? error.message : 'Nao foi possivel remover a regra.')
                                  }
                                }}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      }) : (
                        <TableRow><TableCell colSpan={9} className="h-20 text-center text-sm text-muted-foreground">Nenhuma regra encontrada com os filtros aplicados.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-user">
            <Card><CardContent className="space-y-4 p-5">
              <div className="max-w-[320px]">
                <SearchableSelect
                  value={userViewId}
                  onValueChange={setUserViewId}
                  options={userFilterOptions}
                  placeholder="Usuario"
                  searchPlaceholder="Pesquisar usuario"
                />
              </div>
              {groupedByUser.length > 0 ? groupedByUser.map((group) => (
                <div key={group.userId} className="rounded-xl border border-border/70 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between"><p className="font-display text-base font-semibold text-slate-900">{group.userName}</p><Badge variant="neutral">{group.rules.length} regras</Badge></div>
                  <div className="space-y-2">{group.rules.map((rule) => {
                    const dashboardName = resolveDashboardName(scopedDashboards, rule.dashboardId)
                    const columnLabel = resolveColumnLabel(scopedColumns, rule.dashboardId, rule.columnName)
                    return <div key={rule.id} className="rounded-lg border border-border/70 p-3"><div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium text-slate-900">{dashboardName}</span><Badge variant={rule.ruleType === 'allow' ? 'success' : 'warning'}>{rule.ruleType}</Badge><Badge variant={rule.isActive ? 'success' : 'neutral'}>{rule.isActive ? 'Ativo' : 'Inativo'}</Badge></div><p className="mt-2 text-sm text-slate-700">{getRLSRuleSummary(rule, dashboardName, group.userName, columnLabel)}</p><p className="mt-1 text-xs text-muted-foreground">{getRLSRuleTechnicalPreview(rule)}</p></div>
                  })}</div>
                </div>
              )) : <div className="rounded-xl border border-dashed border-border/80 bg-slate-50 p-6 text-center text-sm text-muted-foreground">Nenhuma regra encontrada para o filtro selecionado.</div>}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="by-dashboard">
            <Card><CardContent className="space-y-4 p-5">
              <div className="max-w-[320px]">
                <SearchableSelect
                  value={dashboardViewId}
                  onValueChange={setDashboardViewId}
                  options={dashboardFilterOptions}
                  placeholder="Dashboard"
                  searchPlaceholder="Pesquisar dashboard"
                />
              </div>
              {groupedByDashboard.length > 0 ? groupedByDashboard.map((group) => (
                <div key={group.dashboardId} className="rounded-xl border border-border/70 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between"><p className="font-display text-base font-semibold text-slate-900">{group.dashboardName}</p><Badge variant="neutral">{group.rules.length} regras</Badge></div>
                  <div className="space-y-2">{group.rules.map((rule) => {
                    const userName = resolveUserName(scopedUsers, rule.userId)
                    const columnLabel = resolveColumnLabel(scopedColumns, rule.dashboardId, rule.columnName)
                    return <div key={rule.id} className="rounded-lg border border-border/70 p-3"><div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium text-slate-900">{userName}</span><Badge variant={rule.ruleType === 'allow' ? 'success' : 'warning'}>{rule.ruleType}</Badge><Badge variant={rule.isActive ? 'success' : 'neutral'}>{rule.isActive ? 'Ativo' : 'Inativo'}</Badge></div><p className="mt-2 text-sm text-slate-700">{getRLSRuleSummary(rule, group.dashboardName, userName, columnLabel)}</p><p className="mt-1 text-xs text-muted-foreground">{getRLSRuleTechnicalPreview(rule)}</p></div>
                  })}</div>
                </div>
              )) : <div className="rounded-xl border border-dashed border-border/80 bg-slate-50 p-6 text-center text-sm text-muted-foreground">Nenhuma regra encontrada para o filtro selecionado.</div>}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </section>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar regra de RLS' : 'Nova regra de RLS'}</DialogTitle>
            <DialogDescription>Defina dashboard, usuario, coluna e valores permitidos ou bloqueados.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Dashboard</label>
                <Select value={form.dashboardId} onValueChange={(value) => {
                  const tenantId = scopedDashboards.find((d) => d.id === value)?.tenantId
                  const usersByDashboard = tenantId ? scopedUsers.filter((u) => u.tenantId === tenantId) : scopedUsers
                  setForm((c) => ({ ...c, dashboardId: value, userId: usersByDashboard.some((u) => u.id === c.userId) ? c.userId : (usersByDashboard[0]?.id ?? ''), columnName: '', values: [] }))
                }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{scopedDashboards.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Usuario</label>
                <Select value={form.userId} onValueChange={(v) => setForm((c) => ({ ...c, userId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{formUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Tabela (NO_TABLE)</label>
                <Input
                  className="mt-1"
                  placeholder="Ex.: Obras"
                  value={form.tableName}
                  onChange={(e) => setForm((c) => ({ ...c, tableName: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Coluna de restricao</label>
                <Input
                  className="mt-1"
                  list="rls-column-options"
                  value={form.columnName}
                  placeholder="Ex.: REGIONAL ou CTT_DESC01"
                  onChange={(e) => setForm((c) => ({ ...c, columnName: e.target.value, values: [] }))}
                />
                <datalist id="rls-column-options">
                  {formColumns.map((column) => (
                    <option key={column.id} value={column.name}>
                      {column.label}
                    </option>
                  ))}
                </datalist>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Operador (NO_OP)</label>
                <Select
                  value={form.operator}
                  onValueChange={(v) =>
                    setForm((c) => ({
                      ...c,
                      operator: v as RuleFormState['operator'],
                      ruleType: v === 'not_in' ? 'deny' : 'allow',
                    }))
                  }
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">IN</SelectItem>
                    <SelectItem value="not_in">NOT IN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-1">
              <div>
                <label className="text-sm font-medium text-slate-700">Tipo de regra</label>
                <Select
                  value={form.ruleType}
                  onValueChange={(v) =>
                    setForm((c) => ({
                      ...c,
                      ruleType: v as RuleFormState['ruleType'],
                      operator: v === 'deny' ? 'not_in' : 'in',
                    }))
                  }
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="allow">allow (permitir apenas)</SelectItem><SelectItem value="deny">deny (bloquear)</SelectItem></SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Valores da coluna</p>
              <div className="rounded-lg border border-border/70 p-2">
                <div className="mb-2 flex gap-2">
                  <Input
                    value={valueInput}
                    placeholder="Digite um valor e pressione Enter"
                    onChange={(e) => setValueInput(e.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ',') {
                        event.preventDefault()
                        addValueToForm(valueInput)
                        setValueInput('')
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      addValueToForm(valueInput)
                      setValueInput('')
                    }}
                  >
                    Adicionar
                  </Button>
                </div>

                {form.values.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {form.values.map((value) => (
                      <Badge key={value} variant="neutral" className="gap-1">
                        {value}
                        <button
                          type="button"
                          className="rounded-sm p-0.5 hover:bg-slate-200"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              values: current.values.filter((item) => item !== value),
                            }))
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {formCatalogValueOptions.length > 0 ? (
                  <MultiSelectDropdown
                    values={form.values.filter((value) => formValues.includes(value))}
                    onChange={(catalogValues) =>
                      setForm((current) => ({
                        ...current,
                        values: [...current.values.filter((value) => !formValues.includes(value)), ...catalogValues],
                      }))
                    }
                    options={formCatalogValueOptions}
                    placeholder="Selecionar valores catalogados"
                    searchPlaceholder="Pesquisar valor"
                    emptyMessage="Nenhum valor encontrado."
                    maxVisibleLabels={1}
                  />
                ) : (
                  <p className="p-2 text-sm text-muted-foreground">
                    Sem valores catalogados para essa coluna. Adicione manualmente acima.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/70 bg-slate-50 px-3 py-2">
              <div><p className="text-sm font-medium text-slate-800">Status da regra</p><p className="text-xs text-muted-foreground">Regras inativas nao sao aplicadas.</p></div>
              <div className="flex items-center gap-2"><Badge variant={form.isActive ? 'success' : 'neutral'}>{form.isActive ? 'Ativo' : 'Inativo'}</Badge><Switch checked={form.isActive} onCheckedChange={(checked) => setForm((c) => ({ ...c, isActive: checked }))} /></div>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={submit} disabled={isReadOnly}>{form.id ? 'Salvar alteracoes' : 'Criar regra'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}


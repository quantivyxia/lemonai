import { CalendarClock, ChevronDown, FileUp, Filter, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { SearchableSelect } from '@/components/shared/searchable-select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
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
import { useAuth } from '@/hooks/use-auth'
import { usePlatformStore } from '@/hooks/use-platform-store'
import { useTenantScope } from '@/hooks/use-tenant-scope'
import { formatDate } from '@/lib/utils'
import type { Dashboard } from '@/types/entities'

const statusVariantMap: Record<Dashboard['status'], 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  draft: 'warning',
  archived: 'neutral',
}

const dashboardStatusFilterOptions = [
  { value: 'all', label: 'Todos os status' },
  { value: 'active', label: 'Ativo' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'archived', label: 'Arquivado' },
]

const coverPalette = [
  { from: '#0f4c81', to: '#1f7abf', accent: '#9dd7ff', grid: '#bfe7ff' },
  { from: '#0e6b6b', to: '#1f9a8a', accent: '#bafbe8', grid: '#c9fff4' },
  { from: '#4f46a5', to: '#6b5bd8', accent: '#ddd6ff', grid: '#ebe7ff' },
  { from: '#334155', to: '#475569', accent: '#cbd5e1', grid: '#e2e8f0' },
]

const hashSeed = (value: string) =>
  value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)

const buildDashboardCover = (dashboard: Dashboard) => {
  const palette = coverPalette[hashSeed(`${dashboard.id}${dashboard.workspace}${dashboard.category}`) % coverPalette.length]
  const categoryLabel = dashboard.category.toUpperCase().slice(0, 20)
  const workspaceLabel = dashboard.workspace.toUpperCase().slice(0, 20)
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675' viewBox='0 0 1200 675'>
      <defs>
        <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stop-color='${palette.from}' />
          <stop offset='100%' stop-color='${palette.to}' />
        </linearGradient>
      </defs>
      <rect width='1200' height='675' fill='url(#g)' />
      <g stroke='${palette.grid}' stroke-opacity='0.22' stroke-width='1'>
        <path d='M0 120h1200M0 240h1200M0 360h1200M0 480h1200M0 600h1200' />
        <path d='M120 0v675M240 0v675M360 0v675M480 0v675M600 0v675M720 0v675M840 0v675M960 0v675M1080 0v675' />
      </g>
      <polyline points='80,500 220,455 360,470 500,388 640,410 780,322 920,350 1060,255'
        fill='none' stroke='${palette.accent}' stroke-width='11' stroke-linecap='round' stroke-linejoin='round' />
      <g fill='${palette.accent}'>
        <circle cx='220' cy='455' r='8'/><circle cx='500' cy='388' r='8'/><circle cx='780' cy='322' r='8'/><circle cx='1060' cy='255' r='8'/>
      </g>
      <rect x='72' y='70' rx='14' width='280' height='40' fill='white' fill-opacity='0.16' />
      <text x='92' y='96' fill='white' font-family='Segoe UI, Arial' font-size='20' letter-spacing='1'>${workspaceLabel}</text>
      <rect x='72' y='124' rx='14' width='340' height='40' fill='white' fill-opacity='0.16' />
      <text x='92' y='150' fill='white' font-family='Segoe UI, Arial' font-size='20' letter-spacing='1'>${categoryLabel}</text>
    </svg>
  `
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const buildGroupCover = (groupName: string, tenantName: string, count: number) => {
  const palette = coverPalette[hashSeed(`${groupName}${tenantName}`) % coverPalette.length]
  const groupLabel = groupName.toUpperCase().slice(0, 24)
  const tenantLabel = tenantName.toUpperCase().slice(0, 24)
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675' viewBox='0 0 1200 675'>
      <defs>
        <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stop-color='${palette.from}' />
          <stop offset='100%' stop-color='${palette.to}' />
        </linearGradient>
      </defs>
      <rect width='1200' height='675' fill='url(#g)' />
      <g stroke='${palette.grid}' stroke-opacity='0.22' stroke-width='1'>
        <path d='M0 120h1200M0 240h1200M0 360h1200M0 480h1200M0 600h1200' />
        <path d='M120 0v675M240 0v675M360 0v675M480 0v675M600 0v675M720 0v675M840 0v675M960 0v675M1080 0v675' />
      </g>
      <rect x='160' y='170' width='880' height='330' rx='24' fill='white' fill-opacity='0.12' />
      <rect x='220' y='230' width='280' height='32' rx='10' fill='${palette.accent}' fill-opacity='0.88' />
      <rect x='220' y='285' width='520' height='24' rx='10' fill='white' fill-opacity='0.6' />
      <rect x='220' y='330' width='460' height='24' rx='10' fill='white' fill-opacity='0.45' />
      <rect x='220' y='375' width='360' height='24' rx='10' fill='white' fill-opacity='0.35' />
      <text x='230' y='252' fill='${palette.from}' font-family='Segoe UI, Arial' font-size='18' font-weight='700'>GRUPO</text>
      <rect x='72' y='70' rx='14' width='320' height='40' fill='white' fill-opacity='0.16' />
      <text x='92' y='96' fill='white' font-family='Segoe UI, Arial' font-size='20' letter-spacing='1'>${tenantLabel}</text>
      <rect x='72' y='124' rx='14' width='420' height='40' fill='white' fill-opacity='0.16' />
      <text x='92' y='150' fill='white' font-family='Segoe UI, Arial' font-size='20' letter-spacing='1'>${groupLabel}</text>
      <rect x='980' y='70' rx='16' width='150' height='44' fill='white' fill-opacity='0.2' />
      <text x='1005' y='98' fill='white' font-family='Segoe UI, Arial' font-size='20' font-weight='700'>${count}</text>
    </svg>
  `
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

type DashboardForm = {
  id?: string
  tenantId: string
  workspace: string
  name: string
  category: string
  refreshSchedule: string
  status: Dashboard['status']
  description: string
}

type EditableCategorySelectProps = {
  value: string
  options: string[]
  placeholder?: string
  onChange: (value: string) => void
}

const EditableCategorySelect = ({
  value,
  options,
  placeholder = 'Selecione ou digite uma categoria',
  onChange,
}: EditableCategorySelectProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [draftValue, setDraftValue] = useState(value)

  useEffect(() => {
    setDraftValue(value)
  }, [value])

  const normalizedOptions = useMemo(
    () => [...new Set(options.filter((option) => option.trim().length > 0))].sort((a, b) => a.localeCompare(b)),
    [options],
  )

  const filteredOptions = useMemo(
    () =>
      normalizedOptions.filter((option) =>
        option.toLowerCase().includes(draftValue.trim().toLowerCase()),
      ),
    [draftValue, normalizedOptions],
  )

  const canUseTypedValue = useMemo(() => {
    const typed = draftValue.trim()
    if (!typed) return false
    return !normalizedOptions.some((option) => option.toLowerCase() === typed.toLowerCase())
  }, [draftValue, normalizedOptions])

  const selectValue = (nextValue: string) => {
    onChange(nextValue)
    setDraftValue(nextValue)
    setIsOpen(false)
  }

  return (
    <div className="relative mt-1">
      <div className="relative">
        <Input
          value={draftValue}
          placeholder={placeholder}
          className="pr-9"
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 120)}
          onChange={(event) => {
            const nextValue = event.target.value
            setDraftValue(nextValue)
            onChange(nextValue)
            setIsOpen(true)
          }}
        />
        <button
          type="button"
          className="absolute right-2 top-2.5 rounded-sm p-0.5 text-muted-foreground transition hover:text-foreground"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setIsOpen((current) => !current)}
          aria-label="Abrir opcoes de categoria"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {isOpen ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border/60 bg-popover text-popover-foreground shadow-floating">
          <div className="max-h-48 overflow-y-auto p-1">
            {canUseTypedValue ? (
              <button
                type="button"
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectValue(draftValue.trim())}
              >
                Usar "{draftValue.trim()}"
              </button>
            ) : null}

            {filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectValue(option)}
              >
                {option}
              </button>
            ))}

            {!canUseTypedValue && filteredOptions.length === 0 ? (
              <p className="px-2 py-2 text-sm text-muted-foreground">
                Nenhuma categoria encontrada.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export const DashboardsTable = () => {
  const { isViewAsMode } = useAuth()
  const { isSuperAdmin, userRole, userTenantName, userTenantId, filterByTenant } = useTenantScope()
  const isViewer = userRole === 'viewer'
  const isReadOnly = isViewAsMode
  const { dashboards, groups, tenants, workspaces, upsertDashboard } = usePlatformStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [tenantFilter, setTenantFilter] = useState(isSuperAdmin ? 'all' : (userTenantName ?? 'all'))
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [form, setForm] = useState<DashboardForm>({
    tenantId: userTenantId ?? tenants[0]?.id ?? '',
    workspace: '',
    name: '',
    category: '',
    refreshSchedule: '',
    status: 'draft',
    description: '',
  })

  const scopedDashboards = useMemo(
    () => filterByTenant(dashboards, (item) => ({ tenantId: item.tenantId })),
    [dashboards, filterByTenant],
  )
  const scopedGroups = useMemo(
    () => filterByTenant(groups, (item) => ({ tenantId: item.tenantId })),
    [filterByTenant, groups],
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
  const workspaceOptions = useMemo(() => {
    const names = new Set<string>()

    workspaces
      .filter((workspace) => workspace.tenantId === form.tenantId)
      .forEach((workspace) => names.add(workspace.name))

    dashboards
      .filter((dashboard) => dashboard.tenantId === form.tenantId)
      .forEach((dashboard) => names.add(dashboard.workspace))

    return [...names].sort((a, b) => a.localeCompare(b))
  }, [dashboards, form.tenantId, workspaces])

  const categoryOptions = useMemo(() => {
    const names = new Set<string>()

    dashboards
      .filter((dashboard) => dashboard.tenantId === form.tenantId)
      .forEach((dashboard) => names.add(dashboard.category))

    return [...names].sort((a, b) => a.localeCompare(b))
  }, [dashboards, form.tenantId])

  useEffect(() => {
    setTenantFilter(isSuperAdmin ? 'all' : (userTenantName ?? 'all'))
  }, [isSuperAdmin, userTenantName])

  useEffect(() => {
    if (!isDialogOpen) return

    setForm((current) => {
      const hasWorkspace = workspaceOptions.includes(current.workspace)

      return {
        ...current,
        workspace: hasWorkspace ? current.workspace : (workspaceOptions[0] ?? ''),
        category: current.category || (categoryOptions[0] ?? ''),
      }
    })
  }, [categoryOptions, isDialogOpen, workspaceOptions])

  const filteredData = useMemo(() => {
    return scopedDashboards.filter((dashboard) => {
      const searchBlob = `${dashboard.name} ${dashboard.id} ${dashboard.workspace} ${dashboard.category} ${dashboard.tenantName}`
        .toLowerCase()
      const matchesSearch = searchBlob.includes(searchTerm.toLowerCase())
      const matchesTenant = !isSuperAdmin || tenantFilter === 'all' || dashboard.tenantName === tenantFilter
      const matchesStatus = statusFilter === 'all' || dashboard.status === statusFilter
      return matchesSearch && matchesTenant && matchesStatus
    })
  }, [isSuperAdmin, scopedDashboards, searchTerm, statusFilter, tenantFilter])

  const groupedDashboards = useMemo(() => {
    const normalize = (value: string) => value.trim().toLowerCase()

    return scopedGroups
      .filter((group) => !isSuperAdmin || tenantFilter === 'all' || group.tenantName === tenantFilter)
      .map((group) => {
        const groupDashboardNames = new Set(group.dashboards.map((dashboard) => normalize(dashboard)))
        const dashboardsByGroup = filteredData.filter(
          (dashboard) =>
            dashboard.tenantId === group.tenantId && groupDashboardNames.has(normalize(dashboard.name)),
        )

        return {
          id: group.id,
          name: group.name,
          description: group.description,
          tenantName: group.tenantName,
          dashboards: dashboardsByGroup,
          count: dashboardsByGroup.length,
        }
      })
      .filter((group) => group.count > 0)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [filteredData, isSuperAdmin, scopedGroups, tenantFilter])

  const activeGroup = groupedDashboards.find((group) => group.id === selectedGroupId) ?? null
  const isGroupSelected = Boolean(activeGroup)
  const selectedGroupDashboards = activeGroup?.dashboards ?? []

  const pageSize = 6
  const recordsCount = isGroupSelected ? selectedGroupDashboards.length : groupedDashboards.length
  const totalPages = Math.max(1, Math.ceil(recordsCount / pageSize))
  const safePageIndex = Math.min(pageIndex, totalPages - 1)
  const pageDashboards = useMemo(
    () => selectedGroupDashboards.slice(safePageIndex * pageSize, safePageIndex * pageSize + pageSize),
    [safePageIndex, selectedGroupDashboards],
  )
  const pageGroups = useMemo(
    () => groupedDashboards.slice(safePageIndex * pageSize, safePageIndex * pageSize + pageSize),
    [groupedDashboards, safePageIndex],
  )

  useEffect(() => {
    setPageIndex(0)
  }, [searchTerm, selectedGroupId, statusFilter, tenantFilter])

  useEffect(() => {
    if (safePageIndex !== pageIndex) {
      setPageIndex(safePageIndex)
    }
  }, [pageIndex, safePageIndex])

  useEffect(() => {
    if (groupedDashboards.length === 0) {
      if (selectedGroupId !== '') setSelectedGroupId('')
      return
    }

    const groupStillExists = groupedDashboards.some((group) => group.id === selectedGroupId)
    if (selectedGroupId && !groupStillExists) {
      setSelectedGroupId('')
    }
  }, [groupedDashboards, selectedGroupId])

  const resetFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setTenantFilter(isSuperAdmin ? 'all' : (userTenantName ?? 'all'))
    setSelectedGroupId('')
    setPageIndex(0)
  }

  const openEditDialog = (dashboard: Dashboard) => {
    if (isReadOnly) {
      toast.error('Modo "Ver tela do usuario" permite apenas visualizacao.')
      return
    }

    setForm({
      id: dashboard.id,
      tenantId: dashboard.tenantId,
      workspace: dashboard.workspace,
      name: dashboard.name,
      category: dashboard.category,
      refreshSchedule: dashboard.refreshSchedule ?? '',
      status: dashboard.status,
      description: dashboard.description ?? '',
    })
    setIsDialogOpen(true)
  }

  const submitForm = async () => {
    if (isReadOnly) {
      toast.error('Modo "Ver tela do usuario" permite apenas visualizacao.')
      return
    }

    if (!form.name.trim() || !form.workspace.trim() || !form.category.trim() || !form.tenantId) {
      toast.error('Preencha nome, workspace, categoria e tenant.')
      return
    }
    const currentDashboard = form.id ? dashboards.find((item) => item.id === form.id) : undefined

    try {
      await upsertDashboard({
        id: form.id,
        tenantId: form.tenantId,
        name: form.name.trim(),
        workspace: form.workspace.trim(),
        category: form.category.trim(),
        status: form.status,
        description: form.description.trim(),
        views7d: form.id ? dashboards.find((item) => item.id === form.id)?.views7d ?? 0 : 0,
        workspaceId: dashboards.find((item) => item.id === form.id)?.workspaceId,
        reportId: currentDashboard?.reportId ?? '',
        datasetId: currentDashboard?.datasetId ?? '',
        embedUrl: currentDashboard?.embedUrl ?? 'https://app.powerbi.com/reportEmbed',
        refreshSchedule: form.refreshSchedule.trim(),
        tags: dashboards.find((item) => item.id === form.id)?.tags ?? [form.category.trim()],
      })

      toast.success('Dashboard atualizado.')
      setIsDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar o dashboard.')
    }
  }

  return (
    <>
      <Card>
        <CardContent className="p-5">
          <div className="mb-7 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 md:flex-row">
              <div className="relative w-full md:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por nome do dashboard"
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
                options={dashboardStatusFilterOptions}
                placeholder="Status"
                searchPlaceholder="Pesquisar status"
                triggerClassName="w-full md:max-w-[200px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2" onClick={resetFilters}>
                <Filter className="h-4 w-4" />
                Limpar filtros
              </Button>
              {!isViewer && !isReadOnly ? (
                <Button className="gap-2" asChild>
                  <Link to="/powerbi">
                    <FileUp className="h-4 w-4" />
                    Importar PBIX
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          {isReadOnly ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Visualizacao simulada ativa. Os dashboards exibidos abaixo refletem o usuario selecionado, mas alteracoes estao bloqueadas.
            </div>
          ) : null}

          <div className="mb-5">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  {isGroupSelected ? (
                    <BreadcrumbLink
                      href="#"
                      onClick={(event) => {
                        event.preventDefault()
                        setSelectedGroupId('')
                        setPageIndex(0)
                      }}
                    >
                      Grupos
                    </BreadcrumbLink>
                  ) : (
                    <span className="text-foreground">Grupos</span>
                  )}
                </BreadcrumbItem>
                {isGroupSelected && activeGroup ? (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <span className="text-foreground">{activeGroup.name}</span>
                    </BreadcrumbItem>
                  </>
                ) : null}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {!isGroupSelected ? (
            pageGroups.length > 0 ? (
              <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                {pageGroups.map((group) => (
                  <article
                    key={group.id}
                    className="group overflow-hidden rounded-2xl border border-border/70 bg-white shadow-card transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-floating"
                  >
                    <div className="relative h-36 overflow-hidden">
                      <img
                        src={buildGroupCover(group.name, group.tenantName, group.count)}
                        alt={`Capa do grupo ${group.name}`}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-900/15 to-transparent" />
                      <div className="absolute right-3 top-3">
                        <Badge variant="neutral">{group.count} dashboards</Badge>
                      </div>
                      <div className="absolute bottom-3 left-3 right-3">
                        <p className="truncate text-xs font-medium uppercase tracking-[0.06em] text-white/85">
                          {group.tenantName}
                        </p>
                        <h3 className="truncate font-display text-base font-semibold text-white">
                          {group.name}
                        </h3>
                      </div>
                    </div>

                    <div className="p-3">
                      <p className="h-10 overflow-hidden text-sm text-muted-foreground">
                        {group.description || 'Grupo para organizacao de dashboards por tema e area.'}
                      </p>

                      <div className="mt-3.5 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedGroupId(group.id)
                            setPageIndex(0)
                          }}
                        >
                          Visualizar
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/80 bg-slate-50 p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhum grupo encontrado com os filtros aplicados.
                </p>
              </div>
            )
          ) : pageDashboards.length > 0 ? (
            <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
              {pageDashboards.map((dashboard) => (
                <article
                  key={dashboard.id}
                  className="group overflow-hidden rounded-2xl border border-border/70 bg-white shadow-card transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-floating"
                >
                  <div className="relative h-36 overflow-hidden">
                    <img
                      src={buildDashboardCover(dashboard)}
                      alt={`Capa analitica para ${dashboard.name}`}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-900/15 to-transparent" />
                    <div className="absolute right-3 top-3">
                      <Badge variant={statusVariantMap[dashboard.status]}>{dashboard.status}</Badge>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3">
                      <p className="truncate text-xs font-medium uppercase tracking-[0.06em] text-white/85">
                        {dashboard.tenantName}
                      </p>
                      <h3 className="truncate font-display text-base font-semibold text-white">
                        {dashboard.name}
                      </h3>
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">{dashboard.workspace}</Badge>
                      <Badge variant="neutral">{dashboard.category}</Badge>
                    </div>

                    <div className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarClock className="h-3.5 w-3.5" />
                      Atualizado em {formatDate(dashboard.updatedAt)}
                    </div>

                    <div className="mt-3.5 flex items-center gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/reports/${dashboard.id}`}>Visualizar</Link>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEditDialog(dashboard)} disabled={isReadOnly}>
                        Editar
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/80 bg-slate-50 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum dashboard encontrado para este grupo com os filtros aplicados.
              </p>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {isGroupSelected
                ? `${pageDashboards.length} de ${selectedGroupDashboards.length} dashboards exibidos`
                : `${pageGroups.length} de ${groupedDashboards.length} grupos exibidos`}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
                disabled={safePageIndex === 0}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPageIndex((current) => Math.min(totalPages - 1, current + 1))}
                disabled={safePageIndex >= totalPages - 1}
              >
                Proxima
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar dashboard</DialogTitle>
            <DialogDescription>
              Ajuste metadados do dashboard. IDs e embed sao gerenciados pela sincronizacao Power BI.
            </DialogDescription>
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
                      workspace: '',
                      category: '',
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
            <div>
              <label className="text-sm font-medium text-slate-700">Nome</label>
              <Input
                className="mt-1"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Workspace</label>
                <Select
                  value={form.workspace}
                  onValueChange={(value) => setForm((current) => ({ ...current, workspace: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione um workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaceOptions.length > 0 ? (
                      workspaceOptions.map((workspace) => (
                        <SelectItem key={workspace} value={workspace}>
                          {workspace}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="workspace-empty" disabled>
                        Nenhum workspace disponivel
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Categoria</label>
                <EditableCategorySelect
                  value={form.category}
                  options={categoryOptions}
                  onChange={(value) => setForm((current) => ({ ...current, category: value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Status</label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm((current) => ({ ...current, status: value as Dashboard['status'] }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="archived">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Descricao</label>
              <textarea
                className="mt-1 min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/35"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Agenda de atualizacao</label>
              <Input
                className="mt-1"
                value={form.refreshSchedule}
                onChange={(event) => setForm((current) => ({ ...current, refreshSchedule: event.target.value }))}
                placeholder="Ex.: Diario 06:00 America/Sao_Paulo"
              />
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
    </>
  )
}


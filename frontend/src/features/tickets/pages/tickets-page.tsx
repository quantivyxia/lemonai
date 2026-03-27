import {
  CalendarClock,
  Clock3,
  LifeBuoy,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Shield,
  Ticket as TicketIcon,
  Upload,
} from 'lucide-react'
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { EmptyState } from '@/components/shared/empty-state'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { usePlatformStore } from '@/hooks/use-platform-store'
import { useTenantScope } from '@/hooks/use-tenant-scope'
import { formatDate, formatNumber } from '@/lib/utils'
import { ticketsApi } from '@/services/tickets-api'
import type { Ticket, TicketPriority, TicketStatus } from '@/types/entities'

type TicketFilters = {
  tenant: string
  requester: string
  status: string
  priority: string
  search: string
}

type TicketForm = {
  id?: string
  title: string
  description: string
}

type ManagementForm = {
  status: TicketStatus
  priority: TicketPriority
  dueDate: string
}

const defaultFilters = (isSuperAdmin: boolean, userTenantId?: string | null): TicketFilters => ({
  tenant: isSuperAdmin ? 'all' : (userTenantId ?? 'all'),
  requester: 'all',
  status: 'all',
  priority: 'all',
  search: '',
})

const statusOptions = [
  { value: 'all', label: 'Todos os status' },
  { value: 'open', label: 'Aberto' },
  { value: 'analysis', label: 'Em analise' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'resolved', label: 'Resolvido' },
  { value: 'closed', label: 'Fechado' },
]

const priorityOptions = [
  { value: 'all', label: 'Todas as prioridades' },
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
]

const statusEditorOptions: Array<{ value: TicketStatus; label: string }> = [
  { value: 'open', label: 'Aberto' },
  { value: 'analysis', label: 'Em analise' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'resolved', label: 'Resolvido' },
  { value: 'closed', label: 'Fechado' },
]

const priorityEditorOptions: Array<{ value: TicketPriority; label: string }> = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
]

const statusVariantMap: Record<TicketStatus, 'default' | 'warning' | 'success' | 'neutral'> = {
  open: 'warning',
  analysis: 'default',
  in_progress: 'default',
  resolved: 'success',
  closed: 'neutral',
}

const priorityVariantMap: Record<TicketPriority, 'neutral' | 'warning' | 'danger'> = {
  low: 'neutral',
  medium: 'neutral',
  high: 'warning',
  urgent: 'danger',
}

const isPendingTicket = (status: TicketStatus) =>
  status === 'open' || status === 'analysis' || status === 'in_progress'

const isClosedTicket = (status: TicketStatus) => status === 'resolved' || status === 'closed'

const formatDateOnly = (value?: string | null) => {
  if (!value) return '-'
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return '-'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(parsed)
}

const toDateInputValue = (value?: string | null) => {
  if (!value) return ''
  return value.slice(0, 10)
}

export const TicketsPage = () => {
  const { user } = useAuth()
  const { users, tenants } = usePlatformStore()
  const { isSuperAdmin, userTenantId, userTenantName, filterByTenant } = useTenantScope()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState<TicketFilters>(() => defaultFilters(isSuperAdmin, userTenantId))
  const [appliedFilters, setAppliedFilters] = useState<TicketFilters>(() => defaultFilters(isSuperAdmin, userTenantId))
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [form, setForm] = useState<TicketForm>({ title: '', description: '' })
  const [managementForm, setManagementForm] = useState<ManagementForm>({ status: 'open', priority: 'medium', dueDate: '' })
  const [commentBody, setCommentBody] = useState('')
  const [commentInternal, setCommentInternal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isCommentSaving, setIsCommentSaving] = useState(false)
  const [isAttachmentSaving, setIsAttachmentSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const createEvidenceInputRef = useRef<HTMLInputElement | null>(null)
  const selectedTicketId = searchParams.get('ticket')
  const [createEvidenceFile, setCreateEvidenceFile] = useState<File | null>(null)
  const resetCreateEvidence = useCallback(() => {
    setCreateEvidenceFile(null)
    if (createEvidenceInputRef.current) createEvidenceInputRef.current.value = ''
  }, [])

  const scopedUsers = useMemo(() => filterByTenant(users, (item) => ({ tenantId: item.tenantId })), [filterByTenant, users])
  const scopedTenants = useMemo(() => filterByTenant(tenants, (item) => ({ tenantId: item.id })), [filterByTenant, tenants])

  const requesterOptions = useMemo(
    () => [{ value: 'all', label: 'Todos os solicitantes' }, ...scopedUsers.map((item) => ({ value: item.id, label: `${item.firstName} ${item.lastName}`, keywords: `${item.email} ${item.tenantName}` }))],
    [scopedUsers],
  )
  const tenantOptions = useMemo(
    () => [{ value: 'all', label: 'Todos os tenants' }, ...scopedTenants.map((item) => ({ value: item.id, label: item.name }))],
    [scopedTenants],
  )

  const setTicketQuery = useCallback(
    (ticketId: string | null) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (ticketId) next.set('ticket', ticketId)
          else next.delete('ticket')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const loadTickets = useCallback(
    async (options?: { preferredTicketId?: string | null; currentSelectedTicketId?: string | null }) => {
      setIsLoading(true)
      try {
        const data = await ticketsApi.listTickets({
          tenant: appliedFilters.tenant,
          requester: appliedFilters.requester,
          status: appliedFilters.status,
          priority: appliedFilters.priority,
          search: appliedFilters.search,
        })
        setTickets(data)

        const targetTicketId = options?.preferredTicketId ?? options?.currentSelectedTicketId ?? null
        if (targetTicketId && data.some((item) => item.id === targetTicketId)) {
          setTicketQuery(targetTicketId)
        } else if (targetTicketId) {
          setTicketQuery(null)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Nao foi possivel carregar o suporte.'
        toast.error(message)
      } finally {
        setIsLoading(false)
      }
    },
    [appliedFilters, setTicketQuery],
  )

  useEffect(() => {
    if (isSuperAdmin) return
    const tenantId = userTenantId ?? 'all'
    setFilters((current) => ({ ...current, tenant: tenantId }))
    setAppliedFilters((current) => ({ ...current, tenant: tenantId }))
  }, [isSuperAdmin, userTenantId])

  useEffect(() => {
    void loadTickets({ currentSelectedTicketId: selectedTicketId })
  }, [appliedFilters, loadTickets])

  const selectedTicket = useMemo(() => tickets.find((item) => item.id === selectedTicketId) ?? null, [selectedTicketId, tickets])

  useEffect(() => {
    if (!selectedTicket) {
      setCommentBody('')
      setCommentInternal(false)
      return
    }

    setManagementForm({
      status: selectedTicket.status,
      priority: selectedTicket.priority,
      dueDate: toDateInputValue(selectedTicket.dueDate),
    })
    setCommentBody('')
    setCommentInternal(false)
  }, [selectedTicket])

  useEffect(() => {
    if (user?.role !== 'analyst' || !selectedTicketId) return
    void ticketsApi.markTicketNotificationsRead(selectedTicketId).catch(() => undefined)
  }, [selectedTicketId, user?.role])

  useEffect(() => {
    if (!selectedTicketId || isLoading || tickets.some((item) => item.id === selectedTicketId)) return
    void loadTickets({ currentSelectedTicketId: selectedTicketId })
  }, [isLoading, loadTickets, selectedTicketId, tickets])

  const summary = useMemo(() => {
    const now = new Date()
    const overdue = tickets.filter((ticket) => {
      if (!ticket.dueDate || isClosedTicket(ticket.status)) return false
      return new Date(`${ticket.dueDate}T23:59:59`).getTime() < now.getTime()
    }).length

    return [
      {
        title: isSuperAdmin ? 'Total de atendimentos' : 'Meus atendimentos',
        value: formatNumber(tickets.length),
        description: 'Volume no recorte filtrado atual.',
        icon: TicketIcon,
      },
      {
        title: 'Pendentes',
        value: formatNumber(tickets.filter((ticket) => isPendingTicket(ticket.status)).length),
        description: 'Atendimentos abertos, em analise ou em andamento.',
        icon: Clock3,
      },
      {
        title: 'Prazo vencido',
        value: formatNumber(overdue),
        description: 'Atendimentos com previsao ultrapassada e sem fechamento.',
        icon: CalendarClock,
      },
      {
        title: 'Comentarios',
        value: formatNumber(tickets.reduce((sum, ticket) => sum + ticket.commentsCount, 0)),
        description: 'Interacoes registradas no historico exibido.',
        icon: MessageSquare,
      },
    ]
  }, [isSuperAdmin, tickets])

  const openCreateDialog = () => {
    setForm({ title: '', description: '' })
    resetCreateEvidence()
    setIsDialogOpen(true)
  }

  const openEditDialog = () => {
    if (!selectedTicket) return
    setForm({ id: selectedTicket.id, title: selectedTicket.title, description: selectedTicket.description })
    resetCreateEvidence()
    setIsDialogOpen(true)
  }

  const handleSaveTicket = async () => {
    if (!form.title.trim()) {
      toast.error('Preencha o titulo do suporte.')
      return
    }
    if (!form.description.trim()) {
      toast.error('Descreva o suporte com mais detalhe.')
      return
    }

    setIsSaving(true)
    try {
      const saved = await ticketsApi.upsertTicket({ id: form.id, title: form.title.trim(), description: form.description.trim() })
      let evidenceUploadError: string | null = null

      if (createEvidenceFile) {
        try {
          await ticketsApi.uploadAttachment(saved.id, createEvidenceFile)
        } catch (error) {
          evidenceUploadError = error instanceof Error ? error.message : 'Nao foi possivel anexar a imagem.'
        }
      }

      await loadTickets({ preferredTicketId: saved.id })
      resetCreateEvidence()
      setIsDialogOpen(false)
      if (evidenceUploadError) {
        toast.warning(`${form.id ? 'Suporte salvo' : 'Suporte criado'}, mas a imagem nao foi anexada: ${evidenceUploadError}`)
      } else {
        toast.success(form.id ? 'Suporte atualizado.' : 'Suporte criado com sucesso.')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar o suporte.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveManagement = async () => {
    if (!selectedTicket) return

    setIsSaving(true)
    try {
      await ticketsApi.upsertTicket({
        id: selectedTicket.id,
        title: selectedTicket.title,
        description: selectedTicket.description,
        status: managementForm.status,
        priority: managementForm.priority,
        due_date: managementForm.dueDate || null,
      })
      await loadTickets({ preferredTicketId: selectedTicket.id })
      toast.success('Gestao do suporte atualizada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel atualizar o suporte.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddComment = async () => {
    if (!selectedTicket) return
    if (!commentBody.trim()) {
      toast.error('Escreva um comentario antes de enviar.')
      return
    }

    setIsCommentSaving(true)
    try {
      await ticketsApi.addComment(selectedTicket.id, {
        body: commentBody.trim(),
        is_internal: isSuperAdmin ? commentInternal : false,
      })
      setCommentBody('')
      setCommentInternal(false)
      await loadTickets({ preferredTicketId: selectedTicket.id })
      toast.success('Comentario adicionado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel adicionar o comentario.')
    } finally {
      setIsCommentSaving(false)
    }
  }

  const handleSelectAttachment = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !selectedTicket) return

    setIsAttachmentSaving(true)
    try {
      await ticketsApi.uploadAttachment(selectedTicket.id, file)
      await loadTickets({ preferredTicketId: selectedTicket.id })
      toast.success('Evidencia anexada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel anexar a evidencia.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
      setIsAttachmentSaving(false)
    }
  }

  const handleCreateEvidenceChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setCreateEvidenceFile(file)
  }

  const canCreateTicket = user?.role === 'analyst'
  const canEditBasics = Boolean(
    selectedTicket && (isSuperAdmin || (user?.role === 'analyst' && selectedTicket.requesterId === user?.id)),
  )

  return (
    <section className="animate-fade-in">
      <PageHeader
        title="Suporte"
        description="Atendimentos com historico, evidencias e acompanhamento por status."
        actions={
          <>
            <Button variant="outline" onClick={() => void loadTickets({ currentSelectedTicketId: selectedTicketId })}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            {canCreateTicket ? (
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Novo suporte
              </Button>
            ) : null}
          </>
        }
      />

      <Card className="border-border/70 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle>Filtros de suporte</CardTitle>
          <CardDescription>Recorte compartilhado entre indicadores e fila.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 pt-0">
          {isSuperAdmin ? (
            <div className="w-full min-w-[200px] md:w-[220px]">
              <SearchableSelect value={filters.tenant} onValueChange={(value) => setFilters((current) => ({ ...current, tenant: value }))} options={tenantOptions} placeholder="Tenant" searchPlaceholder="Pesquisar tenant" />
            </div>
          ) : (
            <Input className="w-full min-w-[200px] md:w-[220px]" value={userTenantName ?? 'Tenant atual'} disabled />
          )}
          {isSuperAdmin ? (
            <div className="w-full min-w-[220px] md:w-[240px]">
              <SearchableSelect value={filters.requester} onValueChange={(value) => setFilters((current) => ({ ...current, requester: value }))} options={requesterOptions} placeholder="Solicitante" searchPlaceholder="Pesquisar solicitante" />
            </div>
          ) : null}
          <div className="w-full min-w-[200px] md:w-[220px]">
            <SearchableSelect value={filters.status} onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))} options={statusOptions} placeholder="Status" searchPlaceholder="Pesquisar status" />
          </div>
          <div className="w-full min-w-[200px] md:w-[220px]">
            <SearchableSelect value={filters.priority} onValueChange={(value) => setFilters((current) => ({ ...current, priority: value }))} options={priorityOptions} placeholder="Prioridade" searchPlaceholder="Pesquisar prioridade" />
          </div>
          <div className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por codigo, titulo ou solicitante" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
          </div>
          <Button className="w-full md:w-[148px]" onClick={() => setAppliedFilters(filters)}>Aplicar</Button>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {summary.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className="border-border/70 shadow-card">
              <CardHeader className="pb-3">
                <CardDescription>{card.title}</CardDescription>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-2xl">{card.value}</CardTitle>
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="mt-4">
        <Card className="border-border/70 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle>Fila de suporte</CardTitle>
            <CardDescription>{isSuperAdmin ? 'Visao global dos atendimentos do portal.' : 'Apenas os atendimentos abertos por voce.'}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-xl" />)}
              </div>
            ) : tickets.length ? (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <div key={ticket.id} className="overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-white via-white to-slate-50/80 shadow-card">
                    <div className="border-b border-border/60 px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-slate-900">{ticket.title}</p>
                            <Badge variant={statusVariantMap[ticket.status]}>{ticket.statusLabel}</Badge>
                            <Badge variant={priorityVariantMap[ticket.priority]}>{ticket.priorityLabel}</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold uppercase tracking-[0.06em] text-slate-600">{ticket.code}</span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/5 px-2.5 py-1 text-primary">
                              <Clock3 className="h-3.5 w-3.5" />
                              Ultima atualizacao {formatDate(ticket.lastActivityAt)}
                            </span>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-white/80 px-3 py-2 text-right">
                          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Previsao</p>
                          <p className="mt-1 text-sm font-medium text-slate-700">{formatDateOnly(ticket.dueDate)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 px-5 py-4">
                      <p className="line-clamp-2 text-sm leading-6 text-slate-700">{ticket.description}</p>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.1fr_1.1fr_auto_auto]">
                        <div className="rounded-2xl border border-border/60 bg-white/80 px-3 py-2.5">
                          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Solicitante</p>
                          <p className="mt-1 text-sm font-medium text-slate-800">{ticket.requesterName}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-white/80 px-3 py-2.5">
                          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Tenant</p>
                          <p className="mt-1 text-sm font-medium text-slate-800">{ticket.tenantName}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-white/80 px-3 py-2.5">
                          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Comentarios</p>
                          <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-slate-800">
                            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatNumber(ticket.commentsCount)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-white/80 px-3 py-2.5">
                          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Arquivos</p>
                          <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-slate-800">
                            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatNumber(ticket.attachmentsCount)}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => setTicketQuery(ticket.id)}>
                          Detalhes
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Nenhum atendimento encontrado" description="Ajuste os filtros ou abra o primeiro suporte para iniciar o atendimento." icon={LifeBuoy} actionLabel={canCreateTicket ? 'Novo suporte' : undefined} onAction={canCreateTicket ? openCreateDialog : undefined} />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(selectedTicket)} onOpenChange={(open) => {
        if (!open) setTicketQuery(null)
      }}>
        <DialogContent className="max-h-[88vh] max-w-6xl overflow-y-auto">
          {selectedTicket ? (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <DialogTitle className="flex flex-wrap items-center gap-2">
                      {selectedTicket.title}
                      <Badge variant={statusVariantMap[selectedTicket.status]}>{selectedTicket.statusLabel}</Badge>
                      <Badge variant={priorityVariantMap[selectedTicket.priority]}>{selectedTicket.priorityLabel}</Badge>
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      {selectedTicket.code} - aberto em {formatDate(selectedTicket.openedAt)}
                    </DialogDescription>
                  </div>
                  {canEditBasics ? <Button variant="outline" size="sm" onClick={openEditDialog}>Editar suporte</Button> : null}
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-xl border border-border/70 bg-slate-50/70 p-4 text-sm text-slate-700">
                  {selectedTicket.description}
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <InfoCard label="Solicitante" value={selectedTicket.requesterName} />
                  <InfoCard label="Tenant" value={selectedTicket.tenantName} />
                  <InfoCard label="Ultima atividade" value={formatDate(selectedTicket.lastActivityAt)} />
                  <InfoCard label="Previsao" value={formatDateOnly(selectedTicket.dueDate)} />
                </div>

                {isSuperAdmin ? (
                  <Card className="border-border/70 shadow-card">
                    <CardHeader>
                      <CardTitle>Gestao administrativa</CardTitle>
                      <CardDescription>Atualize status, prioridade e previsao de resolucao do atendimento selecionado.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-3">
                      <div>
                        <label className="text-sm font-medium text-slate-700">Status</label>
                        <select className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/35" value={managementForm.status} onChange={(event) => setManagementForm((current) => ({ ...current, status: event.target.value as TicketStatus }))}>
                          {statusEditorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700">Prioridade</label>
                        <select className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/35" value={managementForm.priority} onChange={(event) => setManagementForm((current) => ({ ...current, priority: event.target.value as TicketPriority }))}>
                          {priorityEditorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700">Previsao de resolucao</label>
                        <Input type="date" className="mt-1" value={managementForm.dueDate} onChange={(event) => setManagementForm((current) => ({ ...current, dueDate: event.target.value }))} />
                      </div>
                      <div className="md:col-span-3">
                        <Button onClick={() => void handleSaveManagement()} disabled={isSaving}>
                          <Save className="mr-2 h-4 w-4" />
                          Salvar gestao
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <Card className="border-border/70 shadow-card">
                    <CardHeader>
                      <CardTitle>Comentarios e historico</CardTitle>
                      <CardDescription>Registre respostas, alinhamentos e observacoes do atendimento.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        {selectedTicket.comments.length ? (
                          selectedTicket.comments.map((comment) => (
                            <div key={comment.id} className="rounded-xl border border-border/70 bg-white p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium text-slate-900">{comment.authorName}</p>
                                  {comment.isInternal ? (
                                    <Badge variant="warning"><Shield className="mr-1 h-3.5 w-3.5" />Interno</Badge>
                                  ) : null}
                                </div>
                                <p className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</p>
                              </div>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{comment.body}</p>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl border border-dashed border-border/70 bg-slate-50/70 p-4 text-sm text-muted-foreground">Nenhum comentario registrado neste atendimento.</div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                        <label className="text-sm font-medium text-slate-700">Novo comentario</label>
                        <textarea className="mt-2 min-h-[120px] w-full rounded-xl border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/35" placeholder={isSuperAdmin ? 'Responder ao solicitante ou registrar orientacao interna...' : 'Detalhe a evolucao do atendimento ou complemente o contexto...'} value={commentBody} onChange={(event) => setCommentBody(event.target.value)} />
                        {isSuperAdmin ? (
                          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={commentInternal} onChange={(event) => setCommentInternal(event.target.checked)} />
                            Comentario interno (nao visivel para o solicitante)
                          </label>
                        ) : null}
                        <div className="mt-3">
                          <Button onClick={() => void handleAddComment()} disabled={isCommentSaving}>
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Adicionar comentario
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/70 shadow-card">
                    <CardHeader>
                      <CardTitle>Evidencias</CardTitle>
                      <CardDescription>Arquivos e imagens anexados ao atendimento selecionado.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <input ref={fileInputRef} type="file" className="hidden" onChange={(event) => void handleSelectAttachment(event)} />
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isAttachmentSaving}>
                        <Upload className="mr-2 h-4 w-4" />
                        Anexar evidencia
                      </Button>

                      <div className="space-y-3">
                        {selectedTicket.attachments.length ? (
                          selectedTicket.attachments.map((attachment) => (
                            <div key={attachment.id} className="rounded-xl border border-border/70 bg-white p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-slate-900">{attachment.fileName}</p>
                                  <p className="mt-1 text-sm text-muted-foreground">{attachment.uploadedByName} - {formatDate(attachment.createdAt)}</p>
                                  <p className="text-xs text-muted-foreground">{attachment.contentType || 'arquivo'} - {formatFileSize(attachment.sizeBytes)}</p>
                                </div>
                                <Button variant="subtle" size="sm" onClick={() => void ticketsApi.downloadAttachment(attachment)}>
                                  Baixar
                                </Button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl border border-dashed border-border/70 bg-slate-50/70 p-4 text-sm text-muted-foreground">Nenhuma evidencia anexada ate o momento.</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open)
        if (!open) resetCreateEvidence()
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar suporte' : 'Novo suporte'}</DialogTitle>
            <DialogDescription>
              {form.id ? 'Atualize titulo, descricao e a imagem do atendimento selecionado.' : 'Descreva claramente o problema, impacto e contexto da solicitacao.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Titulo</label>
              <Input className="mt-1" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Erro ao atualizar dashboard financeiro" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Descricao</label>
              <textarea className="mt-1 min-h-[180px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/35" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Detalhe o que aconteceu, impacto para o usuario e passos para reproduzir." />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Imagem de comprovacao</label>
              <input ref={createEvidenceInputRef} type="file" accept="image/*" className="hidden" onChange={handleCreateEvidenceChange} />
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border/70 bg-slate-50/70 p-3">
                <Button type="button" variant="outline" onClick={() => createEvidenceInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Selecionar imagem
                </Button>
                <p className="text-sm text-muted-foreground">
                  {createEvidenceFile ? createEvidenceFile.name : 'Opcional. Use uma captura para comprovar o problema.'}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSaveTicket()} disabled={isSaving}>Salvar suporte</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

const InfoCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-border/70 bg-white p-4">
    <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
    <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
  </div>
)

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}



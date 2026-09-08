import { Activity, AlertTriangle, RefreshCcw, ShieldCheck, Workflow } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { platformApi } from '@/services/platform-api'
import type { SystemEventCategory, SystemEventLevel, SystemEventLog, SystemSummary } from '@/types/entities'

const levelLabel: Record<SystemEventLevel, string> = {
  info: 'Info',
  warn: 'Alerta',
  error: 'Erro',
}

const categoryLabel: Record<SystemEventCategory, string> = {
  auth: 'Auth',
  authorization: 'Autorizacao',
  admin: 'Admin',
  integration: 'Integracao',
  system: 'Sistema',
}

export const SystemMonitoringPage = () => {
  const [summary, setSummary] = useState<SystemSummary | null>(null)
  const [events, setEvents] = useState<SystemEventLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [levelFilter, setLevelFilter] = useState<'all' | SystemEventLevel>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | SystemEventCategory>('all')
  const [search, setSearch] = useState('')

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [summaryPayload, eventsPayload] = await Promise.all([
        platformApi.getSystemSummary(),
        platformApi.listSystemEvents({
          level: levelFilter === 'all' ? '' : levelFilter,
          category: categoryFilter === 'all' ? '' : categoryFilter,
          search,
        }),
      ])
      setSummary(summaryPayload)
      setEvents(eventsPayload)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel carregar o monitoramento.'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [levelFilter, categoryFilter])

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return events
    return events.filter((event) =>
      [
        event.action,
        event.message,
        event.tenantName,
        event.userName,
        event.endpoint,
        event.requestId,
      ]
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [events, search])

  const cards = summary
    ? [
        {
          title: 'Saude geral',
          value: summary.status === 'ok' ? 'Operacional' : summary.status,
          description: `Resumo atualizado em ${new Date(summary.timestamp).toLocaleString('pt-BR')}`,
          icon: ShieldCheck,
        },
        {
          title: 'Eventos do sistema',
          value: `${summary.counts.systemEvents}`,
          description: `${summary.counts.accessLogs} logs de acesso registrados`,
          icon: Activity,
        },
        {
          title: 'Power BI',
          value: `${summary.powerbi.activeConnections} conexoes ativas`,
          description: `${summary.powerbi.connectionsWithError} conexoes com erro`,
          icon: Workflow,
        },
        {
          title: 'Risco atual',
          value: summary.powerbi.connectionsWithError > 0 || summary.powerbi.gatewaysWithError > 0 ? 'Atencao' : 'Controlado',
          description: `${summary.powerbi.gatewaysWithError} gateways com falha`,
          icon: AlertTriangle,
        },
      ]
    : []

  return (
    <section className="animate-fade-in">
      <PageHeader
        title="Monitoramento global"
        description="Acompanhe healthcheck, eventos administrativos, erros de integracao e sinais operacionais da plataforma."
        actions={
          <Button variant="outline" onClick={() => void loadData()} disabled={isLoading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        {isLoading && !summary
          ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
          : cards.map((card) => {
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

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/70 shadow-card">
          <CardHeader>
            <CardTitle>Status da plataforma</CardTitle>
            <CardDescription>Contadores macro para troubleshooting e governanca.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summary ? (
              <>
                <Metric label="Tenants" value={summary.counts.tenants} />
                <Metric label="Usuarios" value={summary.counts.users} />
                <Metric label="Dashboards" value={summary.counts.dashboards} />
                <Metric label="Workspaces" value={summary.counts.workspaces} />
                <Metric label="Conexoes Power BI" value={summary.counts.powerbiConnections} />
                <Metric label="Gateways" value={summary.counts.powerbiGateways} />
                <Metric label="Ultimo evento" value={summary.recent.latestSystemEvent?.action ?? 'Sem eventos'} />
                <Metric label="Ultimo log de acesso" value={summary.recent.latestAccessLog?.status ?? 'Sem logs'} />
              </>
            ) : (
              Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-card">
          <CardHeader>
            <CardTitle>Filtros do monitoramento</CardTitle>
            <CardDescription>Refine a investigacao sem sair da tela.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Buscar</label>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Acao, request_id, endpoint, tenant..."
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Nivel</label>
                <Select value={levelFilter} onValueChange={(value) => setLevelFilter(value as 'all' | SystemEventLevel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os niveis</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warn">Alerta</SelectItem>
                    <SelectItem value="error">Erro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Categoria</label>
                <Select
                  value={categoryFilter}
                  onValueChange={(value) => setCategoryFilter(value as 'all' | SystemEventCategory)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    <SelectItem value="auth">Auth</SelectItem>
                    <SelectItem value="authorization">Autorizacao</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="integration">Integracao</SelectItem>
                    <SelectItem value="system">Sistema</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" variant="outline" onClick={() => void loadData()} disabled={isLoading}>
              Aplicar filtros
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 border-border/70 shadow-card">
        <CardHeader>
          <CardTitle>Eventos recentes do sistema</CardTitle>
          <CardDescription>Auditoria operacional consolidada para uso exclusivo do admin global.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && !events.length ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <EmptyState
              title="Nenhum evento encontrado"
              description="Nao ha eventos sistêmicos com os filtros atuais."
              icon={Activity}
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/hora</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Acao</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Request ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{new Date(event.createdAt).toLocaleString('pt-BR')}</TableCell>
                      <TableCell>
                        <Badge variant={event.level === 'error' ? 'danger' : event.level === 'warn' ? 'warning' : 'default'}>
                          {levelLabel[event.level]}
                        </Badge>
                      </TableCell>
                      <TableCell>{categoryLabel[event.category]}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-slate-900">{event.action}</p>
                          <p className="text-xs text-muted-foreground">{event.message}</p>
                        </div>
                      </TableCell>
                      <TableCell>{event.userName}</TableCell>
                      <TableCell>{event.tenantName}</TableCell>
                      <TableCell>{event.statusCode ?? '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{event.requestId || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

const Metric = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-xl border border-border/70 bg-slate-50/70 p-4">
    <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
    <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
  </div>
)

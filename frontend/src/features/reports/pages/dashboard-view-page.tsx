import {
  AlertTriangle,
  Maximize2,
  RefreshCcw,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { factories, models, service } from 'powerbi-client'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlatformStore } from '@/hooks/use-platform-store'
import { platformApi, type DashboardEmbedConfig } from '@/services/platform-api'

type EmbedState = 'loading' | 'ready' | 'error'

export const DashboardViewPage = () => {
  const { dashboards } = usePlatformStore()
  const { dashboardId } = useParams()
  const [embedState, setEmbedState] = useState<EmbedState>('loading')
  const [embedConfig, setEmbedConfig] = useState<DashboardEmbedConfig | null>(null)
  const embedHostRef = useRef<HTMLDivElement | null>(null)
  const powerBIServiceRef = useRef<service.Service | null>(null)

  const dashboard = useMemo(
    () => dashboards.find((item) => item.id === dashboardId) ?? null,
    [dashboardId, dashboards],
  )
  const hasAccess = Boolean(dashboard)

  useEffect(() => {
    if (!dashboard || !hasAccess) return
    let mounted = true

    const loadEmbedConfig = async () => {
      setEmbedState('loading')
      try {
        const config = await platformApi.getDashboardEmbedConfig(dashboard.id)
        if (!mounted) return
        setEmbedConfig(config)
        setEmbedState('ready')
      } catch (error) {
        if (!mounted) return
        setEmbedConfig(null)
        setEmbedState('error')
        toast.error(error instanceof Error ? error.message : 'Falha ao carregar configuracao de embed.')
      }
    }

    void loadEmbedConfig()

    return () => {
      mounted = false
    }
  }, [dashboard, hasAccess])

  const handleRefreshToken = async () => {
    if (!dashboard) return
    setEmbedState('loading')
    try {
      const config = await platformApi.getDashboardEmbedConfig(dashboard.id)
      setEmbedConfig(config)
      setEmbedState('ready')
      toast.success('Token de embed atualizado com sucesso.')
    } catch (error) {
      setEmbedConfig(null)
      setEmbedState('error')
      toast.error(error instanceof Error ? error.message : 'Falha ao atualizar token de embed.')
    }
  }

  const handleFullScreen = () => {
    const targetElement = document.getElementById('embed-container')
    if (!targetElement) return
    if (document.fullscreenElement) {
      void document.exitFullscreen()
      return
    }
    void targetElement.requestFullscreen()
  }

  useEffect(() => {
    if (embedState !== 'ready' || !embedConfig || !embedHostRef.current) return

    const container = embedHostRef.current
    if (!powerBIServiceRef.current) {
      powerBIServiceRef.current = new service.Service(
        factories.hpmFactory,
        factories.wpmpFactory,
        factories.routerFactory,
      )
    }

    const powerBIService = powerBIServiceRef.current
    powerBIService.reset(container)

    const reportFilters: models.IFilter[] = embedConfig.reportFilters.map((rule) => ({
      $schema: 'http://powerbi.com/product/schema#basic',
      target: {
        table: rule.table,
        column: rule.column,
      },
      operator: rule.operator,
      values: rule.values,
      filterType: models.FilterType.Basic,
      requireSingleSelection: false,
    }))

    const reportConfig: models.IReportEmbedConfiguration = {
      type: 'report',
      tokenType: models.TokenType.Embed,
      accessToken: embedConfig.accessToken,
      embedUrl: embedConfig.embedUrl,
      id: embedConfig.reportId,
      filters: reportFilters,
      settings: {
        panes: {
          filters: { visible: false },
        },
      },
    }

    const report = powerBIService.embed(container, reportConfig)
    report.off('error')
    report.off('loaded')

    report.on('loaded', async () => {
      if (reportFilters.length === 0) return
      try {
        await (report as { updateFilters?: (op: models.FiltersOperations, filters: models.IFilter[]) => Promise<void> }).updateFilters?.(
          models.FiltersOperations.ReplaceAll,
          reportFilters,
        )
      } catch {
        toast.error('Nao foi possivel aplicar filtros de pagina do dashboard.')
      }
    })

    report.on('error', (event) => {
      const detail = event?.detail as { message?: string } | undefined
      const message = detail?.message || 'Falha ao renderizar dashboard embedded.'
      toast.error(message)
      setEmbedState('error')
    })

    return () => {
      report.off('loaded')
      report.off('error')
      powerBIService.reset(container)
    }
  }, [embedConfig, embedState])

  if (!dashboard) {
    return (
      <section className="animate-fade-in">
        <Card>
          <CardHeader>
            <CardTitle>Nenhum dashboard disponivel</CardTitle>
            <CardDescription>Cadastre um dashboard na tela de gestao para visualizar embed.</CardDescription>
          </CardHeader>
        </Card>
      </section>
    )
  }

  if (!hasAccess) {
    return (
      <section className="animate-fade-in">
        <Card>
          <CardHeader>
            <CardTitle>Acesso negado ao dashboard</CardTitle>
            <CardDescription>
              Este dashboard pertence ao tenant {dashboard.tenantName} e nao esta autorizado para sua conta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/dashboards">Voltar para lista de dashboards</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className="animate-fade-in">
      <Breadcrumb className="mb-3">
        <BreadcrumbList>
          <BreadcrumbItem>
            <Link to="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Home
            </Link>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <Link to="/dashboards" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Dashboards
            </Link>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{dashboard.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title={dashboard.name}
        description={dashboard.description ?? 'Visualizacao embedded com controle de acesso por tenant.'}
        actions={
          <>
            <Button variant="outline" className="gap-2" onClick={handleRefreshToken}>
              <RefreshCcw className="h-4 w-4" />
              Atualizar token
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setEmbedState('error')}>
              Simular erro
            </Button>
            <Button className="gap-2" onClick={handleFullScreen}>
              <Maximize2 className="h-4 w-4" />
              Tela cheia
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-1">
        <Card id="embed-container">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral">{dashboard.tenantName}</Badge>
                <Badge variant="neutral">{dashboard.category}</Badge>
                <Badge variant={dashboard.status === 'active' ? 'success' : 'warning'}>
                  {dashboard.status}
                </Badge>
                {dashboard.tags?.map((tag) => (
                  <Badge key={tag} variant="neutral">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0 sm:px-4">
            <div className="relative h-[calc(100vh-245px)] min-h-[640px] overflow-hidden rounded-2xl border border-primary/20 bg-muted/20 p-2">
              {embedState === 'loading' ? (
                <>
                  <Skeleton className="h-full w-full rounded-xl" />
                  <p className="mt-3 text-sm text-muted-foreground">Carregando configuracao de embed segura...</p>
                </>
              ) : null}

              {embedState === 'ready' ? (
                <div className="flex h-full min-h-0 flex-col rounded-xl border border-border/70 bg-white p-2">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">Power BI Embedded</p>
                    <Badge>{embedConfig?.accessToken.startsWith('demo-embed-token') ? 'Token demo' : 'Token real'}</Badge>
                  </div>
                  <div
                    ref={embedHostRef}
                    className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border/60"
                  />
                </div>
              ) : null}

              {embedState === 'error' ? (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-center">
                  <AlertTriangle className="h-7 w-7 text-rose-600" />
                  <p className="mt-2 font-semibold text-rose-800">Falha ao carregar dashboard</p>
                  <p className="mt-1 max-w-sm text-sm text-rose-700">
                    Token expirado ou configuracao de tenant inconsistente. Refaca a requisicao de embed.
                  </p>
                  <Button className="mt-4" onClick={handleRefreshToken}>
                    Tentar novamente
                  </Button>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

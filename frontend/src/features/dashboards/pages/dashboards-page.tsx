import { lazy, Suspense, useEffect, useRef, useState } from 'react'

import { Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { apiRequest } from '@/services/api-client'

const CulturaDashboard = lazy(() => import('../cultura/cultura-dashboard').then((module) => ({ default: module.CulturaDashboard })))
const BaianaDashboard = lazy(() => import('../baiana/baiana-dashboard').then((module) => ({ default: module.BaianaDashboard })))
type PythonDashboard = { id: 'cultura-inglesa' | 'faculdade-baiana'; name: string }

export const DashboardsPage = () => {
  const { user, actorUser } = useAuth()
  // Remount on identity changes, discarding the previous tenant's data and tab.
  return <ScopedDashboardsPage key={`${actorUser?.id}:${user?.id}:${user?.tenantId}`} />
}

const ScopedDashboardsPage = () => {
  const [dashboards, setDashboards] = useState<PythonDashboard[]>([])
  const [selected, setSelected] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const panelRef = useRef<HTMLElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [fullscreenError, setFullscreenError] = useState(false)
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === panelRef.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])
  const toggleFullscreen = async () => {
    setFullscreenError(false)
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await panelRef.current?.requestFullscreen()
    } catch { setFullscreenError(true) }
  }
  const pythonAvailable = dashboards.length > 0

  useEffect(() => {
    let cancelled = false
    void apiRequest<{ dashboards: PythonDashboard[] }>('/dashboards/python/catalog/', { cache: 'no-store' })
      .then(({ dashboards: items }) => {
        if (!cancelled) {
          const available = items.filter(item => ['cultura-inglesa', 'faculdade-baiana'].includes(item.id))
          setDashboards(available)
          setSelected(available[0]?.id ?? '')
        }
      })
      .catch(() => { if (!cancelled) { setDashboards([]); setFailed(true) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <section ref={panelRef} className="lemon-dashboard-page">
      <div className="lemon-dashboard-toolbar">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h2 className="text-sm font-bold text-slate-900">Dashboard python</h2>
          {dashboards.length > 1 ? <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Cliente
            <select aria-label="Cliente do dashboard" value={selected} onChange={event => setSelected(event.target.value)}
              className="h-9 max-w-[220px] rounded-lg border bg-card px-3 text-sm text-foreground">
              {dashboards.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label> : <span className="text-sm text-muted-foreground">{dashboards[0]?.name}</span>}
        </div>
        {document.fullscreenEnabled && <Button variant="outline" size="sm" className="gap-2" onClick={() => void toggleFullscreen()}>
          {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          {fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
        </Button>}
      </div>
      {fullscreenError && <p role="alert" className="pb-2 text-sm text-destructive">Não foi possível abrir a tela cheia neste navegador.</p>}
      <div className="lemon-dashboard-content">
        {!pythonAvailable && <p role={failed ? 'alert' : 'status'} className="p-6 text-sm text-muted-foreground">
          {loading ? 'Carregando dashboards…' : failed ? 'Não foi possível carregar os dashboards. Atualize a página para tentar novamente.' : 'Nenhum dashboard disponível para este usuário.'}
        </p>}
        {pythonAvailable && <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Carregando dashboard...</p>}>
          {selected === 'cultura-inglesa' && <CulturaDashboard />}
          {selected === 'faculdade-baiana' && <BaianaDashboard />}
        </Suspense>}
      </div>
    </section>
  )
}

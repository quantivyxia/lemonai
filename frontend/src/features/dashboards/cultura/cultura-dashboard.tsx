import { useEffect, useState, type ComponentType } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { apiRequest } from '@/services/api-client'

import './cultura-dashboard.css'

export const CulturaDashboard = () => {
  const [Viewer, setViewer] = useState<ComponentType | null>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError(null)
    setHtml(null)
    setViewer(null)
    void apiRequest<Record<string, unknown>>('/dashboards/python/cultura-inglesa/', { cache: 'no-store' }).then(async (dataset) => {
      if (cancelled) return
      if (typeof dataset.__cultura_html === 'string' && dataset.__cultura_html.trim()) {
        setHtml(dataset.__cultura_html)
        return
      }
      const { createCulturaDashboard } = await import('./cultura-final.jsx')
      const finalDataset = dataset.__cultura_final as Record<string, unknown> | undefined
      if (!finalDataset) throw new Error('A versão final do dashboard ainda não está disponível. Tente novamente.')
      if (!cancelled) setViewer(() => createCulturaDashboard(finalDataset))
    }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Nao foi possivel carregar o dashboard.')
    })
    return () => { cancelled = true }
  }, [attempt])

  if (error) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <p role="alert" className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</Button>
        </CardContent>
      </Card>
    )
  }

  if (html) return <iframe
    title="Portal Financeiro — Cultura Inglesa"
    srcDoc={html}
    sandbox="allow-scripts allow-downloads"
    referrerPolicy="no-referrer"
    className="h-full w-full border-0 bg-white"
  />

  if (!Viewer) return <p role="status" className="p-6 text-sm text-muted-foreground">Carregando dashboard...</p>

  return <div className="cultura-dashboard"><Viewer /></div>
}

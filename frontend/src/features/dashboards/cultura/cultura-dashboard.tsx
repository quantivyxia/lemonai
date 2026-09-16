import { useEffect, useState, type ComponentType } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { apiRequest } from '@/services/api-client'

import './cultura-dashboard.css'

export const CulturaDashboard = () => {
  const [Viewer, setViewer] = useState<ComponentType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError(null)
    void Promise.all([
      apiRequest<Record<string, unknown>>('/dashboards/python/cultura-inglesa/', { cache: 'no-store' }),
      import('./cultura-viewer.jsx'),
    ]).then(([dataset, { createCulturaDashboard }]) => {
      if (!cancelled) setViewer(() => createCulturaDashboard(dataset))
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

  if (!Viewer) return <p role="status" className="p-6 text-sm text-muted-foreground">Carregando dashboard...</p>

  return <div className="cultura-dashboard"><Viewer /></div>
}

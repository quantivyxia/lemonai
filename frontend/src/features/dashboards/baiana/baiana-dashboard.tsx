import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/services/api-client'

export const BaianaDashboard = () => {
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError(false)
    setHtml(null)
    void apiRequest<{ html: string }>('/dashboards/python/faculdade-baiana/', { cache: 'no-store' })
      .then((data) => {
        if (typeof data.html !== 'string' || !data.html.trim()) throw new Error('Empty dashboard')
        if (!cancelled) setHtml(data.html)
      })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [attempt])

  if (error) return <div className="space-y-3 rounded-2xl border bg-card p-6">
    <p role="alert">Não foi possível carregar o painel da Faculdade Baiana.</p>
    <Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</Button>
  </div>
  if (!html) return <p role="status" className="p-6 text-sm text-muted-foreground">Carregando painel...</p>

  return <iframe
    title="Painel de Pessoas — Faculdade Baiana de Direito"
    srcDoc={`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${html}</body></html>`}
    sandbox="allow-scripts allow-downloads"
    referrerPolicy="no-referrer"
    className="w-full rounded-2xl border bg-white"
    style={{ height: 'max(720px, calc(100dvh - 220px))' }}
  />
}

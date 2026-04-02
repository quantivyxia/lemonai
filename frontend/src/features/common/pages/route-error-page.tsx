import { AlertTriangle, Home, RefreshCcw } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useRouteError } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { appLogger } from '@/services/app-logger'

export const RouteErrorPage = () => {
  const error = useRouteError()
  const message = error instanceof Error ? error.message : 'Falha inesperada ao renderizar a rota.'

  useEffect(() => {
    appLogger.error('Erro de rota no frontend', {
      message,
    })
  }, [message])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#ebf3ff_0%,#f3f6fb_33%,#f5f7fb_65%,#f3f6fb_100%)] px-4">
      <Card className="w-full max-w-lg shadow-floating">
        <CardHeader className="space-y-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <CardTitle>Falha ao carregar a pagina</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => window.location.reload()} className="flex-1">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              Ir para home
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

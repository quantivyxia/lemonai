import { AlertTriangle, RefreshCcw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { appLogger } from '@/services/app-logger'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    appLogger.error('Erro inesperado no frontend', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#ebf3ff_0%,#f3f6fb_33%,#f5f7fb_65%,#f3f6fb_100%)] px-4">
        <Card className="w-full max-w-lg shadow-floating">
          <CardHeader className="space-y-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <CardTitle>Erro inesperado na aplicacao</CardTitle>
            <CardDescription>
              Ocorreu uma falha no frontend. Recarregue a pagina para tentar novamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={this.handleReload} className="w-full">
              <RefreshCcw className="mr-2 h-4 w-4" />
              Recarregar pagina
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
}

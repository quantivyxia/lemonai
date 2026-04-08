import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { sessionStorageService } from '@/services/session-storage'

/**
 * Landing page after Microsoft OAuth success.
 * Backend redirects here with ?access=...&refresh=...
 * We store the tokens and navigate to home — ProtectedRoute will hydrateSession.
 */
export const MicrosoftCallbackPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const access = searchParams.get('access')
    const refresh = searchParams.get('refresh')

    if (!access || !refresh) {
      toast.error('Falha ao completar login com a Microsoft.')
      navigate('/auth/login', { replace: true })
      return
    }

    sessionStorageService.setTokens({ access, refresh }, false)
    toast.success('Acesso autorizado com sucesso.')
    navigate('/', { replace: true })
  }, [navigate, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Concluindo autenticacao com a Microsoft...</p>
      </div>
    </div>
  )
}

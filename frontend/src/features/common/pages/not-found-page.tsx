import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export const NotFoundPage = () => {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <p className="font-display text-5xl font-semibold text-slate-900">404</p>
      <p className="mt-2 text-sm text-muted-foreground">A pagina solicitada nao foi encontrada.</p>
      <Button className="mt-5" asChild>
        <Link to="/">Voltar para Home</Link>
      </Button>
    </div>
  )
}

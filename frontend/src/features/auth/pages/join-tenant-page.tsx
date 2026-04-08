import { motion } from 'framer-motion'
import { Building2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { sessionStorageService } from '@/services/session-storage'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? 'http://127.0.0.1:8000/api'

/**
 * Shown after Microsoft login when the user is not yet registered.
 * The user enters their company join code to be linked to the correct tenant.
 */
export const JoinTenantPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const state = searchParams.get('state') ?? ''
  const [joinCode, setJoinCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (!code) {
      toast.error('Digite o codigo da empresa.')
      return
    }
    if (!state) {
      toast.error('Sessao invalida. Faca login novamente.')
      navigate('/auth/login', { replace: true })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/authentication/microsoft/join/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, join_code: code }),
      })

      const data = await response.json()

      if (!response.ok) {
        const message =
          data?.join_code?.[0] ??
          data?.detail ??
          data?.non_field_errors?.[0] ??
          'Nao foi possivel completar o cadastro.'
        toast.error(message)
        return
      }

      sessionStorageService.setTokens({ access: data.access, refresh: data.refresh }, false)
      toast.success('Cadastro realizado! Bem-vindo ao LemonAI.')
      navigate('/', { replace: true })
    } catch {
      toast.error('Nao foi possivel conectar ao servidor.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full max-w-[360px]"
    >
      {/* Mobile logo */}
      <div className="mb-8 flex items-center gap-2.5 lg:hidden">
        <img src="/favicon.svg" alt="LemonAI" className="h-8 w-8" />
        <span className="font-display text-xl font-bold text-foreground">LemonAI</span>
      </div>

      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
        <Building2 className="h-6 w-6 text-primary" />
      </div>

      <div className="mb-8 mt-4">
        <h2 className="font-display mb-2 text-3xl font-bold tracking-tight text-foreground">
          Qual e a sua empresa?
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Sua conta Microsoft foi autenticada. Agora informe o codigo da empresa para acessar o ambiente correto.
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Codigo da empresa</label>
          <Input
            className="h-11 border-border/70 bg-slate-50 font-mono uppercase tracking-widest transition-colors focus-visible:bg-white"
            placeholder="EX: PRUMO-AB12"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            autoComplete="off"
            autoFocus
            maxLength={20}
          />
          <p className="text-xs text-muted-foreground">
            Solicite o codigo ao administrador da sua empresa no LemonAI.
          </p>
        </div>

        <Button className="h-11 w-full text-sm font-semibold" type="submit" disabled={isLoading}>
          {isLoading ? 'Validando...' : 'Entrar na plataforma'}
        </Button>
      </form>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => navigate('/auth/login', { replace: true })}
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          ← Voltar para o login
        </button>
      </div>
    </motion.div>
  )
}

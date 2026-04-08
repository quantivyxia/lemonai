import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? 'http://127.0.0.1:8000/api'

const MS_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Acesso negado pela Microsoft.',
  invalid_state: 'Sessao invalida. Tente novamente.',
  token_failed: 'Falha ao autenticar com a Microsoft.',
  no_email: 'Nao foi possivel obter seu e-mail da Microsoft.',
  email_account: 'Este e-mail ja possui cadastro com senha. Use o login por e-mail.',
  inactive: 'Sua conta esta inativa. Entre em contato com o suporte.',
}

const loginSchema = z.object({
  email: z.email('Informe um e-mail valido.'),
  password: z.string().min(6, 'A senha precisa ter ao menos 6 caracteres.'),
  remember: z.boolean(),
})

type LoginFormData = z.infer<typeof loginSchema>

export const LoginForm = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const msError = searchParams.get('ms_error')
    if (msError) {
      toast.error(MS_ERROR_MESSAGES[msError] ?? 'Erro ao autenticar com a Microsoft.')
    }
  }, [searchParams])

  const handleMicrosoftLogin = () => {
    window.location.href = `${API_BASE_URL}/authentication/microsoft/`
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: false },
  })

  const onSubmit = async (values: LoginFormData) => {
    try {
      await login(values)
      toast.success('Acesso autorizado com sucesso.')
      navigate('/')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel iniciar sessao.'
      toast.error(message)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full max-w-[360px]"
    >
      {/* Mobile logo — only shown when left panel is hidden */}
      <div className="mb-8 flex items-center gap-2.5 lg:hidden">
        <img src="/favicon.svg" alt="LemonAI" className="h-8 w-8" />
        <span className="font-display text-xl font-bold text-foreground">LemonAI</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h2 className="font-display mb-2 text-3xl font-bold tracking-tight text-foreground">
          Bem-vindo de volta
        </h2>
        <p className="text-sm text-muted-foreground">
          Entre com suas credenciais para acessar a plataforma.
        </p>
      </div>

      {/* Form */}
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">E-mail corporativo</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              {...register('email')}
              className="h-11 border-border/70 bg-slate-50 pl-9 transition-colors focus-visible:bg-white"
              placeholder="voce@empresa.com"
              autoComplete="email"
            />
          </div>
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Senha</label>
            <button
              type="button"
              className="text-xs font-medium text-primary transition-opacity hover:opacity-75"
            >
              Esqueceu a senha?
            </button>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              className="h-11 border-border/70 bg-slate-50 pl-9 pr-10 transition-colors focus-visible:bg-white"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setShowPassword((v) => !v)}
              aria-label="Alternar visualizacao da senha"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-2.5">
          <input
            {...register('remember')}
            id="remember"
            type="checkbox"
            className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
          />
          <label
            htmlFor="remember"
            className="cursor-pointer select-none text-sm text-muted-foreground"
          >
            Manter sessao ativa
          </label>
        </div>

        {/* Submit */}
        <Button
          className="mt-1 h-11 w-full text-sm font-semibold"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Validando acesso...' : 'Entrar na plataforma'}
        </Button>
      </form>

      {/* Microsoft login */}
      <div className="mt-5">
        <div className="relative flex items-center gap-3">
          <div className="h-px flex-1 bg-border/60" />
          <span className="text-xs text-muted-foreground">ou</span>
          <div className="h-px flex-1 bg-border/60" />
        </div>
        <button
          type="button"
          onClick={handleMicrosoftLogin}
          className="mt-4 flex w-full items-center justify-center gap-3 rounded-lg border border-border/70 bg-white px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" className="h-4 w-4 flex-shrink-0">
            <rect x="1" y="1" width="9" height="9" fill="#f25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
          </svg>
          Entrar com Microsoft
        </button>
      </div>

      {/* Divider + footer */}
      <div className="mt-8 border-t border-border/50 pt-6">
        <p className="text-center text-xs text-muted-foreground/70">
          Ao entrar, voce concorda com os{' '}
          <span className="cursor-pointer text-primary/80 hover:text-primary hover:underline">
            Termos de Uso
          </span>{' '}
          e a{' '}
          <span className="cursor-pointer text-primary/80 hover:text-primary hover:underline">
            Politica de Privacidade
          </span>
          .
        </p>
      </div>
    </motion.div>
  )
}

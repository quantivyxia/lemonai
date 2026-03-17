import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'

const demoAccounts = [
  { companyLabel: 'InsightHub Global (Dono)', email: 'dono@insighthub.com', password: '123456' },
  { companyLabel: 'Nexa (Analista)', email: 'analista@nexa.com', password: '123456' },
  { companyLabel: 'Nexa (Usuario)', email: 'usuario@nexa.com', password: '123456' },
]

const loginSchema = z.object({
  email: z.email('Informe um e-mail valido.'),
  password: z
    .string()
    .min(6, 'A senha precisa ter ao menos 6 caracteres.'),
  remember: z.boolean(),
})

type LoginFormData = z.infer<typeof loginSchema>

export const LoginForm = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'dono@insighthub.com',
      password: '123456',
      remember: true,
    },
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md"
    >
      <Card className="border-border/70 shadow-floating">
        <CardHeader className="space-y-2">
          <CardTitle>Entrar no InsightHub</CardTitle>
          <CardDescription>Acesse seu portal analitico com seguranca e governanca.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">E-mail corporativo</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input {...register('email')} className="pl-9" placeholder="voce@empresa.com" />
              </div>
              {errors.email ? <p className="text-xs text-rose-600">{errors.email.message}</p> : null}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Senha</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className="pl-9 pr-9"
                />
                <button
                  type="button"
                  className="absolute right-2 top-2 rounded p-1 text-muted-foreground transition hover:bg-muted"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label="Alternar visualizacao da senha"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password ? (
                <p className="text-xs text-rose-600">{errors.password.message}</p>
              ) : null}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <Checkbox
                  checked={watch('remember')}
                  onCheckedChange={(checked) => setValue('remember', Boolean(checked))}
                />
                Lembrar acesso
              </label>
              <button type="button" className="text-sm font-medium text-primary hover:underline">
                Esqueceu a senha?
              </button>
            </div>

            <div className="space-y-2 rounded-xl border border-border/70 bg-muted/25 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Acessos de demonstracao
              </p>
              <div className="flex flex-col gap-2">
                {demoAccounts.map((credential) => (
                  <button
                    key={credential.email}
                    type="button"
                    className="rounded-lg border border-border/80 bg-white px-3 py-2 text-left text-xs transition hover:border-primary/35 hover:bg-primary/5"
                    onClick={() => {
                      setValue('email', credential.email)
                      setValue('password', credential.password)
                    }}
                  >
                    <p className="font-semibold text-slate-800">{credential.companyLabel}</p>
                    <p className="mt-0.5 text-muted-foreground">{credential.email}</p>
                  </button>
                ))}
              </div>
            </div>

            <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Validando acesso...' : 'Entrar na plataforma'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  )
}

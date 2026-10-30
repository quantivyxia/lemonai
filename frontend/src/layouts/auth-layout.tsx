import { BarChart3, Building2, ShieldCheck } from 'lucide-react'
import { Outlet } from 'react-router-dom'

const features = [
  { icon: BarChart3, label: 'Seus dashboards em um só lugar' },
  { icon: ShieldCheck, label: 'Controle de acesso por usuário e grupo' },
  { icon: Building2, label: 'Um portal para cada cliente' },
]

export const AuthLayout = () => (
  <div className="lemon-login">
    <aside className="lemon-login-brand">
      <div className="flex items-center gap-3 text-xl font-extrabold">
        <img src="/favicon.svg" alt="" className="h-9 w-9" />LemonAI
      </div>
      <div className="lemon-login-message">
        <h1>Dados que geram<br /><span>decisões reais.</span></h1>
        <p>Dashboards, informações e acesso aos seus indicadores em uma experiência simples e organizada.</p>
        <div className="mt-9 space-y-4">
          {features.map(({ icon: Icon, label }) => <div key={label} className="flex items-center gap-3.5 text-sm text-blue-50">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/15 bg-white/10"><Icon size={18} /></span>
            {label}
          </div>)}
        </div>
      </div>
      <p className="text-xs text-blue-100/70">© {new Date().getFullYear()} LemonAI · Todos os direitos reservados</p>
    </aside>
    <main className="lemon-login-form"><Outlet /></main>
  </div>
)

import { Outlet } from 'react-router-dom'

export const AuthLayout = () => {
  return (
    <div className="flex min-h-screen">
      {/* Left branding panel */}
      <div className="relative hidden lg:flex lg:w-[58%] flex-col overflow-hidden bg-gradient-to-br from-slate-900 via-[#0a2347] to-slate-900">
        {/* Dot grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* Glow blobs */}
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-16 h-64 w-64 rounded-full bg-yellow-400/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-32 right-24 h-40 w-40 rounded-full bg-blue-500/20 blur-2xl" />

        <div className="relative z-10 flex h-full flex-col p-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="LemonAI" className="h-9 w-9" />
            <span className="font-display text-2xl font-bold tracking-tight text-white">LemonAI</span>
          </div>

          {/* Main content */}
          <div className="flex flex-1 flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-1.5 text-xs text-blue-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Plataforma de BI empresarial
            </div>

            <h1 className="font-display mb-5 text-5xl font-bold leading-[1.12] text-white">
              Dados que geram
              <br />
              <span className="text-yellow-300">decisões reais.</span>
            </h1>

            <p className="mb-12 max-w-sm text-base leading-relaxed text-blue-200/80">
              Dashboards inteligentes com governança, segurança avançada e Row-Level Security
              integrados para toda a sua empresa.
            </p>

            {/* Feature list */}
            <div className="space-y-4">
              {[
                { icon: '📊', label: 'Dashboards Power BI embarcados em tempo real' },
                { icon: '🔒', label: 'Controle de acesso por usuário, grupo e função' },
                { icon: '🏢', label: 'Multi-tenant com isolamento e auditoria completos' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3.5">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-base">
                    {item.icon}
                  </div>
                  <span className="text-sm text-blue-100/90">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Decorative metric cards */}
            <div className="mt-12 flex gap-4">
              {[
                { value: '99.9%', label: 'Uptime' },
                { value: 'SOC 2', label: 'Compliance' },
                { value: '<200ms', label: 'Latência' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm"
                >
                  <p className="font-display text-xl font-bold text-white">{stat.value}</p>
                  <p className="mt-0.5 text-xs text-blue-300">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-blue-500">
            © {new Date().getFullYear()} LemonAI · Todos os direitos reservados
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center bg-white p-8 sm:p-12">
        <Outlet />
      </div>
    </div>
  )
}

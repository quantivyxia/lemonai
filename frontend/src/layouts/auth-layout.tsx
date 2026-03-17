import { motion } from 'framer-motion'
import { Outlet } from 'react-router-dom'

export const AuthLayout = () => {
  return (
    <div className="grid min-h-screen bg-[linear-gradient(130deg,#f6f8fc_0%,#eef3fa_45%,#e9f2f7_100%)] lg:grid-cols-[minmax(0,1fr)_520px]">
      <section className="relative hidden overflow-hidden p-12 lg:block">
        <div className="absolute -left-10 top-24 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-14 right-12 h-52 w-52 rounded-full bg-teal-200/40 blur-3xl" />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative mx-auto mt-16 max-w-xl"
        >
          <div className="inline-flex rounded-full border border-primary/20 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-primary">
            InsightHub
          </div>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-tight text-slate-900">
            Governanca analitica com experiencia SaaS premium.
          </h1>
          <p className="mt-4 max-w-lg text-base text-slate-600">
            Distribua dashboards embarcados com controle multi-tenant, seguranca de acesso e branding por cliente.
          </p>
        </motion.div>
      </section>

      <section className="flex items-center justify-center p-4 sm:p-8">
        <Outlet />
      </section>
    </div>
  )
}

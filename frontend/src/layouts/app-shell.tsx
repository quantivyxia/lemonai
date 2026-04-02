import { AnimatePresence, motion } from 'framer-motion'
import { Eye, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { SidebarNav } from '@/components/layout/sidebar-nav'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { usePlatformStore } from '@/hooks/use-platform-store'

export const AppShell = () => {
  const { actorUser, isViewAsMode, stopViewAs, user } = useAuth()
  const { brandings, loadError } = usePlatformStore()
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const { pathname } = useLocation()
  const isDashboardViewRoute = /^\/dashboards\/[^/]+$/.test(pathname)
  const tenantPortalName = useMemo(
    () => brandings.find((item) => item.tenantId === user?.tenantId)?.platformName?.trim(),
    [brandings, user?.tenantId],
  )
  const portalName =
    user?.role === 'super_admin'
      ? 'LemonAI'
      : tenantPortalName || user?.tenantName || 'LemonAI'

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ebf3ff_0%,#f3f6fb_33%,#f5f7fb_65%,#f3f6fb_100%)]">
      <div className={isDashboardViewRoute ? 'mx-auto flex w-full max-w-none' : 'mx-auto flex max-w-[1880px]'}>
        <SidebarNav />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar onMobileMenuOpen={() => setIsMobileSidebarOpen(true)} />
          {isViewAsMode && user ? (
            <div className="border-b border-amber-200 bg-amber-50/85 px-4 py-3 backdrop-blur sm:px-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700">
                    <Eye className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-950">
                      Visualizando como {user.name}
                    </p>
                    <p className="text-xs text-amber-800">
                      Alteracoes estao bloqueadas. Sessao real: {actorUser?.name}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="border-amber-300 bg-white/80" onClick={stopViewAs}>
                  Sair da visualizacao
                </Button>
              </div>
            </div>
          ) : null}
          {loadError ? (
            <div className="border-b border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-900 sm:px-6">
              Falha ao carregar dados da plataforma. {loadError}
            </div>
          ) : null}
          <main
            className={
              isDashboardViewRoute
                ? 'flex-1 px-2 py-6 sm:px-3 lg:px-4 xl:px-5'
                : 'flex-1 px-3 py-6 sm:px-4 lg:px-5'
            }
          >
            <Outlet />
          </main>
        </div>
      </div>

      <AnimatePresence>
        {isMobileSidebarOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex bg-slate-900/30 lg:hidden"
          >
            <motion.div
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full w-[300px] bg-white p-4 shadow-floating"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="font-display text-lg font-semibold">{portalName}</div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsMobileSidebarOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <SidebarNav mobile />
            </motion.div>
            <button
              className="flex-1"
              aria-label="Fechar menu"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

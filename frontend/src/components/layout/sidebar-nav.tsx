import {
  BarChart3,
  Building2,
  Compass,
  DatabaseZap,
  FileText,
  ActivitySquare,
  LayoutDashboard,
  LifeBuoy,
  Palette,
  ShieldAlert,
  ShieldCheck,
  Users,
  UsersRound,
  Workflow,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/use-auth'
import { usePlatformStore } from '@/hooks/use-platform-store'
import { cn } from '@/lib/utils'
import { TICKET_NOTIFICATIONS_UPDATED_EVENT, ticketsApi } from '@/services/tickets-api'
import type { NavItem } from '@/types/navigation'

const mainNav: NavItem[] = [
  { label: 'Home', path: '/', icon: LayoutDashboard },
  { label: 'Dashboards', path: '/dashboards', icon: BarChart3 },
  { label: 'Workspaces', path: '/workspaces', icon: Workflow, roles: ['super_admin', 'analyst'] },
  { label: 'Power BI', path: '/powerbi', icon: DatabaseZap, roles: ['super_admin', 'analyst'] },
  { label: 'Usuarios', path: '/users', icon: Users, roles: ['super_admin', 'analyst'] },
  { label: 'Grupos', path: '/groups', icon: UsersRound, roles: ['super_admin', 'analyst'] },
  { label: 'Permissoes', path: '/permissions', icon: ShieldCheck, roles: ['super_admin'] },
  {
    label: 'Regras RLS',
    path: '/rls',
    icon: ShieldAlert,
    roles: ['super_admin', 'analyst'],
  },
  { label: 'Tenants', path: '/tenants', icon: Building2, roles: ['super_admin', 'analyst'] },
  { label: 'Auditoria', path: '/audit', icon: FileText, roles: ['super_admin', 'analyst'] },
  { label: 'Monitoramento', path: '/monitoring', icon: ActivitySquare, roles: ['super_admin'] },
]

const secondaryNav: NavItem[] = [
  { label: 'Suporte', path: '/tickets', icon: LifeBuoy, roles: ['super_admin', 'analyst'] },
  {
    label: 'White-label',
    path: '/settings/branding',
    icon: Palette,
    badge: 'Novo',
    roles: ['super_admin', 'analyst'],
  },
  { label: 'Configuracoes', path: '/settings/platform', icon: Compass },
]

export const SidebarNav = ({ mobile = false }: { mobile?: boolean }) => {
  const location = useLocation()
  const { user } = useAuth()
  const { brandings } = usePlatformStore()
  const [unreadCount, setUnreadCount] = useState(0)
  const showSupportBadge = user?.role === 'analyst'

  const loadNotifications = useCallback(async () => {
    if (!showSupportBadge) {
      setUnreadCount(0)
      return
    }

    try {
      const payload = await ticketsApi.getNotifications()
      setUnreadCount(payload.unreadCount)
    } catch {
      setUnreadCount(0)
    }
  }, [showSupportBadge])

  useEffect(() => {
    if (!showSupportBadge) return

    void loadNotifications()
    const intervalId = window.setInterval(() => {
      void loadNotifications()
    }, 45000)
    const handleFocus = () => {
      void loadNotifications()
    }
    const handleNotificationsUpdated = () => {
      void loadNotifications()
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener(TICKET_NOTIFICATIONS_UPDATED_EVENT, handleNotificationsUpdated)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener(TICKET_NOTIFICATIONS_UPDATED_EVENT, handleNotificationsUpdated)
    }
  }, [loadNotifications, showSupportBadge])

  const visibleMainNav = mainNav.filter((item) => !item.roles || (user && item.roles.includes(user.role)))
  const visibleSecondaryNav = secondaryNav.filter((item) => !item.roles || (user && item.roles.includes(user.role)))
  const tenantPortalName = useMemo(
    () => brandings.find((item) => item.tenantId === user?.tenantId)?.platformName?.trim(),
    [brandings, user?.tenantId],
  )
  const portalName =
    user?.role === 'super_admin'
      ? 'InsightHub'
      : tenantPortalName || user?.tenantName || 'InsightHub'

  return (
    <aside
      className={cn(
        'w-full flex-col bg-white px-4 py-5',
        mobile ? 'flex h-full' : 'hidden w-[284px] border-r border-border/70 lg:flex',
      )}
    >
      <Link to="/" className="mb-8 block rounded-2xl bg-gradient-to-r from-primary/10 via-primary/15 to-teal-100/70 px-4 py-4">
        <div className="font-display text-xl font-semibold text-slate-900">{portalName}</div>
        <p className="mt-1 text-xs font-medium text-slate-600">Embedded Intelligence Portal</p>
      </Link>

      <nav className="space-y-1.5">
        {visibleMainNav.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-600 hover:bg-muted/60 hover:text-slate-900',
              )}
            >
              <span className="flex items-center gap-3">
                <Icon className={cn('h-[18px] w-[18px]', isActive ? 'text-primary' : 'text-slate-500 group-hover:text-slate-700')} />
                {item.label}
              </span>
              {item.badge ? <Badge variant="neutral">{item.badge}</Badge> : null}
            </Link>
          )
        })}
      </nav>

      <div className="my-6 h-px bg-border/80" />

      <nav className="space-y-1.5">
        {visibleSecondaryNav.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          const showUnreadBadge = item.path === '/tickets' && unreadCount > 0
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-600 hover:bg-muted/60 hover:text-slate-900',
              )}
            >
              <span className="flex items-center gap-3">
                <Icon className={cn('h-[18px] w-[18px]', isActive ? 'text-primary' : 'text-slate-500 group-hover:text-slate-700')} />
                {item.label}
              </span>
              <span className="flex items-center gap-2">
                {item.badge ? <Badge variant="default">{item.badge}</Badge> : null}
                {showUnreadBadge ? (
                  unreadCount > 1 ? (
                    <span className="inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  ) : (
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                  )
                ) : null}
              </span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

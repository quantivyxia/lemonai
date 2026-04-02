import { Bell, Menu, Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'
import { formatDate } from '@/lib/utils'
import { appLogger } from '@/services/app-logger'
import { TICKET_NOTIFICATIONS_UPDATED_EVENT, ticketsApi } from '@/services/tickets-api'
import type { TicketNotification } from '@/types/entities'

const mapPathToTitle: Record<string, string> = {
  '/': 'Dashboard Home',
  '/dashboards': 'Gestao de Dashboards',
  '/workspaces': 'Gestao de Workspaces',
  '/powerbi': 'Power BI Embedded',
  '/tickets': 'Suporte',
  '/users': 'Gestao de Usuarios',
  '/tenants': 'Gestao de Tenants',
  '/groups': 'Gestao de Grupos',
  '/permissions': 'Perfis e Permissoes',
  '/rls': 'Regras de RLS',
  '/audit': 'Auditoria',
  '/monitoring': 'Monitoramento Global',
  '/settings/branding': 'White-label',
  '/settings/platform': 'Configuracoes',
}

export const Topbar = ({ onMobileMenuOpen }: { onMobileMenuOpen: () => void }) => {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<TicketNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const currentTitle = pathname.startsWith('/reports/')
    ? 'Visualizacao de Dashboard'
    : (mapPathToTitle[pathname] ?? 'LemonAI')
  const showTicketNotifications = user?.role === 'analyst'

  const loadNotifications = useCallback(async () => {
    if (!showTicketNotifications) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    try {
      const payload = await ticketsApi.getNotifications()
      setNotifications(payload.notifications)
      setUnreadCount(payload.unreadCount)
    } catch (error) {
      appLogger.warn('Falha ao carregar notificacoes de suporte', {
        message: error instanceof Error ? error.message : 'unknown',
      })
    }
  }, [showTicketNotifications])

  useEffect(() => {
    if (!showTicketNotifications) return

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
  }, [loadNotifications, showTicketNotifications])

  const handleOpenNotification = async (notification: TicketNotification) => {
    if (!notification.isRead) {
      await ticketsApi.markNotificationRead(notification.id).catch(() => undefined)
    }
    navigate(`/tickets?ticket=${notification.ticketId}`)
    void loadNotifications()
  }

  const handleMarkAllNotificationsRead = async () => {
    await ticketsApi.markAllNotificationsRead().catch(() => undefined)
    void loadNotifications()
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-white/90 backdrop-blur">
      <div className="flex h-[74px] items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMobileMenuOpen}>
            <Menu className="h-5 w-5" />
          </Button>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Portal
            </p>
            <h1 className="font-display text-lg font-semibold text-slate-900">
              {currentTitle}
            </h1>
          </div>
        </div>

        <div className="hidden max-w-md flex-1 items-center md:flex">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar dashboards, usuarios ou tenants..." />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {showTicketNotifications ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-4.5 w-4.5" />
                  {unreadCount > 0 ? (
                    <span className="absolute right-1.5 top-1.5 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[360px]">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <DropdownMenuLabel className="p-0">Suporte</DropdownMenuLabel>
                  {unreadCount > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => void handleMarkAllNotificationsRead()}
                    >
                      Marcar todas
                    </Button>
                  ) : null}
                </div>
                <DropdownMenuSeparator />
                {notifications.length ? (
                  notifications.map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      className="items-start gap-3 rounded-xl p-3"
                      onSelect={() => void handleOpenNotification(notification)}
                    >
                      <div className="mt-0.5">
                        <Badge variant={notification.isRead ? 'neutral' : 'default'}>
                          {notification.ticketCode}
                        </Badge>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-1 text-sm font-semibold text-slate-900">
                            {notification.title}
                          </p>
                          {!notification.isRead ? <span className="mt-1 h-2 w-2 rounded-full bg-primary" /> : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {notification.message}
                        </p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {formatDate(notification.createdAt)}
                        </p>
                      </div>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="px-3 py-5 text-sm text-muted-foreground">
                    Nenhuma atualizacao de suporte pendente.
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto gap-3 rounded-xl px-2 py-1.5">
                <span className="hidden text-right sm:block">
                  <span className="block text-sm font-semibold text-slate-900">{user?.name}</span>
                  <span className="block text-xs text-muted-foreground">{user?.tenantName}</span>
                </span>
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{user?.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings/platform">Configuracoes</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void logout()}>Sair</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

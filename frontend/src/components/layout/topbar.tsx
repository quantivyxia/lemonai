import { Bell, Menu, Search } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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

const mapPathToTitle: Record<string, string> = {
  '/': 'Dashboard Home',
  '/dashboards': 'Gestao de Dashboards',
  '/workspaces': 'Gestao de Workspaces',
  '/powerbi': 'Power BI Embedded',
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
  const currentTitle = pathname.startsWith('/reports/')
    ? 'Visualizacao de Dashboard'
    : (mapPathToTitle[pathname] ?? 'InsightHub')

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
          <Button variant="ghost" size="icon">
            <Bell className="h-4.5 w-4.5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto rounded-xl px-2 py-1.5">
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

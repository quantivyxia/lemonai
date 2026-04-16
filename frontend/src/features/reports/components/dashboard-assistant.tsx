import {
  Loader2,
  RefreshCcw,
  SendHorizontal,
  Sparkles,
  X,
} from 'lucide-react'
import { matchPath, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { usePlatformStore } from '@/hooks/use-platform-store'
import {
  platformApi,
  type AssistantChatMessage,
  type AssistantPageContext,
} from '@/services/platform-api'

type AssistantPreset = {
  key: string
  title: string
  description: string
  placeholder: string
}

const ROUTE_PRESETS: Array<AssistantPreset & { patterns: string[] }> = [
  {
    key: 'home',
    title: 'Home',
    description: 'painel inicial com indicadores gerais da plataforma e acessos recentes',
    placeholder: 'Pergunte sobre a home, indicadores ou proximos passos...',
    patterns: ['/'],
  },
  {
    key: 'dashboards',
    title: 'Dashboards',
    description: 'lista de dashboards disponiveis para o usuario no tenant atual',
    placeholder: 'Pergunte sobre lista de dashboards, acesso ou filtros...',
    patterns: ['/dashboards'],
  },
  {
    key: 'users',
    title: 'Usuarios',
    description: 'gestao de usuarios, perfis, grupos, dashboards visiveis e espelhamento de acessos',
    placeholder: 'Pergunte sobre criacao, edicao e acesso de usuarios...',
    patterns: ['/users'],
  },
  {
    key: 'groups',
    title: 'Grupos',
    description: 'gestao de grupos com dashboards herdados para facilitar o controle de acesso',
    placeholder: 'Pergunte sobre grupos, heranca e organizacao de acessos...',
    patterns: ['/groups'],
  },
  {
    key: 'rls',
    title: 'Regras RLS',
    description: 'configuracao de filtros por usuario para restringir dados dentro dos dashboards',
    placeholder: 'Pergunte sobre RLS, filtros e restricao de dados...',
    patterns: ['/rls'],
  },
  {
    key: 'powerbi',
    title: 'Power BI',
    description: 'conexoes, sync de workspaces, importacao de PBIX, gateways e datasets',
    placeholder: 'Pergunte sobre conexoes, sync, PBIX e workspaces...',
    patterns: ['/powerbi', '/workspaces'],
  },
  {
    key: 'tenants',
    title: 'Tenants',
    description: 'cadastro e gestao de clientes, limites, branding e configuracao geral do tenant',
    placeholder: 'Pergunte sobre tenants, limites e onboarding...',
    patterns: ['/tenants'],
  },
  {
    key: 'audit',
    title: 'Auditoria',
    description: 'eventos, acessos e rastreamento do que cada usuario fez na plataforma',
    placeholder: 'Pergunte sobre auditoria, historico e rastreabilidade...',
    patterns: ['/audit', '/monitoring'],
  },
  {
    key: 'support',
    title: 'Suporte',
    description: 'abertura, acompanhamento e gerenciamento de chamados da plataforma',
    placeholder: 'Pergunte sobre chamados, evidencias e acompanhamento...',
    patterns: ['/tickets'],
  },
  {
    key: 'settings',
    title: 'Configuracoes',
    description: 'ajustes gerais, white-label, dominio, identidade visual e parametros do tenant',
    placeholder: 'Pergunte sobre branding, dominio e configuracoes...',
    patterns: ['/settings/branding', '/settings/platform', '/permissions'],
  },
]

const DEFAULT_PRESET: AssistantPreset = {
  key: 'app',
  title: 'LemonAI',
  description: 'plataforma analitica multi-tenant com modulos de acesso, dashboards, RLS e operacao',
  placeholder: 'Pergunte sobre a plataforma, acessos, RLS ou dashboards...',
}

const buildInitialMessage = (
  pageContext: AssistantPageContext,
  dashboardName?: string,
): AssistantChatMessage => {
  if (pageContext.isDashboard && dashboardName) {
    return {
      role: 'assistant',
      content:
        `Sou o assistente do LemonAI. Neste momento estou com o contexto seguro do dashboard "${dashboardName}". ` +
        'Posso explicar a plataforma, orientar a leitura desta tela e falar sobre filtros de acesso, mas ainda nao leio os valores numericos do relatorio diretamente.',
    }
  }

  return {
    role: 'assistant',
    content:
      `Sou o assistente do LemonAI. Agora estou te ajudando na area "${pageContext.title}". ` +
      'Posso explicar como usar o app, como funcionam usuarios, grupos, dashboards, RLS e demais fluxos da plataforma.',
  }
}

const resolveAssistantPreset = (
  pathname: string,
  dashboards: Array<{ id: string; name: string; description?: string }>,
): {
  pageContext: AssistantPageContext
  dashboardId?: string
  dashboardName?: string
  placeholder: string
} => {
  const reportMatch = matchPath('/reports/:dashboardId', pathname)
  const dashboardId = reportMatch?.params.dashboardId
  const currentDashboard = dashboardId
    ? dashboards.find((dashboard) => dashboard.id === dashboardId) ?? null
    : null

  if (dashboardId && currentDashboard) {
    return {
      pageContext: {
        key: 'dashboard_view',
        title: currentDashboard.name,
        path: pathname,
        description:
          currentDashboard.description?.trim() ||
          'visualizacao embedded de um dashboard com contexto de acesso seguro',
        isDashboard: true,
      },
      dashboardId: currentDashboard.id,
      dashboardName: currentDashboard.name,
      placeholder: 'Pergunte sobre este dashboard, filtros de acesso ou como usar a tela...',
    }
  }

  const matchedPreset =
    ROUTE_PRESETS.find((preset) =>
      preset.patterns.some((pattern) => Boolean(matchPath({ path: pattern, end: true }, pathname))),
    ) ?? DEFAULT_PRESET

  return {
    pageContext: {
      key: matchedPreset.key,
      title: matchedPreset.title,
      path: pathname,
      description: matchedPreset.description,
      isDashboard: false,
    },
    placeholder: matchedPreset.placeholder,
  }
}

export const AppAssistant = () => {
  const { pathname } = useLocation()
  const { dashboards } = usePlatformStore()
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const assistantContext = useMemo(
    () =>
      resolveAssistantPreset(
        pathname,
        dashboards.map((dashboard) => ({
          id: dashboard.id,
          name: dashboard.name,
          description: dashboard.description,
        })),
      ),
    [dashboards, pathname],
  )

  const [messages, setMessages] = useState<AssistantChatMessage[]>(() => [
    buildInitialMessage(assistantContext.pageContext, assistantContext.dashboardName),
  ])

  useEffect(() => {
    setMessages((current) => {
      const hasConversation = current.some(
        (message, index) => !(index === 0 && message.role === 'assistant'),
      )
      if (hasConversation) return current
      return [buildInitialMessage(assistantContext.pageContext, assistantContext.dashboardName)]
    })
    setInputValue('')
  }, [assistantContext.dashboardId, assistantContext.dashboardName, assistantContext.pageContext])

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isOpen])

  const sendMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isSending) return

    const nextMessages: AssistantChatMessage[] = [...messages, { role: 'user', content: trimmed }]
    setMessages(nextMessages)
    setInputValue('')
    setIsSending(true)

    try {
      const response = await platformApi.assistantChat({
        dashboardId: assistantContext.dashboardId,
        pageContext: assistantContext.pageContext,
        messages: nextMessages,
      })
      setMessages((current) => [...current, { role: 'assistant', content: response.reply }])
    } catch (error) {
      const fallbackMessage =
        error instanceof Error ? error.message : 'Nao foi possivel falar com o assistente agora.'
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: `Nao consegui responder agora. ${fallbackMessage}`,
        },
      ])
      toast.error(fallbackMessage)
    } finally {
      setIsSending(false)
    }
  }

  const handleReset = () => {
    if (isSending) return
    setMessages([buildInitialMessage(assistantContext.pageContext, assistantContext.dashboardName)])
    setInputValue('')
  }

  const currentContextLabel = assistantContext.dashboardName ?? assistantContext.pageContext.title

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-3 sm:bottom-5 sm:right-5">
      {isOpen ? (
        <div className="pointer-events-auto flex h-[min(72vh,580px)] w-[392px] max-w-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-white/95 shadow-floating backdrop-blur">
          <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-display text-sm font-semibold text-slate-900">Assistente LemonAI</p>
                  <p className="text-xs text-muted-foreground">
                    {assistantContext.pageContext.isDashboard
                      ? 'Ajuda do app + contexto do dashboard'
                      : 'Ajuda do app + contexto da tela atual'}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="neutral">{currentContextLabel}</Badge>
                {assistantContext.pageContext.isDashboard ? (
                  <Badge variant="neutral">Sem leitura numerica direta</Badge>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" onClick={handleReset} title="Nova conversa">
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => setIsOpen(false)} title="Fechar assistente">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-3">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}-${message.content.slice(0, 24)}`}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-6 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border/70 bg-slate-50 text-slate-800'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {isSending ? (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Pensando...
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="border-t border-border/70 px-4 py-3">
            <div className="flex items-end gap-2">
              <textarea
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void sendMessage(inputValue)
                  }
                }}
                rows={3}
                maxLength={1000}
                placeholder={assistantContext.placeholder}
                className="min-h-[84px] flex-1 resize-none rounded-2xl border border-border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50"
              />
              <Button
                type="button"
                size="icon"
                className="h-11 w-11 rounded-xl"
                onClick={() => void sendMessage(inputValue)}
                disabled={isSending || !inputValue.trim()}
                title="Enviar pergunta"
              >
                <SendHorizontal className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {assistantContext.pageContext.isDashboard
                ? 'Responde com base no seu tenant, no dashboard atual e no guia da plataforma. Ainda nao consulta metricas do relatorio.'
                : `Responde com base no seu tenant, na tela atual (${assistantContext.pageContext.title}) e no guia da plataforma.`}
            </p>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-auto relative">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,_rgba(59,130,246,0.22)_0%,_rgba(37,99,235,0.1)_42%,_transparent_72%)] blur-xl" />
        <div className="absolute inset-[-2px] rounded-full border border-primary/20 opacity-80" />
        <div className="absolute right-4 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.75)] animate-[pulse_3.4s_ease-in-out_infinite]" />
        <Button
          type="button"
          size="lg"
          className="relative h-14 rounded-full border border-primary/20 bg-white/92 px-5 text-slate-900 shadow-[0_14px_34px_rgba(37,99,235,0.18)] backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white"
          onClick={() => setIsOpen((current) => !current)}
        >
          <span className="absolute inset-0 rounded-full bg-[linear-gradient(115deg,transparent_18%,rgba(255,255,255,0.78)_50%,transparent_82%)] opacity-70 animate-[pulse_4.8s_ease-in-out_infinite]" />
          <span className="relative flex items-center">
            <Sparkles className="mr-2 h-4 w-4 text-primary" />
            <span className="font-medium">Assistente IA</span>
          </span>
        </Button>
      </div>
    </div>
  )
}

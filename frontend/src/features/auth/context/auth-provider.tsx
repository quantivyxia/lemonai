import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { authService } from '@/services/auth-service'
import { sessionStorageService, VIEW_AS_CLEARED_EVENT } from '@/services/session-storage'
import type { SessionUser, ViewAsSession } from '@/types/session'

type LoginInput = {
  email: string
  password: string
  remember: boolean
}

type AuthContextValue = {
  user: SessionUser | null
  actorUser: SessionUser | null
  viewAsUser: ViewAsSession | null
  isAuthenticated: boolean
  isLoading: boolean
  isViewAsMode: boolean
  login: (input: LoginInput) => Promise<void>
  logout: () => Promise<void>
  startViewAs: (user: ViewAsSession) => void
  stopViewAs: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const IDLE_TIMEOUT_MS = Number(import.meta.env.VITE_SESSION_IDLE_TIMEOUT_MS ?? 15 * 60 * 1000)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [actorUser, setActorUser] = useState<SessionUser | null>(null)
  const [viewAsUser, setViewAsUser] = useState<ViewAsSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const bootstrapAuth = async () => {
      try {
        sessionStorageService.clearLegacyPersistentSession()
        const session = await authService.hydrateSession()
        if (mounted) {
          setActorUser(session)
          setViewAsUser(session ? sessionStorageService.getViewAsSession() : null)
        }
      } catch {
        if (mounted) {
          setActorUser(null)
          setViewAsUser(null)
        }
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void bootstrapAuth()

    return () => {
      mounted = false
    }
  }, [])

  const login = useCallback(async (input: LoginInput) => {
    const session = await authService.login(input)
    sessionStorageService.clearViewAsSession()
    setActorUser(session)
    setViewAsUser(null)
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setActorUser(null)
    setViewAsUser(null)
  }, [])

  useEffect(() => {
    const handleViewAsCleared = () => {
      setViewAsUser(null)
    }

    window.addEventListener(VIEW_AS_CLEARED_EVENT, handleViewAsCleared)
    return () => {
      window.removeEventListener(VIEW_AS_CLEARED_EVENT, handleViewAsCleared)
    }
  }, [])

  useEffect(() => {
    if (!actorUser) return

    let timeoutId: number | null = null

    const clearTimer = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    const expireSession = () => {
      clearTimer()
      void authService.logout().finally(() => {
        setActorUser(null)
        setViewAsUser(null)
        toast.info('Sua sessao foi encerrada por inatividade.')
      })
    }

    const refreshIdleTimer = () => {
      clearTimer()
      timeoutId = window.setTimeout(expireSession, IDLE_TIMEOUT_MS)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshIdleTimer()
      }
    }

    const events: Array<keyof WindowEventMap> = ['click', 'keydown', 'scroll', 'mousemove', 'touchstart', 'focus']
    events.forEach((eventName) => window.addEventListener(eventName, refreshIdleTimer, { passive: true }))
    document.addEventListener('visibilitychange', onVisibilityChange)
    refreshIdleTimer()

    return () => {
      clearTimer()
      events.forEach((eventName) => window.removeEventListener(eventName, refreshIdleTimer))
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [actorUser])

  const startViewAs = (user: ViewAsSession) => {
    sessionStorageService.setViewAsSession(user)
    setViewAsUser(user)
  }

  const stopViewAs = () => {
    sessionStorageService.clearViewAsSession()
    setViewAsUser(null)
  }

  const user = viewAsUser ?? actorUser
  const isViewAsMode = Boolean(viewAsUser)

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      actorUser,
      viewAsUser,
      isAuthenticated: Boolean(user),
      isLoading,
      isViewAsMode,
      login,
      logout,
      startViewAs,
      stopViewAs,
    }),
    [actorUser, isLoading, isViewAsMode, login, logout, user, viewAsUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

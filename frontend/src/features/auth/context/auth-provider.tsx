import { createContext, useEffect, useMemo, useState } from 'react'

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
  logout: () => void
  startViewAs: (user: ViewAsSession) => void
  stopViewAs: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [actorUser, setActorUser] = useState<SessionUser | null>(null)
  const [viewAsUser, setViewAsUser] = useState<ViewAsSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const bootstrapAuth = async () => {
      try {
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

  useEffect(() => {
    const handleViewAsCleared = () => {
      setViewAsUser(null)
    }

    window.addEventListener(VIEW_AS_CLEARED_EVENT, handleViewAsCleared)
    return () => {
      window.removeEventListener(VIEW_AS_CLEARED_EVENT, handleViewAsCleared)
    }
  }, [])

  const login = async (input: LoginInput) => {
    const session = await authService.login(input)
    sessionStorageService.clearViewAsSession()
    setActorUser(session)
    setViewAsUser(null)
  }

  const logout = () => {
    authService.logout()
    setActorUser(null)
    setViewAsUser(null)
  }

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
    [actorUser, isLoading, isViewAsMode, user, viewAsUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

import type { AuthTokens, SessionUser, ViewAsSession } from '@/types/session'

const SESSION_KEY = 'insighthub.session'
const TOKENS_KEY = 'insighthub.tokens'
const VIEW_AS_KEY = 'insighthub.view-as'
export const VIEW_AS_CLEARED_EVENT = 'insighthub:view-as-cleared'

const parseJSON = <T>(raw: string | null): T | null => {
  if (!raw) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export const sessionStorageService = {
  getSession(): SessionUser | null {
    return parseJSON<SessionUser>(localStorage.getItem(SESSION_KEY))
  },

  setSession(user: SessionUser) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  },

  getTokens(): AuthTokens | null {
    return parseJSON<AuthTokens>(localStorage.getItem(TOKENS_KEY))
  },

  getViewAsSession(): ViewAsSession | null {
    return parseJSON<ViewAsSession>(localStorage.getItem(VIEW_AS_KEY))
  },

  setTokens(tokens: AuthTokens) {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens))
  },

  setViewAsSession(user: ViewAsSession) {
    localStorage.setItem(VIEW_AS_KEY, JSON.stringify(user))
  },

  getAccessToken() {
    return this.getTokens()?.access ?? null
  },

  getRefreshToken() {
    return this.getTokens()?.refresh ?? null
  },

  setAccessToken(access: string) {
    const current = this.getTokens()
    if (!current) return
    this.setTokens({ ...current, access })
  },

  clearViewAsSession() {
    localStorage.removeItem(VIEW_AS_KEY)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(VIEW_AS_CLEARED_EVENT))
    }
  },

  clear() {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(TOKENS_KEY)
    localStorage.removeItem(VIEW_AS_KEY)
  },
}

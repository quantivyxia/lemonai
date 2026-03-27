import type { AuthTokens, SessionUser, ViewAsSession } from '@/types/session'

const SESSION_KEY = 'insighthub.session'
const TOKENS_KEY = 'insighthub.tokens'
const VIEW_AS_KEY = 'insighthub.view-as'
const PERSISTENCE_KEY = 'insighthub.persistence'
export const VIEW_AS_CLEARED_EVENT = 'insighthub:view-as-cleared'

const parseJSON = <T>(raw: string | null): T | null => {
  if (!raw) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

const clearKeyEverywhere = (key: string) => {
  localStorage.removeItem(key)
  sessionStorage.removeItem(key)
}

export const sessionStorageService = {
  getSession(): SessionUser | null {
    return parseJSON<SessionUser>(sessionStorage.getItem(SESSION_KEY))
  },

  setSession(user: SessionUser, _remember = false) {
    clearKeyEverywhere(SESSION_KEY)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
    sessionStorage.setItem(PERSISTENCE_KEY, 'session')
  },

  getTokens(): AuthTokens | null {
    return parseJSON<AuthTokens>(sessionStorage.getItem(TOKENS_KEY))
  },

  getViewAsSession(): ViewAsSession | null {
    return parseJSON<ViewAsSession>(sessionStorage.getItem(VIEW_AS_KEY))
  },

  setTokens(tokens: AuthTokens, _remember = false) {
    clearKeyEverywhere(TOKENS_KEY)
    sessionStorage.setItem(TOKENS_KEY, JSON.stringify(tokens))
    sessionStorage.setItem(PERSISTENCE_KEY, 'session')
  },

  setViewAsSession(user: ViewAsSession) {
    clearKeyEverywhere(VIEW_AS_KEY)
    sessionStorage.setItem(VIEW_AS_KEY, JSON.stringify(user))
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
    this.setTokens({ ...current, access }, false)
  },

  clearLegacyPersistentSession() {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(TOKENS_KEY)
    localStorage.removeItem(VIEW_AS_KEY)
    localStorage.removeItem(PERSISTENCE_KEY)
  },

  clearViewAsSession() {
    clearKeyEverywhere(VIEW_AS_KEY)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(VIEW_AS_CLEARED_EVENT))
    }
  },

  clear() {
    clearKeyEverywhere(SESSION_KEY)
    clearKeyEverywhere(TOKENS_KEY)
    clearKeyEverywhere(VIEW_AS_KEY)
    clearKeyEverywhere(PERSISTENCE_KEY)
  },
}

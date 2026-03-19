import type { AuthTokens, SessionUser, ViewAsSession } from '@/types/session'

const SESSION_KEY = 'insighthub.session'
const TOKENS_KEY = 'insighthub.tokens'
const VIEW_AS_KEY = 'insighthub.view-as'
const PERSISTENCE_KEY = 'insighthub.persistence'
export const VIEW_AS_CLEARED_EVENT = 'insighthub:view-as-cleared'

type StorageMode = 'local' | 'session'

const parseJSON = <T>(raw: string | null): T | null => {
  if (!raw) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

const storages: Record<StorageMode, Storage> = {
  local: localStorage,
  session: sessionStorage,
}

const getModeFromStorage = (): StorageMode => {
  const localMode = localStorage.getItem(PERSISTENCE_KEY)
  if (localMode === 'local' || localMode === 'session') return localMode
  const sessionMode = sessionStorage.getItem(PERSISTENCE_KEY)
  if (sessionMode === 'local' || sessionMode === 'session') return sessionMode
  return localStorage.getItem(TOKENS_KEY) || localStorage.getItem(SESSION_KEY) ? 'local' : 'session'
}

const readFromAny = <T>(key: string): T | null => {
  return parseJSON<T>(localStorage.getItem(key)) ?? parseJSON<T>(sessionStorage.getItem(key))
}

const clearKeyEverywhere = (key: string) => {
  localStorage.removeItem(key)
  sessionStorage.removeItem(key)
}

const getActiveStorage = () => storages[getModeFromStorage()]

export const sessionStorageService = {
  getSession(): SessionUser | null {
    return readFromAny<SessionUser>(SESSION_KEY)
  },

  setSession(user: SessionUser, remember = true) {
    clearKeyEverywhere(SESSION_KEY)
    const mode: StorageMode = remember ? 'local' : 'session'
    storages[mode].setItem(SESSION_KEY, JSON.stringify(user))
    storages[mode].setItem(PERSISTENCE_KEY, mode)
  },

  getTokens(): AuthTokens | null {
    return readFromAny<AuthTokens>(TOKENS_KEY)
  },

  getViewAsSession(): ViewAsSession | null {
    return readFromAny<ViewAsSession>(VIEW_AS_KEY)
  },

  setTokens(tokens: AuthTokens, remember = true) {
    clearKeyEverywhere(TOKENS_KEY)
    const mode: StorageMode = remember ? 'local' : 'session'
    storages[mode].setItem(TOKENS_KEY, JSON.stringify(tokens))
    storages[mode].setItem(PERSISTENCE_KEY, mode)
  },

  setViewAsSession(user: ViewAsSession) {
    clearKeyEverywhere(VIEW_AS_KEY)
    getActiveStorage().setItem(VIEW_AS_KEY, JSON.stringify(user))
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
    this.setTokens({ ...current, access }, getModeFromStorage() === 'local')
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

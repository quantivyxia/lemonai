import { sessionStorageService } from '@/services/session-storage'

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '')
const API_BASE_URL = baseUrl ?? 'http://127.0.0.1:8000/api'

type RequestOptions = {
  auth?: boolean
  retryOnAuthError?: boolean
}

const buildUrl = (path: string) => {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

const NETWORK_ERROR_MESSAGE = `Nao foi possivel conectar com a API (${API_BASE_URL}). Verifique se o backend esta em execucao.`
const VIEW_AS_HEADER = 'X-InsightHub-View-As-User'
const VIEW_AS_READ_ONLY_MESSAGE = 'Modo "Ver tela do usuario" permite apenas visualizacao. Alteracoes estao bloqueadas.'
const INVALID_VIEW_AS_MESSAGES = [
  'Usuario selecionado para simulacao nao foi encontrado.',
  'Voce nao possui permissao para visualizar o ambiente deste usuario.',
]

const parseBody = async (response: Response) => {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

const resolveErrorMessage = (payload: unknown, fallback: string) => {
  if (!payload) return fallback
  if (typeof payload === 'string') return payload
  if (typeof payload !== 'object') return fallback

  const maybeDetail = (payload as { detail?: unknown }).detail
  if (typeof maybeDetail === 'string') return maybeDetail

  const firstEntry = Object.entries(payload as Record<string, unknown>)[0]
  if (!firstEntry) return fallback
  const [, value] = firstEntry
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  if (typeof value === 'string') return value
  return fallback
}

const isInvalidViewAsPayload = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') return false
  const detail = (payload as { detail?: unknown }).detail
  return typeof detail === 'string' && INVALID_VIEW_AS_MESSAGES.includes(detail)
}

const refreshAccessToken = async () => {
  const refresh = sessionStorageService.getRefreshToken()
  if (!refresh) return null

  let response: Response
  try {
    response = await fetch(buildUrl('/authentication/refresh/'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh }),
    })
  } catch {
    sessionStorageService.clear()
    return null
  }

  const payload = await parseBody(response)
  if (!response.ok) {
    sessionStorageService.clear()
    return null
  }

  const access = (payload as { access?: string })?.access
  if (!access) {
    sessionStorageService.clear()
    return null
  }

  sessionStorageService.setAccessToken(access)
  return access
}

export const apiRequest = async <T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> => {
  const auth = options.auth ?? true
  const retryOnAuthError = options.retryOnAuthError ?? true

  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const token = auth ? sessionStorageService.getAccessToken() : null
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const isAuthenticationRoute = path.startsWith('/authentication/')
  const viewAsUser = !isAuthenticationRoute ? sessionStorageService.getViewAsSession() : null
  const method = (init.method ?? 'GET').toUpperCase()
  const isSafeMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS'

  if (viewAsUser?.id && !isSafeMethod) {
    throw new Error(VIEW_AS_READ_ONLY_MESSAGE)
  }

  if (viewAsUser?.id) {
    headers.set(VIEW_AS_HEADER, viewAsUser.id)
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path), { ...init, headers })
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE)
  }

  if (response.status === 401 && auth && retryOnAuthError) {
    const refreshedToken = await refreshAccessToken()
    if (refreshedToken) {
      headers.set('Authorization', `Bearer ${refreshedToken}`)
      let retryResponse: Response
      try {
        retryResponse = await fetch(buildUrl(path), { ...init, headers })
      } catch {
        throw new Error(NETWORK_ERROR_MESSAGE)
      }
      const retryPayload = await parseBody(retryResponse)
      if (!retryResponse.ok) {
        throw new Error(resolveErrorMessage(retryPayload, `Erro na requisicao (${retryResponse.status})`))
      }
      return retryPayload as T
    }
  }

  const payload = await parseBody(response)

  if (viewAsUser?.id && isSafeMethod && (response.status === 403 || response.status === 404) && isInvalidViewAsPayload(payload)) {
    sessionStorageService.clearViewAsSession()
    headers.delete(VIEW_AS_HEADER)

    let retryResponse: Response
    try {
      retryResponse = await fetch(buildUrl(path), { ...init, headers })
    } catch {
      throw new Error(NETWORK_ERROR_MESSAGE)
    }

    const retryPayload = await parseBody(retryResponse)
    if (!retryResponse.ok) {
      throw new Error(resolveErrorMessage(retryPayload, `Erro na requisicao (${retryResponse.status})`))
    }

    return retryPayload as T
  }

  if (!response.ok) {
    throw new Error(resolveErrorMessage(payload, `Erro na requisicao (${response.status})`))
  }

  return payload as T
}

export const apiList = async <T>(path: string): Promise<T[]> => {
  const queryPath = path.includes('?') ? `${path}&page_size=500` : `${path}?page_size=500`
  const payload = await apiRequest<unknown>(queryPath)

  if (Array.isArray(payload)) return payload as T[]
  if (payload && typeof payload === 'object' && Array.isArray((payload as { results?: unknown[] }).results)) {
    return (payload as { results: T[] }).results
  }

  return []
}


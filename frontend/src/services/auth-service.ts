import { apiRequest } from '@/services/api-client'
import { sessionStorageService } from '@/services/session-storage'
import type { SessionUser } from '@/types/session'

type LoginInput = {
  email: string
  password: string
  remember: boolean
}

type BackendAuthUser = {
  id: string
  first_name: string
  last_name: string
  email: string
  role_code: SessionUser['role']
  tenant: string | null
  tenant_name: string | null
}

type LoginResponse = {
  access: string
  refresh: string
  user: BackendAuthUser
}

const mapBackendUserToSession = (user: BackendAuthUser): SessionUser => ({
  id: user.id,
  name: `${user.first_name} ${user.last_name}`.trim(),
  email: user.email,
  role: user.role_code,
  tenantId: user.tenant ?? undefined,
  tenantName: user.tenant_name ?? undefined,
})

export const authService = {
  getCurrentSession(): SessionUser | null {
    return sessionStorageService.getSession()
  },

  async hydrateSession(): Promise<SessionUser | null> {
    const current = sessionStorageService.getSession()

    const token = sessionStorageService.getAccessToken()
    if (!token) return current ?? null

    try {
      const payload = await apiRequest<BackendAuthUser>('/authentication/me/')
      const session = mapBackendUserToSession(payload)
      sessionStorageService.setSession(session)
      return session
    } catch {
      return current ?? null
    }
  },

  async login(input: LoginInput): Promise<SessionUser> {
    const payload = await apiRequest<LoginResponse>(
      '/authentication/login/',
      {
        method: 'POST',
        body: JSON.stringify({
          email: input.email.trim().toLowerCase(),
          password: input.password,
        }),
      },
      { auth: false, retryOnAuthError: false },
    )

    sessionStorageService.setTokens({
      access: payload.access,
      refresh: payload.refresh,
    })

    const session = mapBackendUserToSession(payload.user)
    sessionStorageService.setSession(session)
    return session
  },

  logout() {
    sessionStorageService.clear()
  },
}

import type { UserRole } from '@/types/entities'

export type SessionUser = {
  id: string
  name: string
  email: string
  role: UserRole
  tenantId?: string
  tenantName?: string
}

export type ViewAsSession = SessionUser

export type AuthTokens = {
  access: string
  refresh: string
}

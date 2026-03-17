import type { UserRole } from '@/types/entities'

export type SessionUser = {
  id: string
  name: string
  email: string
  role: UserRole
  tenantId: string
  tenantName: string
}

export type DemoCredential = {
  email: string
  password: string
  profile: SessionUser
  companyLabel: string
}

export const demoCredentials: DemoCredential[] = [
  {
    email: 'admin@insighthub.io',
    password: 'Insight@2026',
    companyLabel: 'InsightHub Global',
    profile: {
      id: 'u-000',
      name: 'Camila Araujo',
      email: 'admin@insighthub.io',
      role: 'super_admin',
      tenantId: 'global',
      tenantName: 'InsightHub Global',
    },
  },
  {
    email: 'admin@nexa.com',
    password: 'Nexa@2026',
    companyLabel: 'Nexa Consultoria',
    profile: {
      id: 'u-101',
      name: 'Guilherme Prado',
      email: 'admin@nexa.com',
      role: 'analyst',
      tenantId: 't-001',
      tenantName: 'Nexa Consultoria',
    },
  },
  {
    email: 'admin@solaris.com',
    password: 'Solaris@2026',
    companyLabel: 'Solaris Foods',
    profile: {
      id: 'u-201',
      name: 'Ana Ribeiro',
      email: 'admin@solaris.com',
      role: 'analyst',
      tenantId: 't-002',
      tenantName: 'Solaris Foods',
    },
  },
]

export const defaultSessionUser: SessionUser = demoCredentials[0].profile

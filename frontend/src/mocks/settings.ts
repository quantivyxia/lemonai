import type { PlatformSettings } from '@/types/entities'

export const defaultPlatformSettings: PlatformSettings = {
  language: 'pt-BR',
  notifyByEmail: true,
  notifyInApp: true,
  mfaRequired: true,
  sessionTimeoutMinutes: 60,
  allowExport: true,
}

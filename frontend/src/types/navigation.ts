import type { LucideIcon } from 'lucide-react'
import type { UserRole } from '@/types/entities'

export type NavItem = {
  label: string
  path: string
  icon: LucideIcon
  badge?: string
  roles?: UserRole[]
}

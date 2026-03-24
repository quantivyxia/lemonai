import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const formatNumber = (value: number) =>
  new Intl.NumberFormat('pt-BR').format(value)

const toDate = (value: string | number | Date | null | undefined) => {
  if (value === null || value === undefined || value === '') return null

  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const formatDate = (value: string | number | Date | null | undefined) => {
  const date = toDate(value)
  if (!date) return '-'

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-primary/20 bg-primary/10 text-primary',
        neutral: 'border-border bg-muted/60 text-muted-foreground',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        warning: 'border-amber-200 bg-amber-50 text-amber-700',
        danger: 'border-rose-200 bg-rose-50 text-rose-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

type BadgeProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>

export const Badge = ({ className, variant, ...props }: BadgeProps) => {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

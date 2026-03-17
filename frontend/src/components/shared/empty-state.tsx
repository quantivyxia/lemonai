import type { LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export const EmptyState = ({
  title,
  description,
  icon: Icon,
  actionLabel,
  onAction,
}: {
  title: string
  description: string
  icon: LucideIcon
  actionLabel?: string
  onAction?: () => void
}) => {
  return (
    <Card>
      <CardContent className="flex flex-col items-center py-12 text-center">
        <div className="rounded-2xl bg-muted p-3">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 font-display text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
        {actionLabel ? (
          <Button className="mt-5" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
